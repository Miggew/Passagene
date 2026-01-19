-- ============================================================================
-- SCRIPT ESPECÍFICO: Investigar Origem do Status EM_TE
-- ============================================================================

-- ============================================================================
-- PARTE 1: VERIFICAR SE HÁ TRIGGER QUE ATUALIZA STATUS PARA EM_TE
-- ============================================================================

-- 1.1 Listar todos os triggers na tabela protocolos_sincronizacao
SELECT 
    tgname AS trigger_name,
    pg_get_triggerdef(oid) AS trigger_definition
FROM pg_trigger
WHERE tgrelid = 'protocolos_sincronizacao'::regclass
ORDER BY tgname;

-- 1.2 Ver funções chamadas por triggers (pode conter lógica que define EM_TE)
SELECT DISTINCT
    t.tgname AS trigger_name,
    p.proname AS function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgrelid = 'protocolos_sincronizacao'::regclass
ORDER BY t.tgname;

-- 1.3 Buscar funções que mencionam EM_TE
SELECT 
    p.proname AS function_name,
    pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND pg_get_functiondef(p.oid) LIKE '%EM_TE%'
ORDER BY p.proname;

-- ============================================================================
-- PARTE 2: VERIFICAR SE HÁ VIEW QUE CALCULA EM_TE
-- ============================================================================

-- 2.1 Listar todas as views relacionadas a protocolos
SELECT 
    schemaname,
    viewname,
    definition
FROM pg_views
WHERE viewname LIKE '%protocolo%' OR viewname LIKE '%protocolos%'
ORDER BY viewname;

-- 2.2 Buscar views que mencionam EM_TE
SELECT 
    schemaname,
    viewname,
    definition
FROM pg_views
WHERE definition LIKE '%EM_TE%'
ORDER BY viewname;

-- ============================================================================
-- PARTE 3: VERIFICAR PROTOCOLOS EM_TE EM DETALHE
-- ============================================================================

-- 3.1 Ver detalhes completos de protocolos EM_TE
SELECT 
    ps.id,
    ps.status,
    ps.data_inicio,
    ps.passo2_data,
    ps.passo2_tecnico_responsavel,
    COUNT(pr.id) AS num_receptoras,
    COUNT(CASE WHEN pr.status = 'UTILIZADA' THEN 1 END) AS num_utilizadas,
    COUNT(CASE WHEN pr.status = 'APTA' THEN 1 END) AS num_aptas,
    COUNT(CASE WHEN pr.status = 'INICIADA' THEN 1 END) AS num_iniciadas,
    COUNT(CASE WHEN pr.status = 'INAPTA' THEN 1 END) AS num_inaptas
FROM protocolos_sincronizacao ps
LEFT JOIN protocolo_receptoras pr ON pr.protocolo_id = ps.id
WHERE ps.status = 'EM_TE'
GROUP BY ps.id, ps.status, ps.data_inicio, ps.passo2_data, ps.passo2_tecnico_responsavel
ORDER BY ps.data_inicio DESC;

-- 3.2 Comparar EM_TE com PASSO2_FECHADO para entender diferença
SELECT 
    ps.status,
    COUNT(DISTINCT ps.id) AS total_protocolos,
    COUNT(DISTINCT pr.protocolo_id) AS protocolos_com_receptoras,
    COUNT(pr.id) AS total_receptoras,
    COUNT(CASE WHEN pr.status = 'UTILIZADA' THEN 1 END) AS receptoras_utilizadas,
    COUNT(CASE WHEN pr.status = 'APTA' THEN 1 END) AS receptoras_aptas,
    COUNT(CASE WHEN pr.status = 'INICIADA' THEN 1 END) AS receptoras_iniciadas,
    ROUND(
        AVG(COALESCE(pr_counts.num_receptoras, 0)), 
        1
    ) AS media_receptoras
FROM protocolos_sincronizacao ps
LEFT JOIN protocolo_receptoras pr ON pr.protocolo_id = ps.id
LEFT JOIN (
    SELECT protocolo_id, COUNT(*) AS num_receptoras
    FROM protocolo_receptoras
    GROUP BY protocolo_id
) pr_counts ON pr_counts.protocolo_id = ps.id
WHERE ps.status IN ('EM_TE', 'PASSO2_FECHADO')
GROUP BY ps.status
ORDER BY ps.status;

-- ============================================================================
-- PARTE 4: VERIFICAR SE HÁ CÓDIGO QUE ATUALIZA STATUS AUTOMATICAMENTE
-- ============================================================================

-- 4.1 Buscar todas as funções que atualizam protocolos_sincronizacao
SELECT 
    p.proname AS function_name,
    pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND (
    pg_get_functiondef(p.oid) LIKE '%UPDATE%protocolos_sincronizacao%'
    OR pg_get_functiondef(p.oid) LIKE '%protocolos_sincronizacao%UPDATE%'
  )
ORDER BY p.proname;

-- 4.2 Buscar funções relacionadas a transferência de embriões ou TE
SELECT 
    p.proname AS function_name,
    pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND (
    p.proname LIKE '%transferencia%'
    OR p.proname LIKE '%te%'
    OR p.proname LIKE '%embriao%'
    OR pg_get_functiondef(p.oid) LIKE '%transferencia%'
    OR pg_get_functiondef(p.oid) LIKE '%tentativas_te%'
  )
ORDER BY p.proname;
