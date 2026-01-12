-- ============================================================
-- Script para Identificar e Limpar Duplicatas de Receptoras
-- ============================================================
-- Objetivo: Encontrar receptoras duplicadas (mesmo brinco na mesma fazenda)
--           e ajudar a decidir qual manter
-- ============================================================

-- ============================================================
-- 1. IDENTIFICAR DUPLICATAS
-- ============================================================
SELECT 
    r.identificacao AS brinco,
    f.nome AS fazenda_nome,
    f.id AS fazenda_id,
    COUNT(*) AS quantidade_duplicatas,
    STRING_AGG(r.id::TEXT, ', ' ORDER BY r.created_at) AS ids_receptoras,
    STRING_AGG(
        r.id::TEXT || ' (criada em ' || COALESCE(r.created_at::TEXT, 'N/A') || ')',
        ' | ' 
        ORDER BY r.created_at
    ) AS detalhes_receptoras
FROM receptoras r
INNER JOIN receptora_fazenda_historico rfh 
    ON rfh.receptora_id = r.id
    AND rfh.data_fim IS NULL
INNER JOIN fazendas f ON f.id = rfh.fazenda_id
GROUP BY r.identificacao, f.id, f.nome
HAVING COUNT(*) > 1
ORDER BY quantidade_duplicatas DESC, r.identificacao;

-- ============================================================
-- 2. DETALHES DAS RECEPTORAS DUPLICADAS
-- ============================================================
-- Execute esta query para cada grupo de duplicatas encontrado
-- Substitua 'BRINCO_AQUI' pelo brinco e 'FAZENDA_ID_AQUI' pelo ID da fazenda
/*
SELECT 
    r.id AS receptora_id,
    r.identificacao AS brinco,
    r.nome,
    r.created_at AS data_criacao,
    f.nome AS fazenda_nome,
    -- Verificar se está em algum protocolo
    (SELECT COUNT(*) 
     FROM protocolo_receptoras pr 
     WHERE pr.receptora_id = r.id) AS protocolos_vinculados,
    -- Verificar se tem histórico de fazendas
    (SELECT COUNT(*) 
     FROM receptora_fazenda_historico rfh2 
     WHERE rfh2.receptora_id = r.id) AS historico_fazendas_count
FROM receptoras r
INNER JOIN receptora_fazenda_historico rfh 
    ON rfh.receptora_id = r.id
    AND rfh.data_fim IS NULL
INNER JOIN fazendas f ON f.id = rfh.fazenda_id
WHERE r.identificacao = 'BRINCO_AQUI'  -- Substituir pelo brinco
  AND f.id = 'FAZENDA_ID_AQUI'  -- Substituir pelo ID da fazenda
ORDER BY r.created_at;
*/

-- ============================================================
-- 3. SCRIPT PARA REMOVER DUPLICATAS (MANTER A MAIS ANTIGA)
-- ============================================================
-- ATENÇÃO: Execute apenas após revisar as duplicatas!
-- Este script mantém a receptora mais antiga e remove as outras
-- ============================================================

DO $$
DECLARE
    rec_duplicata RECORD;
    v_receptora_manter UUID;
    v_receptoras_remover UUID[];
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
        -- Remover as outras
        v_receptoras_remover := rec_duplicata.ids_receptoras[2:array_length(rec_duplicata.ids_receptoras, 1)];
        
        RAISE NOTICE 'Brinco: %, Fazenda: %', rec_duplicata.identificacao, rec_duplicata.fazenda_id;
        RAISE NOTICE '  Manter: %', v_receptora_manter;
        RAISE NOTICE '  Remover: %', array_to_string(v_receptoras_remover, ', ');
        
        -- IMPORTANTE: Descomente as linhas abaixo apenas após revisar!
        -- Primeiro, verificar se as receptoras a remover estão em protocolos
        /*
        FOR i IN 1..array_length(v_receptoras_remover, 1) LOOP
            DECLARE
                v_count INTEGER;
            BEGIN
                SELECT COUNT(*) INTO v_count
                FROM protocolo_receptoras
                WHERE receptora_id = v_receptoras_remover[i];
                
                IF v_count > 0 THEN
                    RAISE WARNING 'Receptora % está em % protocolo(s). Não será removida automaticamente.', 
                        v_receptoras_remover[i], v_count;
                    CONTINUE;
                END IF;
                
                -- Remover histórico de fazendas
                DELETE FROM receptora_fazenda_historico
                WHERE receptora_id = v_receptoras_remover[i];
                
                -- Remover receptora
                DELETE FROM receptoras
                WHERE id = v_receptoras_remover[i];
                
                RAISE NOTICE '  Receptora % removida', v_receptoras_remover[i];
            END;
        END LOOP;
        */
    END LOOP;
END $$;

-- ============================================================
-- 4. VERIFICAÇÃO FINAL
-- ============================================================
-- Execute após limpar duplicatas para confirmar
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
-- INSTRUÇÕES:
-- ============================================================
-- 1. Execute a query 1 para identificar duplicatas
-- 2. Para cada grupo de duplicatas, execute a query 2 
--    (substituindo BRINCO_AQUI e FAZENDA_ID_AQUI)
-- 3. Revise manualmente qual receptora manter
-- 4. Descomente o código na query 3 e execute
-- 5. Execute a query 4 para verificar
-- 6. Depois execute constraint_brinco_unico_por_fazenda.sql
-- ============================================================
