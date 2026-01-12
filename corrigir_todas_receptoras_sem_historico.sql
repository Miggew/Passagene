-- ============================================================
-- Correção: Criar registro no histórico para TODAS as receptoras
--           que não aparecem na view vw_receptoras_fazenda_atual
-- ============================================================
-- Objetivo: Corrigir receptoras que não têm registro ativo no histórico
--           mas têm fazenda_atual_id definido
-- ============================================================

DO $$
DECLARE
    v_receptora RECORD;
    v_count INTEGER := 0;
BEGIN
    -- Para cada receptora que tem fazenda_atual_id mas não aparece na view
    FOR v_receptora IN
        SELECT r.id, r.fazenda_atual_id, r.created_at
        FROM receptoras r
        WHERE r.fazenda_atual_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 
              FROM receptora_fazenda_historico rfh
              WHERE rfh.receptora_id = r.id
                AND rfh.data_fim IS NULL
          )
    LOOP
        -- Verificar se existe algum registro (mesmo que fechado)
        IF EXISTS (
            SELECT 1
            FROM receptora_fazenda_historico
            WHERE receptora_id = v_receptora.id
        ) THEN
            -- Existe registro fechado - reativar o mais recente
            UPDATE receptora_fazenda_historico
            SET data_fim = NULL,
                updated_at = NOW()
            WHERE id = (
                SELECT id
                FROM receptora_fazenda_historico
                WHERE receptora_id = v_receptora.id
                ORDER BY data_inicio DESC, created_at DESC
                LIMIT 1
            );
            
            v_count := v_count + 1;
        ELSE
            -- Não existe nenhum registro - criar novo
            INSERT INTO receptora_fazenda_historico (
                receptora_id,
                fazenda_id,
                data_inicio,
                observacoes
            )
            VALUES (
                v_receptora.id,
                v_receptora.fazenda_atual_id,
                COALESCE(v_receptora.created_at::DATE, CURRENT_DATE),
                'Registro criado automaticamente para corrigir ausência no histórico'
            );
            
            v_count := v_count + 1;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Total de receptoras corrigidas: %', v_count;
END $$;

-- Verificar resultado: contar quantas receptoras aparecem na view agora
SELECT 
    COUNT(*) as total_receptoras_na_view,
    (SELECT COUNT(*) FROM receptoras WHERE fazenda_atual_id IS NOT NULL) as total_receptoras_com_fazenda
FROM vw_receptoras_fazenda_atual;

-- Listar receptoras que AINDA não aparecem (se houver)
SELECT 
    r.id,
    r.identificacao,
    r.fazenda_atual_id,
    CASE 
        WHEN v.receptora_id IS NOT NULL THEN '✓ Aparece na view'
        ELSE '✗ NÃO aparece na view'
    END as status_view
FROM receptoras r
LEFT JOIN vw_receptoras_fazenda_atual v ON r.id = v.receptora_id
WHERE r.fazenda_atual_id IS NOT NULL
  AND v.receptora_id IS NULL
ORDER BY r.identificacao;
