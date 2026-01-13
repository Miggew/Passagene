-- ============================================================
-- Adicionar suporte a múltiplas fazendas destino
-- ============================================================
-- Objetivo: Permitir que um pacote de aspiração tenha múltiplas fazendas destino
-- ============================================================

-- 1. Criar tabela de relacionamento para múltiplas fazendas destino
CREATE TABLE IF NOT EXISTS pacotes_aspiracao_fazendas_destino (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pacote_aspiracao_id UUID NOT NULL REFERENCES pacotes_aspiracao(id) ON DELETE CASCADE,
    fazenda_destino_id UUID NOT NULL REFERENCES fazendas(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(pacote_aspiracao_id, fazenda_destino_id)
);

COMMENT ON TABLE pacotes_aspiracao_fazendas_destino IS 'Relacionamento N:N entre pacotes de aspiração e fazendas destino';
COMMENT ON COLUMN pacotes_aspiracao_fazendas_destino.pacote_aspiracao_id IS 'ID do pacote de aspiração';
COMMENT ON COLUMN pacotes_aspiracao_fazendas_destino.fazenda_destino_id IS 'ID da fazenda destino';

-- 2. Migrar dados existentes da coluna fazenda_destino_id para a nova tabela
INSERT INTO pacotes_aspiracao_fazendas_destino (pacote_aspiracao_id, fazenda_destino_id)
SELECT id, fazenda_destino_id
FROM pacotes_aspiracao
WHERE fazenda_destino_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3. A coluna fazenda_destino_id será mantida por compatibilidade temporariamente
--    mas pode ser removida no futuro após verificar que todos os dados foram migrados

-- NOTA: A coluna fazenda_destino_id na tabela pacotes_aspiracao será mantida
-- para compatibilidade com código existente, mas o ideal é usar apenas
-- a tabela de relacionamento para novos pacotes
