-- ============================================================
-- Script Direto para Remover Duplicatas "teste duplo"
-- ============================================================
-- Remove a receptora mais nova (mantém a mais antiga)
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Verificar detalhes antes de remover
-- ============================================================
SELECT 
    r.id,
    r.identificacao,
    r.created_at,
    (SELECT COUNT(*) FROM protocolo_receptoras pr WHERE pr.receptora_id = r.id) AS protocolos_count
FROM receptoras r
WHERE r.id IN (
    'd488a22a-56eb-4787-b545-e5b488ccfadd',
    '2b1de3a9-4afc-4454-a86a-64f6ff381b99'
)
ORDER BY r.created_at;

-- ============================================================
-- 2. Remover a mais nova (se não estiver em protocolos)
-- ============================================================
DO $$
DECLARE
    v_receptora_manter UUID;
    v_receptora_remover UUID;
    v_protocolos_count INTEGER;
BEGIN
    -- Identificar qual é mais antiga
    SELECT id INTO v_receptora_manter
    FROM receptoras
    WHERE id IN (
        'd488a22a-56eb-4787-b545-e5b488ccfadd',
        '2b1de3a9-4afc-4454-a86a-64f6ff381b99'
    )
    ORDER BY created_at ASC NULLS LAST
    LIMIT 1;
    
    -- A outra será removida
    SELECT id INTO v_receptora_remover
    FROM receptoras
    WHERE id IN (
        'd488a22a-56eb-4787-b545-e5b488ccfadd',
        '2b1de3a9-4afc-4454-a86a-64f6ff381b99'
    )
    AND id != v_receptora_manter
    LIMIT 1;
    
    RAISE NOTICE 'Mantendo: %', v_receptora_manter;
    RAISE NOTICE 'Removendo: %', v_receptora_remover;
    
    -- Verificar se está em protocolos
    SELECT COUNT(*) INTO v_protocolos_count
    FROM protocolo_receptoras
    WHERE receptora_id = v_receptora_remover;
    
    IF v_protocolos_count > 0 THEN
        RAISE EXCEPTION 'Receptora % está em % protocolo(s). Não pode ser removida automaticamente.', 
            v_receptora_remover, v_protocolos_count;
    END IF;
    
    -- Remover histórico
    DELETE FROM receptora_fazenda_historico
    WHERE receptora_id = v_receptora_remover;
    
    -- Remover receptora
    DELETE FROM receptoras
    WHERE id = v_receptora_remover;
    
    RAISE NOTICE 'Duplicata removida com sucesso!';
END $$;

COMMIT;

-- ============================================================
-- 3. Verificação final
-- ============================================================
SELECT 
    r.identificacao AS brinco,
    f.nome AS fazenda_nome,
    COUNT(*) AS quantidade
FROM receptoras r
INNER JOIN receptora_fazenda_historico rfh 
    ON rfh.receptora_id = r.id
    AND rfh.data_fim IS NULL
INNER JOIN fazendas f ON f.id = rfh.fazenda_id
WHERE r.identificacao = 'teste duplo'
GROUP BY r.identificacao, f.id, f.nome;
