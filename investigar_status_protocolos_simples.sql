-- ============================================================================
-- SCRIPT SIMPLIFICADO: Status de Protocolos de Sincronização
-- Versão sem subqueries complexas para evitar erros
-- ============================================================================

-- ============================================================================
-- PARTE 1: VERIFICAR STATUS REAIS NO BANCO
-- ============================================================================

-- 1.1 Contar protocolos por status (todos os status encontrados)
SELECT 
    status,
    COUNT(*) AS quantidade,
    MIN(data_inicio) AS primeira_data,
    MAX(data_inicio) AS ultima_data,
    COUNT(DISTINCT fazenda_id) AS num_fazendas
FROM protocolos_sincronizacao
GROUP BY status
ORDER BY quantidade DESC;

-- ============================================================================
-- PARTE 2: VERIFICAR PROTOCOLOS COM STATUS EM_TE
-- ============================================================================

-- 2.1 Ver detalhes de protocolos com status EM_TE (se existirem)
SELECT 
    ps.id,
    ps.fazenda_id,
    ps.data_inicio,
    ps.data_retirada,
    ps.status,
    ps.passo2_data,
    ps.passo2_tecnico_responsavel,
    ps.created_at
FROM protocolos_sincronizacao ps
WHERE ps.status = 'EM_TE'
ORDER BY ps.data_inicio DESC
LIMIT 20;

-- 2.2 Contar receptoras de protocolos EM_TE
SELECT 
    ps.id AS protocolo_id,
    ps.status,
    COUNT(pr.id) AS num_receptoras,
    COUNT(CASE WHEN pr.status = 'UTILIZADA' THEN 1 END) AS num_utilizadas,
    COUNT(CASE WHEN pr.status = 'APTA' THEN 1 END) AS num_aptas,
    COUNT(CASE WHEN pr.status = 'INICIADA' THEN 1 END) AS num_iniciadas
FROM protocolos_sincronizacao ps
LEFT JOIN protocolo_receptoras pr ON pr.protocolo_id = ps.id
WHERE ps.status = 'EM_TE'
GROUP BY ps.id, ps.status
ORDER BY ps.data_inicio DESC
LIMIT 20;

-- ============================================================================
-- PARTE 3: ANALISAR STATUS VS ESTADO DO PROTOCOLO
-- ============================================================================

-- 3.1 Análise cruzada: Status vs presença de passo2_data
SELECT 
    status,
    CASE 
        WHEN passo2_data IS NOT NULL THEN 'Com passo2_data'
        ELSE 'Sem passo2_data'
    END AS tem_passo2,
    COUNT(*) AS quantidade
FROM protocolos_sincronizacao
GROUP BY status, CASE WHEN passo2_data IS NOT NULL THEN 'Com passo2_data' ELSE 'Sem passo2_data' END
ORDER BY status, tem_passo2;

-- 3.2 Análise cruzada: Status vs receptoras UTILIZADAS
SELECT 
    ps.status,
    COUNT(DISTINCT ps.id) AS total_protocolos,
    COUNT(DISTINCT CASE WHEN pr.status = 'UTILIZADA' THEN ps.id END) AS protocolos_com_utilizadas,
    COUNT(DISTINCT CASE WHEN pr.status = 'UTILIZADA' THEN pr.id END) AS total_utilizadas
FROM protocolos_sincronizacao ps
LEFT JOIN protocolo_receptoras pr ON pr.protocolo_id = ps.id
GROUP BY ps.status
ORDER BY total_protocolos DESC;

-- ============================================================================
-- PARTE 4: VERIFICAR VIEWS RELACIONADAS
-- ============================================================================

-- 4.1 Listar todas as views relacionadas a protocolos
SELECT 
    schemaname,
    viewname
FROM pg_views
WHERE viewname LIKE '%protocolo%' OR viewname LIKE '%protocolos%'
ORDER BY viewname;

-- ============================================================================
-- PARTE 5: VERIFICAR TRIGGERS
-- ============================================================================

-- 5.1 Listar todos os triggers na tabela protocolos_sincronizacao
SELECT 
    tgname AS trigger_name,
    pg_get_triggerdef(oid) AS trigger_definition
FROM pg_trigger
WHERE tgrelid = 'protocolos_sincronizacao'::regclass
ORDER BY tgname;

-- ============================================================================
-- PARTE 6: ANÁLISE DE STATUS REDUNDANTES
-- ============================================================================

-- 6.1 Comparar PASSO1_FECHADO vs PRIMEIRO_PASSO_FECHADO
SELECT 
    status,
    COUNT(*) AS quantidade,
    COUNT(CASE WHEN passo2_data IS NOT NULL THEN 1 END) AS com_passo2,
    COUNT(CASE WHEN passo2_data IS NULL THEN 1 END) AS sem_passo2,
    MIN(data_inicio) AS primeira_data,
    MAX(data_inicio) AS ultima_data
FROM protocolos_sincronizacao
WHERE status IN ('PASSO1_FECHADO', 'PRIMEIRO_PASSO_FECHADO')
GROUP BY status
ORDER BY status;

-- 6.2 Comparar ABERTO vs PASSO1_ABERTO
SELECT 
    ps.status,
    COUNT(*) AS quantidade,
    MIN(ps.data_inicio) AS primeira_data,
    MAX(ps.data_inicio) AS ultima_data,
    COUNT(CASE WHEN pr_counts.num_receptoras = 0 THEN 1 END) AS sem_receptoras
FROM protocolos_sincronizacao ps
LEFT JOIN (
    SELECT protocolo_id, COUNT(*) AS num_receptoras
    FROM protocolo_receptoras
    GROUP BY protocolo_id
) pr_counts ON pr_counts.protocolo_id = ps.id
WHERE ps.status IN ('ABERTO', 'PASSO1_ABERTO')
GROUP BY ps.status
ORDER BY ps.status;

-- 6.3 Resumo: Status mais usados vs menos usados
SELECT 
    status,
    COUNT(*) AS quantidade,
    ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM protocolos_sincronizacao), 2) AS percentual,
    CASE 
        WHEN status IN ('PASSO2_FECHADO') THEN '✅ Status Final - Usado'
        WHEN status IN ('PASSO1_FECHADO', 'PRIMEIRO_PASSO_FECHADO') THEN '✅ Status Intermediário - Usado'
        WHEN status IN ('ABERTO', 'PASSO1_ABERTO') THEN '✅ Status Inicial - Usado'
        WHEN status = 'EM_TE' THEN '❓ Status Desconhecido - Investigar'
        WHEN status IS NULL THEN '⚠️ NULL - Possível Problema'
        ELSE '❌ Status Não Reconhecido - Possível Erro'
    END AS classificacao
FROM protocolos_sincronizacao
GROUP BY status
ORDER BY quantidade DESC;

-- ============================================================================
-- PARTE 7: RESUMO EXECUTIVO
-- ============================================================================

-- Resumo executivo: Status e suas características
SELECT 
    ps.status AS "Status",
    COUNT(*) AS "Quantidade",
    ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM protocolos_sincronizacao), 2) AS "Percentual",
    CASE 
        WHEN BOOL_OR(ps.passo2_data IS NOT NULL) THEN 'Sim'
        ELSE 'Não'
    END AS "Tem Passo2",
    ROUND(AVG(COALESCE(pr_counts.num_receptoras, 0)), 1)::NUMERIC(10,1) AS "Media Receptoras",
    MIN(ps.data_inicio) AS "Primeira Data",
    MAX(ps.data_inicio) AS "Ultima Data",
    CASE 
        WHEN ps.status IN ('PASSO2_FECHADO') THEN '✅ Status Final'
        WHEN ps.status IN ('PASSO1_FECHADO', 'PRIMEIRO_PASSO_FECHADO') THEN '✅ Status Intermediário'
        WHEN ps.status IN ('ABERTO', 'PASSO1_ABERTO') THEN '✅ Status Inicial'
        WHEN ps.status = 'EM_TE' THEN '❓ Status Desconhecido'
        WHEN ps.status IS NULL THEN '⚠️ NULL'
        ELSE '❌ Status Não Reconhecido'
    END AS "Classificacao"
FROM protocolos_sincronizacao ps
LEFT JOIN (
    SELECT protocolo_id, COUNT(*) AS num_receptoras
    FROM protocolo_receptoras
    GROUP BY protocolo_id
) pr_counts ON pr_counts.protocolo_id = ps.id
GROUP BY ps.status
ORDER BY COUNT(*) DESC;
