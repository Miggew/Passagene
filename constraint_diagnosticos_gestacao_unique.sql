-- Migration: Adicionar constraint de unicidade em diagnosticos_gestacao
-- Garante que não haverá diagnósticos duplicados para mesma receptora + data_te + tipo_diagnostico

-- Remover diagnósticos duplicados existentes (manter apenas o mais recente)
DO $$
DECLARE
    duplicado RECORD;
BEGIN
    -- Encontrar e remover duplicados, mantendo apenas o mais recente
    FOR duplicado IN 
        SELECT receptora_id, data_te, tipo_diagnostico, COUNT(*) as total
        FROM diagnosticos_gestacao
        WHERE tipo_diagnostico = 'DG'
        GROUP BY receptora_id, data_te, tipo_diagnostico
        HAVING COUNT(*) > 1
    LOOP
        -- Deletar todos exceto o mais recente
        DELETE FROM diagnosticos_gestacao
        WHERE receptora_id = duplicado.receptora_id
          AND data_te = duplicado.data_te
          AND tipo_diagnostico = duplicado.tipo_diagnostico
          AND id NOT IN (
              SELECT id
              FROM diagnosticos_gestacao
              WHERE receptora_id = duplicado.receptora_id
                AND data_te = duplicado.data_te
                AND tipo_diagnostico = duplicado.tipo_diagnostico
              ORDER BY data_diagnostico DESC, created_at DESC
              LIMIT 1
          );
        
        RAISE NOTICE 'Removidos % diagnósticos duplicados para receptora % na data %', 
            duplicado.total - 1, duplicado.receptora_id, duplicado.data_te;
    END LOOP;
END $$;

-- Criar índice único para garantir unicidade
CREATE UNIQUE INDEX IF NOT EXISTS idx_diagnosticos_gestacao_unique 
ON diagnosticos_gestacao(receptora_id, data_te, tipo_diagnostico)
WHERE tipo_diagnostico = 'DG';

-- Comentário explicativo
COMMENT ON INDEX idx_diagnosticos_gestacao_unique IS 
'Garante que cada receptora só pode ter 1 diagnóstico DG por data_te. Previne duplicação quando há múltiplos embriões transferidos na mesma data.';
