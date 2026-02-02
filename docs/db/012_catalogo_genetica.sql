-- =============================================
-- CATÁLOGO GENÉTICA - Vitrine de Vendas
-- Data: 01/02/2026
-- =============================================

-- Tabela principal do catálogo
CREATE TABLE IF NOT EXISTS catalogo_genetica (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tipo e referência ao animal
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('doadora', 'touro')),
  doadora_id UUID REFERENCES doadoras(id) ON DELETE CASCADE,
  touro_id UUID REFERENCES touros(id) ON DELETE CASCADE,

  -- Informações de venda
  preco DECIMAL(10,2),
  preco_negociavel BOOLEAN DEFAULT false,
  descricao TEXT,

  -- Controle de exibição
  ativo BOOLEAN DEFAULT true,
  destaque BOOLEAN DEFAULT false,
  ordem INT DEFAULT 0,

  -- Fotos (URLs do Supabase Storage)
  foto_principal TEXT,
  fotos_galeria TEXT[] DEFAULT '{}',

  -- Metadados
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),

  -- Constraint: deve ter doadora_id OU touro_id conforme o tipo
  CONSTRAINT check_animal_reference CHECK (
    (tipo = 'doadora' AND doadora_id IS NOT NULL AND touro_id IS NULL) OR
    (tipo = 'touro' AND touro_id IS NOT NULL AND doadora_id IS NULL)
  )
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_catalogo_tipo ON catalogo_genetica(tipo);
CREATE INDEX IF NOT EXISTS idx_catalogo_ativo ON catalogo_genetica(ativo);
CREATE INDEX IF NOT EXISTS idx_catalogo_destaque ON catalogo_genetica(destaque);
CREATE INDEX IF NOT EXISTS idx_catalogo_doadora ON catalogo_genetica(doadora_id) WHERE doadora_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_catalogo_touro ON catalogo_genetica(touro_id) WHERE touro_id IS NOT NULL;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_catalogo_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_catalogo_updated_at ON catalogo_genetica;
CREATE TRIGGER trigger_catalogo_updated_at
  BEFORE UPDATE ON catalogo_genetica
  FOR EACH ROW
  EXECUTE FUNCTION update_catalogo_updated_at();

-- =============================================
-- VIEW: Catálogo de Doadoras (dados completos)
-- =============================================
CREATE OR REPLACE VIEW vw_catalogo_doadoras AS
SELECT
  c.id AS catalogo_id,
  c.preco,
  c.preco_negociavel,
  c.descricao,
  c.destaque,
  c.ordem,
  c.foto_principal,
  c.fotos_galeria,
  c.created_at AS publicado_em,

  -- Dados da doadora
  d.id AS doadora_id,
  d.registro,
  d.nome,
  d.raca,
  d.data_nascimento,
  d.pelagem,

  -- Genealogia
  d.pai_nome,
  d.pai_registro,
  d.mae_nome,
  d.mae_registro,
  d.avo_paterno_nome,
  d.avo_paterno_registro,
  d.avo_materno_nome,
  d.avo_materno_registro,

  -- Fazenda de origem
  f.id AS fazenda_id,
  f.nome AS fazenda_nome,
  cl.id AS cliente_id,
  cl.nome AS cliente_nome

FROM catalogo_genetica c
INNER JOIN doadoras d ON d.id = c.doadora_id
LEFT JOIN fazendas f ON f.id = d.fazenda_id
LEFT JOIN clientes cl ON cl.id = f.cliente_id
WHERE c.tipo = 'doadora' AND c.ativo = true;

-- =============================================
-- VIEW: Catálogo de Touros (dados completos)
-- =============================================
CREATE OR REPLACE VIEW vw_catalogo_touros AS
SELECT
  c.id AS catalogo_id,
  c.preco,
  c.preco_negociavel,
  c.descricao,
  c.destaque,
  c.ordem,
  c.foto_principal,
  c.fotos_galeria,
  c.created_at AS publicado_em,

  -- Dados do touro
  t.id AS touro_id,
  t.nome,
  t.registro,
  t.raca,
  t.codigo_semen,

  -- Genealogia
  t.pai_nome,
  t.pai_registro,
  t.mae_nome,
  t.mae_registro,
  t.avo_paterno_nome,
  t.avo_paterno_registro,
  t.avo_materno_nome,
  t.avo_materno_registro

FROM catalogo_genetica c
INNER JOIN touros t ON t.id = c.touro_id
WHERE c.tipo = 'touro' AND c.ativo = true;

-- =============================================
-- VIEW: Destaques do Catálogo (Home)
-- =============================================
CREATE OR REPLACE VIEW vw_catalogo_destaques AS
SELECT
  c.id AS catalogo_id,
  c.tipo,
  c.preco,
  c.destaque,
  c.ordem,
  c.foto_principal,
  COALESCE(d.nome, t.nome) AS nome,
  COALESCE(d.registro, t.registro) AS registro,
  COALESCE(d.raca, t.raca) AS raca,
  COALESCE(d.pai_nome, t.pai_nome) AS pai_nome,
  COALESCE(d.mae_nome, t.mae_nome) AS mae_nome,
  f.nome AS fazenda_nome
FROM catalogo_genetica c
LEFT JOIN doadoras d ON d.id = c.doadora_id
LEFT JOIN touros t ON t.id = c.touro_id
LEFT JOIN fazendas f ON f.id = d.fazenda_id
WHERE c.ativo = true AND c.destaque = true
ORDER BY c.ordem, c.created_at DESC;

-- =============================================
-- RLS Policies
-- =============================================

-- Habilitar RLS
ALTER TABLE catalogo_genetica ENABLE ROW LEVEL SECURITY;

-- Política: Todos podem ler itens ativos do catálogo
CREATE POLICY "catalogo_select_ativos" ON catalogo_genetica
  FOR SELECT
  USING (ativo = true);

-- Política: Admins podem fazer tudo
CREATE POLICY "catalogo_admin_all" ON catalogo_genetica
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.user_type = 'admin'
    )
  );

-- =============================================
-- Dados de exemplo (opcional - remover em produção)
-- =============================================

-- Para testar, você pode inserir dados assim:
-- INSERT INTO catalogo_genetica (tipo, doadora_id, preco, descricao, destaque)
-- SELECT 'doadora', id, 2500.00, 'Doadora de elite com excelente histórico', true
-- FROM doadoras LIMIT 3;

-- INSERT INTO catalogo_genetica (tipo, touro_id, preco, descricao, destaque)
-- SELECT 'touro', id, 150.00, 'Sêmen de alta qualidade', true
-- FROM touros LIMIT 3;

-- =============================================
-- Comentários nas colunas
-- =============================================
COMMENT ON TABLE catalogo_genetica IS 'Catálogo de animais disponíveis para venda de genética (embriões/sêmen)';
COMMENT ON COLUMN catalogo_genetica.tipo IS 'Tipo do animal: doadora ou touro';
COMMENT ON COLUMN catalogo_genetica.preco IS 'Preço base (embrião para doadora, dose para touro)';
COMMENT ON COLUMN catalogo_genetica.preco_negociavel IS 'Indica se o preço pode ser negociado';
COMMENT ON COLUMN catalogo_genetica.destaque IS 'Se aparece na seção de destaques da vitrine';
COMMENT ON COLUMN catalogo_genetica.ordem IS 'Ordem de exibição (menor = primeiro)';
COMMENT ON COLUMN catalogo_genetica.foto_principal IS 'URL da foto principal no Supabase Storage';
COMMENT ON COLUMN catalogo_genetica.fotos_galeria IS 'Array de URLs de fotos adicionais';
