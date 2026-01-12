-- ============================================================
-- Script para Identificar e Remover as 2 Duplicatas Restantes
-- ============================================================

-- ============================================================
-- 1. VER DETALHES DAS DUPLICATAS
-- ============================================================
SELECT 
    r.id AS receptora_id,
    r.identificacao AS brinco,
    r.nome,
    r.created_at AS data_criacao,
    f.nome AS fazenda_nome,
    f.id AS fazenda_id,
    -- Verificar se está em algum protocolo
    (SELECT COUNT(*) 
     FROM protocolo_receptoras pr 
     WHERE pr.receptora_id = r.id) AS protocolos_vinculados,
    -- Verificar status nos protocolos
    (SELECT STRING_AGG(pr.status, ', ')
     FROM protocolo_receptoras pr 
     WHERE pr.receptora_id = r.id) AS status_protocolos,
    -- Verificar se tem histórico de fazendas
    (SELECT COUNT(*) 
     FROM receptora_fazenda_historico rfh2 
     WHERE rfh2.receptora_id = r.id) AS historico_fazendas_count
FROM receptoras r
INNER JOIN receptora_fazenda_historico rfh 
    ON rfh.receptora_id = r.id
    AND rfh.data_fim IS NULL
INNER JOIN fazendas f ON f.id = rfh.fazenda_id
WHERE r.identificacao IN (
    -- Pegar apenas os brincos que têm duplicatas
    SELECT r2.identificacao
    FROM receptoras r2
    INNER JOIN receptora_fazenda_historico rfh2 
        ON rfh2.receptora_id = r2.id
        AND rfh2.data_fim IS NULL
    GROUP BY r2.identificacao, rfh2.fazenda_id
    HAVING COUNT(*) > 1
)
ORDER BY r.identificacao, r.created_at;

-- ============================================================
-- 2. REMOVER DUPLICATAS (MANTER A MAIS ANTIGA)
-- ============================================================
-- Este script mantém a receptora mais antiga de cada grupo
-- e remove as outras (apenas se não estiverem em protocolos)
-- ============================================================

BEGIN;

DO $$
DECLARE
    rec_duplicata RECORD;
    v_receptora_manter UUID;
    v_receptora_remover UUID;
    v_protocolos_count INTEGER;
BEGIN
    -- Para cada grupo de duplicatas
    FOR rec_duplicata IN 
        SELECT 
            r.identificacao,
            f.id AS fazenda_id,
            ARRAY_AGG(r.id ORDER BY r.created_at) AS ids_receptoras
        FROM receptoras r
        INNER JOIN receptora_fazenda_historico rfh 
            ON rfh.receptora_id = r.id
            AND rfh.data_fim IS NULL
        INNER JOIN fazendas f ON f.id = rfh.fazenda_id
        GROUP BY r.identificacao, f.id
        HAVING COUNT(*) > 1
    LOOP
        -- Manter a primeira (mais antiga)
        v_receptora_manter := rec_duplicata.ids_receptoras[1];
        
        RAISE NOTICE '========================================';
        RAISE NOTICE 'Brinco: %, Fazenda: %', rec_duplicata.identificacao, rec_duplicata.fazenda_id;
        RAISE NOTICE 'Manter (mais antiga): %', v_receptora_manter;
        
        -- Processar cada duplicata (exceto a primeira)
        FOR i IN 2..array_length(rec_duplicata.ids_receptoras, 1) LOOP
            v_receptora_remover := rec_duplicata.ids_receptoras[i];
            
            -- Verificar se está em algum protocolo
            SELECT COUNT(*) INTO v_protocolos_count
            FROM protocolo_receptoras
            WHERE receptora_id = v_receptora_remover;
            
            IF v_protocolos_count > 0 THEN
                RAISE WARNING 'Receptora % está em % protocolo(s). NÃO será removida automaticamente.', 
                    v_receptora_remover, v_protocolos_count;
                RAISE NOTICE '  Ação necessária: Remover manualmente do(s) protocolo(s) antes de deletar.';
            ELSE
                RAISE NOTICE 'Remover: %', v_receptora_remover;
                
                -- Remover histórico de fazendas
                DELETE FROM receptora_fazenda_historico
                WHERE receptora_id = v_receptora_remover;
                
                -- Remover receptora
                DELETE FROM receptoras
                WHERE id = v_receptora_remover;
                
                RAISE NOTICE '  ✓ Receptora % removida com sucesso', v_receptora_remover;
            END IF;
        END LOOP;
    END LOOP;
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
-- 4. LISTAR DUPLICATAS QUE AINDA EXISTEM (SE HOUVER)
-- ============================================================
-- Execute esta query se ainda houver duplicatas após a limpeza
SELECT 
    r.identificacao AS brinco,
    f.nome AS fazenda_nome,
    COUNT(*) AS quantidade,
    STRING_AGG(r.id::TEXT, ', ' ORDER BY r.created_at) AS ids_receptoras,
    STRING_AGG(
        r.id::TEXT || ' (protocolos: ' || 
        COALESCE((SELECT COUNT(*)::TEXT FROM protocolo_receptoras pr WHERE pr.receptora_id = r.id), '0') || ')',
        ' | ' 
        ORDER BY r.created_at
    ) AS detalhes
FROM receptoras r
INNER JOIN receptora_fazenda_historico rfh 
    ON rfh.receptora_id = r.id
    AND rfh.data_fim IS NULL
INNER JOIN fazendas f ON f.id = rfh.fazenda_id
GROUP BY r.identificacao, f.id, f.nome
HAVING COUNT(*) > 1
ORDER BY quantidade DESC, r.identificacao;
