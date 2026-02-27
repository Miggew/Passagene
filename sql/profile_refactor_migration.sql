-- ============================================================
-- PassaGene: Profile Refactor Migration
-- - Roles/specialties em user_profiles
-- - Tabela fazenda_profiles (perfil público de fazenda)
-- - Trigger auto-slug para fazenda_profiles
-- - profile_sections vinculável a fazenda
-- - RLS completo
-- - RPCs: get_fazenda_stats, get_provider_stats
-- Executar no Supabase Dashboard (SQL Editor)
-- ============================================================

-- Habilitar extensão unaccent (caso não exista)
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ============================================================
-- 1. ALTER user_profiles — Roles, especialidades, descrição
-- ============================================================
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS profile_roles TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS specialties TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS service_description TEXT;

COMMENT ON COLUMN user_profiles.profile_roles IS 'Papéis do usuário: veterinario, biologo, tecnico, produtor, etc.';
COMMENT ON COLUMN user_profiles.specialties IS 'Especialidades: fiv, te, aspiracao, genetica, etc.';
COMMENT ON COLUMN user_profiles.service_description IS 'Texto livre descrevendo os serviços prestados';

-- ============================================================
-- 2. CREATE TABLE fazenda_profiles — Perfil público de fazenda
-- ============================================================
CREATE TABLE IF NOT EXISTS fazenda_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fazenda_id UUID NOT NULL REFERENCES fazendas(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  slug TEXT UNIQUE,
  foto_url TEXT,
  descricao TEXT,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_fazenda_profiles_fazenda UNIQUE (fazenda_id)
);

CREATE INDEX IF NOT EXISTS idx_fazenda_profiles_slug ON fazenda_profiles (slug);
CREATE INDEX IF NOT EXISTS idx_fazenda_profiles_owner ON fazenda_profiles (owner_id);

COMMENT ON TABLE fazenda_profiles IS 'Perfil público de uma fazenda — vitrine com stats e seções customizáveis';

-- ============================================================
-- 3. Trigger auto-slug para fazenda_profiles
--    (mesmo padrão de trg_generate_profile_slug em user_profiles)
-- ============================================================

-- 3a. Função geradora de slug único para fazenda
CREATE OR REPLACE FUNCTION generate_fazenda_slug(p_fazenda_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_nome TEXT;
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Buscar nome da fazenda
  SELECT nome INTO v_nome FROM fazendas WHERE id = p_fazenda_id;

  IF v_nome IS NULL THEN
    -- Fallback: usar parte do UUID
    RETURN 'fazenda-' || left(p_fazenda_id::text, 8);
  END IF;

  -- Normalizar: lowercase, remover acentos, trocar espaços por hífens
  base_slug := lower(unaccent(trim(v_nome)));
  base_slug := regexp_replace(base_slug, '[^a-z0-9\s-]', '', 'g');
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(both '-' from base_slug);

  -- Se slug ficou vazio, usar parte do UUID
  IF base_slug = '' OR base_slug IS NULL THEN
    base_slug := 'fazenda-' || left(p_fazenda_id::text, 8);
  END IF;

  -- Tentar slug base
  final_slug := base_slug;

  -- Collision handling: adicionar sufixo numérico
  WHILE EXISTS (
    SELECT 1 FROM fazenda_profiles
    WHERE slug = final_slug AND fazenda_id != p_fazenda_id
  ) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  RETURN final_slug;
END;
$$;

-- 3b. Trigger function
CREATE OR REPLACE FUNCTION trigger_generate_fazenda_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Gera slug se está vazio (INSERT) ou se é UPDATE sem slug manual
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_fazenda_slug(NEW.fazenda_id);
  END IF;

  -- Sempre atualizar updated_at
  NEW.updated_at := now();

  RETURN NEW;
END;
$$;

-- 3c. Trigger
DROP TRIGGER IF EXISTS trg_generate_fazenda_slug ON fazenda_profiles;
CREATE TRIGGER trg_generate_fazenda_slug
  BEFORE INSERT OR UPDATE ON fazenda_profiles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_generate_fazenda_slug();

-- ============================================================
-- 4. ALTER profile_sections — Vincular a fazenda_profile
-- ============================================================
ALTER TABLE profile_sections
  ADD COLUMN IF NOT EXISTS fazenda_profile_id UUID REFERENCES fazenda_profiles(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_profile_sections_fazenda ON profile_sections (fazenda_profile_id, sort_order);

COMMENT ON COLUMN profile_sections.fazenda_profile_id IS 'Se preenchido, seção pertence ao perfil da fazenda (não do usuário)';

-- ============================================================
-- 5. RLS para fazenda_profiles
-- ============================================================
ALTER TABLE fazenda_profiles ENABLE ROW LEVEL SECURITY;

-- Dono (owner_id) tem acesso total
DROP POLICY IF EXISTS "fazenda_profiles_owner_all" ON fazenda_profiles;
CREATE POLICY "fazenda_profiles_owner_all"
  ON fazenda_profiles
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Admin tem acesso total
DROP POLICY IF EXISTS "fazenda_profiles_admin_all" ON fazenda_profiles;
CREATE POLICY "fazenda_profiles_admin_all"
  ON fazenda_profiles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- Perfis públicos visíveis para leitura (incluindo anônimos)
DROP POLICY IF EXISTS "fazenda_profiles_public_read" ON fazenda_profiles;
CREATE POLICY "fazenda_profiles_public_read"
  ON fazenda_profiles
  FOR SELECT
  USING (is_public = true);

-- ============================================================
-- 6. RLS em profile_sections — Dono da fazenda gerencia seções da fazenda
-- ============================================================
DROP POLICY IF EXISTS "profile_sections_fazenda_owner_all" ON profile_sections;
CREATE POLICY "profile_sections_fazenda_owner_all"
  ON profile_sections
  FOR ALL
  USING (
    fazenda_profile_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM fazenda_profiles fp
      WHERE fp.id = profile_sections.fazenda_profile_id
        AND fp.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    fazenda_profile_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM fazenda_profiles fp
      WHERE fp.id = profile_sections.fazenda_profile_id
        AND fp.owner_id = auth.uid()
    )
  );

-- ============================================================
-- 7. RPC get_fazenda_stats — Estatísticas de produção da fazenda
-- ============================================================
CREATE OR REPLACE FUNCTION get_fazenda_stats(p_fazenda_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_doadoras INTEGER;
  v_total_receptoras INTEGER;
  v_total_embrioes INTEGER;
  v_total_aspiracoes INTEGER;
  v_total_dg INTEGER;
  v_total_prenhe INTEGER;
  v_taxa_prenhez NUMERIC(5,2);
BEGIN
  -- Total de doadoras na fazenda
  SELECT COUNT(*) INTO v_total_doadoras
  FROM doadoras
  WHERE fazenda_id = p_fazenda_id;

  -- Total de receptoras vinculadas à fazenda (via protocolo_receptoras → protocolos_sincronizacao)
  SELECT COUNT(DISTINCT pr.receptora_id) INTO v_total_receptoras
  FROM protocolo_receptoras pr
  JOIN protocolos_sincronizacao ps ON pr.protocolo_id = ps.id
  JOIN receptoras r ON pr.receptora_id = r.id
  WHERE ps.fazenda_id = p_fazenda_id;

  -- Total de embriões válidos (classificação viável)
  -- embrioes → lotes_fiv_acasalamentos → aspiracoes_doadoras → fazenda_id
  SELECT COUNT(*) INTO v_total_embrioes
  FROM embrioes e
  JOIN lotes_fiv_acasalamentos lfa ON e.lote_fiv_acasalamento_id = lfa.id
  JOIN aspiracoes_doadoras ad ON lfa.aspiracao_doadora_id = ad.id
  WHERE ad.fazenda_id = p_fazenda_id
    AND e.classificacao IN ('A', 'B', 'C', 'BE', 'BN', 'BX', 'BL', 'BI');

  -- Total de aspirações (via aspiracoes_doadoras na fazenda)
  SELECT COUNT(DISTINCT ad.pacote_aspiracao_id) INTO v_total_aspiracoes
  FROM aspiracoes_doadoras ad
  WHERE ad.fazenda_id = p_fazenda_id
    AND ad.pacote_aspiracao_id IS NOT NULL;

  -- Taxa de prenhez: DGs da fazenda
  -- diagnosticos_gestacao → receptora → protocolo_receptoras → protocolos_sincronizacao.fazenda_id
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE dg.resultado IN ('PRENHE', 'PRENHE_RETOQUE'))
  INTO v_total_dg, v_total_prenhe
  FROM diagnosticos_gestacao dg
  JOIN protocolo_receptoras pr ON dg.receptora_id = pr.receptora_id
  JOIN protocolos_sincronizacao ps ON pr.protocolo_id = ps.id
  WHERE ps.fazenda_id = p_fazenda_id
    AND dg.tipo_diagnostico = 'DG';

  IF v_total_dg > 0 THEN
    v_taxa_prenhez := ROUND((v_total_prenhe::numeric / v_total_dg) * 100, 2);
  ELSE
    v_taxa_prenhez := 0;
  END IF;

  RETURN json_build_object(
    'total_doadoras', v_total_doadoras,
    'total_receptoras', v_total_receptoras,
    'total_embrioes', v_total_embrioes,
    'total_aspiracoes', v_total_aspiracoes,
    'taxa_prenhez', v_taxa_prenhez
  );
END;
$$;

COMMENT ON FUNCTION get_fazenda_stats IS 'Retorna estatísticas de produção da fazenda: doadoras, receptoras, embriões, aspirações, taxa de prenhez';

-- ============================================================
-- 8. RPC get_provider_stats — Estatísticas de serviço do profissional
-- ============================================================
CREATE OR REPLACE FUNCTION get_provider_stats(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_nome TEXT;
  v_total_aspiracoes INTEGER;
  v_total_tes INTEGER;
  v_total_embrioes INTEGER;
  v_total_clientes INTEGER;
  v_total_dg INTEGER;
  v_total_prenhe INTEGER;
  v_taxa_aproveitamento NUMERIC(5,2);
BEGIN
  -- Buscar nome do usuário para match com veterinario_responsavel/tecnico_responsavel
  SELECT nome INTO v_user_nome FROM user_profiles WHERE id = p_user_id;

  IF v_user_nome IS NULL THEN
    RETURN json_build_object(
      'total_aspiracoes', 0,
      'total_tes', 0,
      'total_embrioes', 0,
      'total_clientes', 0,
      'taxa_aproveitamento', 0
    );
  END IF;

  -- Total de aspirações onde o profissional é veterinário ou técnico
  SELECT COUNT(DISTINCT pa.id) INTO v_total_aspiracoes
  FROM pacotes_aspiracao pa
  WHERE pa.veterinario_responsavel = v_user_nome
     OR pa.tecnico_responsavel = v_user_nome;

  -- Total de TEs realizadas pelo profissional
  SELECT COUNT(*) INTO v_total_tes
  FROM transferencias_embrioes te
  WHERE te.veterinario_responsavel = v_user_nome
     OR te.tecnico_responsavel = v_user_nome;

  -- Total de embriões produzidos (via aspirações do profissional)
  SELECT COUNT(*) INTO v_total_embrioes
  FROM embrioes e
  JOIN lotes_fiv_acasalamentos lfa ON e.lote_fiv_acasalamento_id = lfa.id
  JOIN aspiracoes_doadoras ad ON lfa.aspiracao_doadora_id = ad.id
  JOIN pacotes_aspiracao pa ON ad.pacote_aspiracao_id = pa.id
  WHERE (pa.veterinario_responsavel = v_user_nome OR pa.tecnico_responsavel = v_user_nome)
    AND e.classificacao IN ('A', 'B', 'C', 'BE', 'BN', 'BX', 'BL', 'BI');

  -- Total de clientes distintos atendidos (via fazendas das aspirações)
  SELECT COUNT(DISTINCT f.cliente_id) INTO v_total_clientes
  FROM pacotes_aspiracao pa
  JOIN fazendas f ON pa.fazenda_id = f.id
  WHERE pa.veterinario_responsavel = v_user_nome
     OR pa.tecnico_responsavel = v_user_nome;

  -- Taxa de aproveitamento: DGs das TEs realizadas pelo profissional
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE dg.resultado IN ('PRENHE', 'PRENHE_RETOQUE'))
  INTO v_total_dg, v_total_prenhe
  FROM diagnosticos_gestacao dg
  JOIN transferencias_embrioes te ON dg.receptora_id = te.receptora_id AND dg.data_te = te.data_te
  WHERE (te.veterinario_responsavel = v_user_nome OR te.tecnico_responsavel = v_user_nome)
    AND dg.tipo_diagnostico = 'DG';

  IF v_total_dg > 0 THEN
    v_taxa_aproveitamento := ROUND((v_total_prenhe::numeric / v_total_dg) * 100, 2);
  ELSE
    v_taxa_aproveitamento := 0;
  END IF;

  RETURN json_build_object(
    'total_aspiracoes', v_total_aspiracoes,
    'total_tes', v_total_tes,
    'total_embrioes', v_total_embrioes,
    'total_clientes', v_total_clientes,
    'taxa_aproveitamento', v_taxa_aproveitamento
  );
END;
$$;

COMMENT ON FUNCTION get_provider_stats IS 'Retorna estatísticas de serviço do profissional: aspirações, TEs, embriões, clientes, taxa de aproveitamento';

-- ============================================================
-- FIM DA MIGRATION
-- ============================================================
