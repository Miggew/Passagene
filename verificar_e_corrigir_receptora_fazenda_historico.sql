-- ============================================================
-- Verificar e Corrigir: receptora_fazenda_historico
-- ============================================================
-- Objetivo: Verificar se há múltiplos vínculos ativos (violação do índice único parcial)
--           e corrigir se necessário
-- ============================================================

-- 1. Verificar se há receptoras com múltiplos vínculos ativos
SELECT 
    receptora_id,
    COUNT(*) as viculos_ativos,
    array_agg(id) as ids_vinculos
FROM receptora_fazenda_historico
WHERE data_fim IS NULL
GROUP BY receptora_id
HAVING COUNT(*) > 1;

-- 2. Se houver múltiplos vínculos ativos, corrigir mantendo apenas o mais recente
DO $$
DECLARE
    rec_record RECORD;
BEGIN
    FOR rec_record IN 
        SELECT receptora_id, array_agg(id ORDER BY data_inicio DESC, created_at DESC) as ids
        FROM receptora_fazenda_historico
        WHERE data_fim IS NULL
        GROUP BY receptora_id
        HAVING COUNT(*) > 1
    LOOP
        -- Fechar todos os vínculos exceto o mais recente (primeiro do array)
        UPDATE receptora_fazenda_historico
        SET data_fim = CURRENT_DATE - INTERVAL '1 day',
            updated_at = NOW()
        WHERE receptora_id = rec_record.receptora_id
          AND data_fim IS NULL
          AND id != rec_record.ids[1]; -- Mantém apenas o primeiro (mais recente)
        
        RAISE NOTICE 'Corrigido: receptora_id % - mantido vínculo %, fechados % outros', 
            rec_record.receptora_id, 
            rec_record.ids[1], 
            array_length(rec_record.ids, 1) - 1;
    END LOOP;
END $$;

-- 3. Verificar novamente se ainda há problemas
SELECT 
    receptora_id,
    COUNT(*) as viculos_ativos
FROM receptora_fazenda_historico
WHERE data_fim IS NULL
GROUP BY receptora_id
HAVING COUNT(*) > 1;
