-- Criar tabela para histórico de renomeações de receptoras
-- Esta tabela registra todas as alterações de brinco (identificacao) de uma receptora

CREATE TABLE IF NOT EXISTS receptora_renomeacoes_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receptora_id UUID NOT NULL REFERENCES receptoras(id) ON DELETE CASCADE,
  brinco_anterior TEXT NOT NULL,
  brinco_novo TEXT NOT NULL,
  data_renomeacao TIMESTAMP NOT NULL DEFAULT NOW(),
  motivo TEXT, -- 'MUDANCA_FAZENDA', 'EDICAO_MANUAL', etc.
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índice para busca rápida por receptora
CREATE INDEX IF NOT EXISTS idx_receptora_renomeacoes_receptora_id 
  ON receptora_renomeacoes_historico(receptora_id);

-- Índice para busca por data
CREATE INDEX IF NOT EXISTS idx_receptora_renomeacoes_data 
  ON receptora_renomeacoes_historico(data_renomeacao DESC);

-- Comentários
COMMENT ON TABLE receptora_renomeacoes_historico IS 'Registra todas as renomeações (alterações de brinco) de receptoras';
COMMENT ON COLUMN receptora_renomeacoes_historico.motivo IS 'Motivo da renomeação: MUDANCA_FAZENDA, EDICAO_MANUAL, etc.';
