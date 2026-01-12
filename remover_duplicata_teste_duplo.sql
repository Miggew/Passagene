-- ============================================================
-- Script para Remover Duplicata "teste duplo" na Fazenda Bucaina
-- ============================================================
-- IDs encontrados:
-- - d488a22a-56eb-4787-b545-e5b488ccfadd
-- - 2b1de3a9-4afc-4454-a86a-64f6ff381b99
-- ============================================================

-- ============================================================
-- 1. VERIFICAR DETALHES DAS DUAS RECEPTORAS
-- ============================================================
SELECT 
    r.id AS receptora_id,
    r.identificacao AS brinco,
    r.nome,
    r.created_at AS data_criacao,
    -- Verificar se está em algum protocolo
    (SELECT COUNT(*) 
     FROM protocolo_receptoras pr 
     WHERE pr.receptora_id = r.id) AS protocolos_vinculados,
    -- Verificar status nos protocolos
    (SELECT STRING_AGG(pr.status || ' (protocolo: ' || LEFT(pr.protocolo_id::TEXT, 8) || ')', ', ')
     FROM protocolo_receptoras pr 
     WHERE pr.receptora_id = r.id) AS detalhes_protocolos,
    -- Verificar histórico de fazendas
    (SELECT COUNT(*) 
     FROM receptora_fazenda_historico rfh2 
     WHERE rfh2.receptora_id = r.id) AS historico_fazendas_count
FROM receptoras r
WHERE r.id IN (
    'd488a22a-56eb-4787-b545-e5b488ccfadd',
    '2b1de3a9-4afc-4454-a86a-64f6ff381b99'
)
ORDER BY r.created_at;

-- ============================================================
-- 2. DECIDIR QUAL MANTER E QUAL REMOVER
-- ============================================================
-- A receptora mais antiga (primeira criada) será mantida
-- A mais nova será removida (se não estiver em protocolos)
-- ============================================================

BEGIN;

DO $$
DECLARE
    v_receptora_manter UUID;
    v_receptora_remover UUID;
    v_protocolos_count INTEGER;
    v_data_manter TIMESTAMP;
    v_data_remover TIMESTAMP;
BEGIN
    -- Determinar qual é mais antiga
    SELECT id, created_at INTO v_receptora_manter, v_data_manter
    FROM receptoras
    WHERE id IN ('d488a22a-56eb-4787-b545-e5b488ccfadd', '2b1de3a9-4afc-4454-a86a-64f6ff381b99')
    ORDER BY created_at ASC
    LIMIT 1;
    
    -- A outra será removida
    SELECT id, created_at INTO v_receptora_remover, v_data_remover
    FROM receptoras
    WHERE id IN ('d488a22a-56eb-4787-b545-e5b488ccfadd', '2b1de3a9-4afc-4454-a86a-64f6ff381b99')
      AND id != v_receptora_manter
    LIMIT 1;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Brinco: teste duplo';
    RAISE NOTICE 'Fazenda: Bucaina';
    RAISE NOTICE '';
    RAISE NOTICE 'MANTER (mais antiga):';
    RAISE NOTICE '  ID: %', v_receptora_manter;
    RAISE NOTICE '  Criada em: %', v_data_manter;
    
    -- Verificar protocolos da receptora a manter
    SELECT COUNT(*) INTO v_protocolos_count
    FROM protocolo_receptoras
    WHERE receptora_id = v_receptora_manter;
    RAISE NOTICE '  Protocolos vinculados: %', v_protocolos_count;
    
    RAISE NOTICE '';
    RAISE NOTICE 'REMOVER (mais nova):';
    RAISE NOTICE '  ID: %', v_receptora_remover;
    RAISE NOTICE '  Criada em: %', v_data_remover;
    
    -- Verificar protocolos da receptora a remover
    SELECT COUNT(*) INTO v_protocolos_count
    FROM protocolo_receptoras
    WHERE receptora_id = v_receptora_remover;
    RAISE NOTICE '  Protocolos vinculados: %', v_protocolos_count;
    
    IF v_protocolos_count > 0 THEN
        RAISE WARNING 'ATENÇÃO: A receptora a remover está em % protocolo(s)!', v_protocolos_count;
        RAISE WARNING 'É necessário migrar os dados do protocolo antes de remover.';
        RAISE WARNING 'NÃO será removida automaticamente.';
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

-- ============================================================
-- 3. VERIFICAÇÃO FINAL
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

COMMIT;

-- ============================================================
-- 4. SE A RECEPTORA A REMOVER ESTÁ EM PROTOCOLOS
-- ============================================================
-- Execute esta query para ver os protocolos e migrar manualmente
/*
SELECT 
    pr.id AS protocolo_receptora_id,
    pr.protocolo_id,
    pr.status,
    pr.ciclando_classificacao,
    pr.qualidade_semaforo,
    pr.motivo_inapta,
    pr.observacoes,
    ps.fazenda_id,
    ps.status AS protocolo_status
FROM protocolo_receptoras pr
INNER JOIN protocolos_sincronizacao ps ON ps.id = pr.protocolo_id
WHERE pr.receptora_id = 'ID_DA_RECEPTORA_A_REMOVER'  -- Substituir pelo ID
ORDER BY pr.data_inclusao;
*/
