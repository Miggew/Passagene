-- ============================================================
-- MIGRATION: Sistema Completo de Embriões
-- ============================================================
-- Este script cria a estrutura completa para o novo sistema de embriões
-- incluindo: tabelas de mídia, histórico, e campos adicionais
-- ============================================================

-- ============================================================
-- 1. TABELA: acasalamento_embrioes_media
-- ============================================================
-- Armazena vídeos/imagens dos embriões de um acasalamento
-- ============================================================

CREATE TABLE IF NOT EXISTS acasalamento_embrioes_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_fiv_acasalamento_id UUID NOT NULL REFERENCES lote_fiv_acasalamentos(id) ON DELETE CASCADE,
  
  tipo_media TEXT NOT NULL CHECK (tipo_media IN ('VIDEO', 'IMAGEM')),
  arquivo_url TEXT NOT NULL,
  arquivo_path TEXT NOT NULL,
  arquivo_nome TEXT NOT NULL,
  arquivo_tamanho BIGINT, -- Tamanho em bytes
  mime_type TEXT, -- video/mp4, video/quicktime, image/jpeg, etc
  
  duracao_segundos INTEGER, -- Para vídeos (ex: 30)
  largura INTEGER, -- Para vídeos/imagens (ex: 1920)
  altura INTEGER, -- Para vídeos/imagens (ex: 1080)
  
  descricao TEXT,
  data_gravacao TIMESTAMP, -- Data/hora em que foi gravado
  observacoes TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT fk_acasalamento_media FOREIGN KEY (lote_fiv_acasalamento_id) 
    REFERENCES lote_fiv_acasalamentos(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_acasalamento_media_acasalamento 
  ON acasalamento_embrioes_media(lote_fiv_acasalamento_id);

COMMENT ON TABLE acasalamento_embrioes_media IS 'Armazena vídeos/imagens dos embriões de um acasalamento';
COMMENT ON COLUMN acasalamento_embrioes_media.lote_fiv_acasalamento_id IS 'Referência ao acasalamento';
COMMENT ON COLUMN acasalamento_embrioes_media.tipo_media IS 'Tipo de mídia: VIDEO ou IMAGEM';
COMMENT ON COLUMN acasalamento_embrioes_media.arquivo_url IS 'URL pública do arquivo no Supabase Storage';
COMMENT ON COLUMN acasalamento_embrioes_media.arquivo_path IS 'Caminho do arquivo no storage';
COMMENT ON COLUMN acasalamento_embrioes_media.duracao_segundos IS 'Duração do vídeo em segundos';

-- ============================================================
-- 2. TABELA: historico_embrioes
-- ============================================================
-- Armazena histórico de mudanças de status dos embriões
-- ============================================================

CREATE TABLE IF NOT EXISTS historico_embrioes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  embriao_id UUID NOT NULL REFERENCES embrioes(id) ON DELETE CASCADE,
  
  status_anterior TEXT,
  status_novo TEXT NOT NULL,
  
  -- Dados relacionados à mudança
  fazenda_id UUID REFERENCES fazendas(id), -- Fazenda relacionada (destino, congelamento, etc)
  data_mudanca TIMESTAMP DEFAULT NOW(),
  
  -- Detalhes
  tipo_operacao TEXT, -- 'CLASSIFICACAO', 'DESTINACAO', 'CONGELAMENTO', 'DESCARTE', 'TRANSFERENCIA'
  observacoes TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT fk_historico_embriao FOREIGN KEY (embriao_id) 
    REFERENCES embrioes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_historico_embriao 
  ON historico_embrioes(embriao_id);
  
CREATE INDEX IF NOT EXISTS idx_historico_data 
  ON historico_embrioes(data_mudanca);

COMMENT ON TABLE historico_embrioes IS 'Histórico de mudanças de status dos embriões';
COMMENT ON COLUMN historico_embrioes.tipo_operacao IS 'Tipo de operação realizada';
COMMENT ON COLUMN historico_embrioes.fazenda_id IS 'Fazenda relacionada à mudança (se aplicável)';

-- ============================================================
-- 3. ATUALIZAR TABELA: embrioes
-- ============================================================
-- Adicionar novos campos necessários
-- ============================================================

-- Adicionar lote_fiv_acasalamento_id (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'embrioes' 
      AND column_name = 'lote_fiv_acasalamento_id'
  ) THEN
    ALTER TABLE embrioes ADD COLUMN lote_fiv_acasalamento_id UUID 
      REFERENCES lote_fiv_acasalamentos(id);
    CREATE INDEX IF NOT EXISTS idx_embrioes_acasalamento 
      ON embrioes(lote_fiv_acasalamento_id);
  END IF;
END $$;

-- Adicionar acasalamento_media_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'embrioes' 
      AND column_name = 'acasalamento_media_id'
  ) THEN
    ALTER TABLE embrioes ADD COLUMN acasalamento_media_id UUID 
      REFERENCES acasalamento_embrioes_media(id);
  END IF;
END $$;

-- Adicionar fazenda_destino_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'embrioes' 
      AND column_name = 'fazenda_destino_id'
  ) THEN
    ALTER TABLE embrioes ADD COLUMN fazenda_destino_id UUID 
      REFERENCES fazendas(id);
    CREATE INDEX IF NOT EXISTS idx_embrioes_fazenda_destino 
      ON embrioes(fazenda_destino_id);
  END IF;
END $$;

-- Adicionar data_classificacao
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'embrioes' 
      AND column_name = 'data_classificacao'
  ) THEN
    ALTER TABLE embrioes ADD COLUMN data_classificacao DATE;
  END IF;
END $$;

-- Atualizar constraint de status para incluir novos valores
DO $$
BEGIN
  -- Remover constraint antiga se existir
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_embrioes_status'
  ) THEN
    ALTER TABLE embrioes DROP CONSTRAINT check_embrioes_status;
  END IF;
  
  -- Adicionar nova constraint com todos os status
  ALTER TABLE embrioes ADD CONSTRAINT check_embrioes_status 
    CHECK (status_atual IN ('FRESCO', 'CONGELADO', 'TRANSFERIDO', 'DESCARTADO'));
END $$;

-- Comentários
COMMENT ON COLUMN embrioes.lote_fiv_acasalamento_id IS 'Referência ao acasalamento que gerou este embrião';
COMMENT ON COLUMN embrioes.acasalamento_media_id IS 'Referência ao vídeo/imagem do acasalamento';
COMMENT ON COLUMN embrioes.fazenda_destino_id IS 'Fazenda planejada para receber este embrião';
COMMENT ON COLUMN embrioes.data_classificacao IS 'Data em que o embrião foi classificado';
COMMENT ON COLUMN embrioes.classificacao IS 'Classificação do embrião (EX, BL, etc) - Obrigatória antes de destinar';

-- ============================================================
-- 4. FUNÇÃO: Gerar identificação do embrião
-- ============================================================
-- Função auxiliar para gerar identificação automaticamente
-- Formato: {doadora_registro}_{touro}_{classificacao}_{numero}
-- ============================================================

CREATE OR REPLACE FUNCTION gerar_identificacao_embriao(
  p_embriao_id UUID,
  p_classificacao TEXT
) RETURNS TEXT AS $$
DECLARE
  v_doadora_registro TEXT;
  v_touro_nome TEXT;
  v_numero INTEGER;
  v_identificacao TEXT;
BEGIN
  -- Buscar dados do acasalamento
  SELECT 
    d.registro,
    ds.nome,
    COUNT(e2.id) + 1
  INTO 
    v_doadora_registro,
    v_touro_nome,
    v_numero
  FROM embrioes e
  INNER JOIN lote_fiv_acasalamentos a ON e.lote_fiv_acasalamento_id = a.id
  INNER JOIN aspiracoes_doadoras ad ON a.aspiracao_doadora_id = ad.id
  INNER JOIN doadoras d ON ad.doadora_id = d.id
  INNER JOIN doses_semen ds ON a.dose_semen_id = ds.id
  LEFT JOIN embrioes e2 ON e2.lote_fiv_acasalamento_id = a.id 
    AND e2.classificacao IS NOT NULL 
    AND e2.id < e.id
  WHERE e.id = p_embriao_id
  GROUP BY d.registro, ds.nome, e.id;
  
  -- Gerar identificação
  v_identificacao := v_doadora_registro || '_' || v_touro_nome || '_' || p_classificacao || '_' || v_numero::TEXT;
  
  RETURN v_identificacao;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION gerar_identificacao_embriao IS 'Gera identificação do embrião no formato: {doadora_registro}_{touro}_{classificacao}_{numero}';

-- ============================================================
-- 5. TRIGGER: Atualizar updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para acasalamento_embrioes_media
DROP TRIGGER IF EXISTS update_acasalamento_embrioes_media_updated_at ON acasalamento_embrioes_media;
CREATE TRIGGER update_acasalamento_embrioes_media_updated_at
  BEFORE UPDATE ON acasalamento_embrioes_media
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 6. VERIFICAÇÃO FINAL
-- ============================================================

-- Verificar estrutura criada
SELECT 
  'Tabelas criadas/atualizadas com sucesso!' AS mensagem,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'acasalamento_embrioes_media') AS tabela_media,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'historico_embrioes') AS tabela_historico,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'embrioes' AND column_name = 'lote_fiv_acasalamento_id') AS coluna_acasalamento,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'embrioes' AND column_name = 'fazenda_destino_id') AS coluna_fazenda_destino,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'embrioes' AND column_name = 'data_classificacao') AS coluna_data_classificacao;
