-- ============================================================================
-- SCRIPT SIMPLIFICADO: Investigar Origem do Status EM_TE
-- Execute as queries uma por uma
-- ============================================================================

-- ============================================================================
-- QUERY 1: Ver triggers na tabela protocolos_sincronizacao
-- ============================================================================
SELECT 
    tgname AS trigger_name,
    pg_get_triggerdef(oid) AS trigger_definition
FROM pg_trigger
WHERE tgrelid = 'protocolos_sincronizacao'::regclass
ORDER BY tgname;

-- ============================================================================
-- QUERY 2: Ver funções que mencionam EM_TE
-- ============================================================================
-- Primeiro, listar todas as funções relacionadas a protocolos
SELECT 
    p.proname AS function_name,
    pg_get_function_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND (p.proname LIKE '%protocolo%' OR p.proname LIKE '%status%')
ORDER BY p.proname;

-- Depois, verificar manualmente se alguma função tem EM_TE na definição
-- (pg_get_functiondef pode causar erro, então vamos ver por nome primeiro)

-- ============================================================================
-- QUERY 3: Ver todas as views relacionadas a protocolos
-- ============================================================================
SELECT 
    schemaname,
    viewname
FROM pg_views
WHERE viewname LIKE '%protocolo%' OR viewname LIKE '%protocolos%' OR viewname LIKE '%status%'
ORDER BY viewname;

-- Após ver os nomes, você pode executar manualmente:
-- SELECT definition FROM pg_views WHERE viewname = 'nome_da_view';
-- Para ver a definição completa de cada view

-- ============================================================================
-- QUERY 4: Detalhes de protocolos EM_TE
-- ============================================================================
SELECT 
    ps.id,
    ps.status,
    ps.data_inicio,
    ps.passo2_data,
    ps.passo2_tecnico_responsavel,
    COUNT(pr.id) AS num_receptoras,
    COUNT(CASE WHEN pr.status = 'UTILIZADA' THEN 1 END) AS num_utilizadas,
    COUNT(CASE WHEN pr.status = 'APTA' THEN 1 END) AS num_aptas
FROM protocolos_sincronizacao ps
LEFT JOIN protocolo_receptoras pr ON pr.protocolo_id = ps.id
WHERE ps.status = 'EM_TE'
GROUP BY ps.id, ps.status, ps.data_inicio, ps.passo2_data, ps.passo2_tecnico_responsavel
ORDER BY ps.data_inicio DESC;

-- ============================================================================
-- QUERY 5: Comparar EM_TE vs PASSO2_FECHADO (simplificado)
-- ============================================================================
SELECT 
    ps.status,
    COUNT(DISTINCT ps.id) AS total_protocolos,
    COUNT(pr.id) AS total_receptoras,
    COUNT(CASE WHEN pr.status = 'UTILIZADA' THEN 1 END) AS receptoras_utilizadas
FROM protocolos_sincronizacao ps
LEFT JOIN protocolo_receptoras pr ON pr.protocolo_id = ps.id
WHERE ps.status IN ('EM_TE', 'PASSO2_FECHADO')
GROUP BY ps.status
ORDER BY ps.status;
