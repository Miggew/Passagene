-- ============================================================
-- PassaGene: Perfil Pessoal + Marketplace C2C
-- Executar no Supabase Dashboard (SQL Editor)
-- ============================================================

-- ============================================================
-- 1. ALTER user_profiles — Campos de perfil pessoal
-- ============================================================
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS banner_url TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS profile_slug TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS profile_public BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS telefone TEXT,
  ADD COLUMN IF NOT EXISTS localizacao TEXT;

-- Índice para busca por slug
CREATE INDEX IF NOT EXISTS idx_user_profiles_slug ON user_profiles (profile_slug);

-- ============================================================
-- 2. ALTER clientes — Logo da empresa/fazenda
-- ============================================================
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- ============================================================
-- 3. Função para gerar slug único
-- ============================================================
CREATE OR REPLACE FUNCTION generate_profile_slug(p_nome TEXT, p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Normalizar: lowercase, remover acentos, trocar espaços por hífens
  base_slug := lower(unaccent(trim(p_nome)));
  base_slug := regexp_replace(base_slug, '[^a-z0-9\s-]', '', 'g');
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(both '-' from base_slug);

  -- Se slug ficou vazio, usar parte do UUID
  IF base_slug = '' OR base_slug IS NULL THEN
    base_slug := 'user-' || left(p_user_id::text, 8);
  END IF;

  -- Tentar slug base
  final_slug := base_slug;

  -- Collision handling: adicionar sufixo numérico
  WHILE EXISTS (
    SELECT 1 FROM user_profiles
    WHERE profile_slug = final_slug AND id != p_user_id
  ) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  RETURN final_slug;
END;
$$;

-- ============================================================
-- 4. Trigger para auto-gerar slug quando perfil é criado/atualizado
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_generate_profile_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Só gera slug se está vazio ou se o nome mudou
  IF NEW.profile_slug IS NULL OR (TG_OP = 'UPDATE' AND OLD.nome != NEW.nome AND NEW.profile_slug = OLD.profile_slug) THEN
    NEW.profile_slug := generate_profile_slug(NEW.nome, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_profile_slug ON user_profiles;
CREATE TRIGGER trg_generate_profile_slug
  BEFORE INSERT OR UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_generate_profile_slug();

-- Gerar slugs para perfis existentes que não têm
UPDATE user_profiles
SET profile_slug = generate_profile_slug(nome, id)
WHERE profile_slug IS NULL;

-- ============================================================
-- 5. Tabela profile_sections — Seções customizáveis do perfil
-- ============================================================
CREATE TABLE IF NOT EXISTS profile_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  section_type TEXT NOT NULL CHECK (section_type IN ('text', 'animal_showcase', 'photo_gallery', 'stats', 'fazenda_highlight')),
  title TEXT NOT NULL DEFAULT '',
  content JSONB NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_public BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_sections_user ON profile_sections (user_id, sort_order);

-- RLS para profile_sections
ALTER TABLE profile_sections ENABLE ROW LEVEL SECURITY;

-- Dono faz tudo
CREATE POLICY "profile_sections_owner_all"
  ON profile_sections
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Seções públicas visíveis para todos (leitura)
CREATE POLICY "profile_sections_public_read"
  ON profile_sections
  FOR SELECT
  USING (is_public = true AND active = true);

-- Admin acesso total
CREATE POLICY "profile_sections_admin_all"
  ON profile_sections
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- ============================================================
-- 6. Tabela anuncios_usuario — Marketplace C2C
-- ============================================================
CREATE TABLE IF NOT EXISTS anuncios_usuario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('doadora', 'touro', 'embriao', 'dose', 'outro')),
  titulo TEXT NOT NULL,
  descricao TEXT,
  preco NUMERIC(12, 2),
  preco_negociavel BOOLEAN DEFAULT false,
  doadora_id UUID REFERENCES doadoras(id) ON DELETE SET NULL,
  touro_id UUID REFERENCES touros(id) ON DELETE SET NULL,
  foto_principal TEXT,
  fotos_galeria TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'RASCUNHO' CHECK (status IN ('RASCUNHO', 'ATIVO', 'PAUSADO', 'VENDIDO', 'REMOVIDO')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anuncios_usuario_user ON anuncios_usuario (user_id);
CREATE INDEX IF NOT EXISTS idx_anuncios_usuario_status ON anuncios_usuario (status);
CREATE INDEX IF NOT EXISTS idx_anuncios_usuario_tipo ON anuncios_usuario (tipo);

-- RLS para anuncios_usuario
ALTER TABLE anuncios_usuario ENABLE ROW LEVEL SECURITY;

-- Dono faz tudo com seus anúncios
CREATE POLICY "anuncios_owner_all"
  ON anuncios_usuario
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Anúncios ATIVO visíveis para todos (leitura)
CREATE POLICY "anuncios_public_read"
  ON anuncios_usuario
  FOR SELECT
  USING (status = 'ATIVO');

-- Admin acesso total
CREATE POLICY "anuncios_admin_all"
  ON anuncios_usuario
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- ============================================================
-- 7. Storage — Bucket profiles
-- ============================================================
-- Executar via Supabase Dashboard > Storage > Create Bucket:
--   Name: profiles
--   Public: false (usar signed URLs)
--   File size limit: 5MB
--   Allowed MIME types: image/*
--
-- Estrutura de pastas (criadas automaticamente pelo upload):
--   avatars/{user_id}/
--   banners/{user_id}/
--   logos/{cliente_id}/
--   sections/{user_id}/{section_id}/
--   anuncios/{user_id}/{anuncio_id}/

-- Storage policies (se bucket já existir, criar via Dashboard > Storage > Policies)
-- INSERT: Usuário autenticado pode fazer upload na sua própria pasta
-- SELECT: Qualquer autenticado pode ler (signed URLs são controladas pelo app)
-- DELETE: Usuário pode deletar seus próprios arquivos

-- ============================================================
-- FIM DA MIGRATION
-- ============================================================
