-- ============================================================
-- Script para Remover Duplicata "teste duplo" - Versão Final
-- ============================================================
-- IDs: 
-- - d488a22a-56eb-4787-b545-e5b488ccfadd
-- - 2b1de3a9-4afc-4454-a86a-64f6ff381b99
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Verificar qual é mais antiga e qual está em protocolos
-- ============================================================
DO $$
DECLARE
    v_receptora_manter UUID;
    v_receptora_remover UUID;
    v_protocolos_count INTEGER;
    v_data_manter TIMESTAMP;
    v_data_remover TIMESTAMP;
    v_ids UUID[] := ARRAY[
        'd488a22a-56eb-4787-b545-e5b488ccfadd'::UUID,
        '2b1de3a9-4afc-4454-a86a-64f6ff381b99'::UUID
    ];
    rec_protocolo RECORD;
BEGIN
    -- Determinar qual é mais antiga
    SELECT id, created_at INTO v_receptora_manter, v_data_manter
    FROM receptoras
    WHERE id = ANY(v_ids)
    ORDER BY created_at ASC NULLS LAST
    LIMIT 1;
    
    -- A outra será removida
    SELECT id, created_at INTO v_receptora_remover, v_data_remover
    FROM receptoras
    WHERE id = ANY(v_ids)
      AND id != v_receptora_manter
    LIMIT 1;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Removendo duplicata "teste duplo" na fazenda Bucaina';
    RAISE NOTICE '';
    RAISE NOTICE 'MANTER (mais antiga):';
    RAISE NOTICE '  ID: %', v_receptora_manter;
    RAISE NOTICE '  Criada em: %', COALESCE(v_data_manter::TEXT, 'N/A');
    
    -- Verificar protocolos da receptora a manter
    SELECT COUNT(*) INTO v_protocolos_count
    FROM protocolo_receptoras
    WHERE receptora_id = v_receptora_manter;
    RAISE NOTICE '  Protocolos vinculados: %', v_protocolos_count;
    
    RAISE NOTICE '';
    RAISE NOTICE 'REMOVER (mais nova):';
    RAISE NOTICE '  ID: %', v_receptora_remover;
    RAISE NOTICE '  Criada em: %', COALESCE(v_data_remover::TEXT, 'N/A');
    
    -- Verificar protocolos da receptora a remover
    SELECT COUNT(*) INTO v_protocolos_count
    FROM protocolo_receptoras
    WHERE receptora_id = v_receptora_remover;
    RAISE NOTICE '  Protocolos vinculados: %', v_protocolos_count;
    
    IF v_protocolos_count > 0 THEN
        RAISE WARNING '';
        RAISE WARNING 'ATENÇÃO: A receptora a remover está em % protocolo(s)!', v_protocolos_count;
        RAISE WARNING 'Listando protocolos:';
        
        -- Listar protocolos
        FOR rec_protocolo IN 
            SELECT pr.id, pr.protocolo_id, pr.status, LEFT(pr.protocolo_id::TEXT, 8) AS protocolo_id_short
            FROM protocolo_receptoras pr
            WHERE pr.receptora_id = v_receptora_remover
        LOOP
            RAISE WARNING '  - Protocolo: % (Status: %)', rec_protocolo.protocolo_id_short, rec_protocolo.status;
        END LOOP;
        
        RAISE WARNING '';
        RAISE WARNING 'NÃO será removida automaticamente por segurança.';
        RAISE WARNING 'Execute manualmente após migrar os dados do protocolo.';
    ELSE
        RAISE NOTICE '';
        RAISE NOTICE 'Removendo receptora duplicada...';
        
        -- Remover histórico de fazendas
        DELETE FROM receptora_fazenda_historico
        WHERE receptora_id = v_receptora_remover;
        
        RAISE NOTICE '  ✓ Histórico de fazendas removido';
        
        -- Remover receptora
        DELETE FROM receptoras
        WHERE id = v_receptora_remover;
        
        RAISE NOTICE '  ✓ Receptora removida';
        RAISE NOTICE '';
        RAISE NOTICE 'SUCESSO: Duplicata removida!';
    END IF;
END $$;

COMMIT;

-- ============================================================
-- 2. VERIFICAÇÃO FINAL
-- ============================================================
SELECT 
    'VERIFICAÇÃO FINAL' AS status,
    COUNT(*) AS total_duplicatas_restantes
FROM (
    SELECT 
        r.identificacao,
        f.id AS fazenda_id,
        COUNT(*) AS quantidade
    FROM receptoras r
    INNER JOIN receptora_fazenda_historico rfh 
        ON rfh.receptora_id = r.id
        AND rfh.data_fim IS NULL
    INNER JOIN fazendas f ON f.id = rfh.fazenda_id
    GROUP BY r.identificacao, f.id
    HAVING COUNT(*) > 1
) duplicatas;

-- ============================================================
-- 3. Se ainda houver duplicatas, listar
-- ============================================================
SELECT 
    r.identificacao AS brinco,
    f.nome AS fazenda_nome,
    COUNT(*) AS quantidade,
    STRING_AGG(r.id::TEXT, ', ' ORDER BY r.created_at) AS ids_receptoras
FROM receptoras r
INNER JOIN receptora_fazenda_historico rfh 
    ON rfh.receptora_id = r.id
    AND rfh.data_fim IS NULL
INNER JOIN fazendas f ON f.id = rfh.fazenda_id
GROUP BY r.identificacao, f.id, f.nome
HAVING COUNT(*) > 1
ORDER BY quantidade DESC, r.identificacao;
