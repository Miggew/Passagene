-- ============================================================================
-- Verificar Status após Início do 2º Passo
-- ============================================================================
-- Objetivo: Entender qual é o status do protocolo quando o 2º passo é iniciado
-- (quando passo2_data é preenchido, mas ainda não houve TEs realizadas)

-- ============================================================================
-- QUERY 1: Protocolos com passo2_data preenchido, mas sem receptoras UTILIZADAS
-- ============================================================================
SELECT 
    ps.id,
    ps.status,
    ps.data_inicio,
    ps.passo2_data,
    ps.passo2_tecnico_responsavel,
    COUNT(pr.id) AS total_receptoras,
    COUNT(CASE WHEN pr.status = 'UTILIZADA' THEN 1 END) AS receptoras_utilizadas,
    COUNT(CASE WHEN pr.status = 'APTA' THEN 1 END) AS receptoras_aptas,
    COUNT(CASE WHEN pr.status = 'INICIADA' THEN 1 END) AS receptoras_iniciadas,
    COUNT(CASE WHEN pr.status = 'INAPTA' THEN 1 END) AS receptoras_inaptas
FROM protocolos_sincronizacao ps
LEFT JOIN protocolo_receptoras pr ON pr.protocolo_id = ps.id
WHERE ps.passo2_data IS NOT NULL
GROUP BY ps.id, ps.status, ps.data_inicio, ps.passo2_data, ps.passo2_tecnico_responsavel
ORDER BY ps.data_inicio DESC
LIMIT 20;

-- ============================================================================
-- QUERY 2: Protocolos com passo2_data preenchido mas SEM nenhuma receptora UTILIZADA
-- (Deveria ainda estar PASSO1_FECHADO?)
-- ============================================================================
SELECT 
    ps.id,
    ps.status,
    ps.data_inicio,
    ps.passo2_data,
    COUNT(pr.id) AS total_receptoras,
    COUNT(CASE WHEN pr.status = 'UTILIZADA' THEN 1 END) AS receptoras_utilizadas
FROM protocolos_sincronizacao ps
LEFT JOIN protocolo_receptoras pr ON pr.protocolo_id = ps.id
WHERE ps.passo2_data IS NOT NULL
GROUP BY ps.id, ps.status, ps.data_inicio, ps.passo2_data
HAVING COUNT(CASE WHEN pr.status = 'UTILIZADA' THEN 1 END) = 0
ORDER BY ps.data_inicio DESC
LIMIT 20;

-- ============================================================================
-- QUERY 3: Protocolos EM_TE - verificar quantas receptoras UTILIZADAS têm
-- ============================================================================
SELECT 
    ps.id,
    ps.status,
    ps.data_inicio,
    ps.passo2_data,
    COUNT(pr.id) AS total_receptoras,
    COUNT(CASE WHEN pr.status = 'UTILIZADA' THEN 1 END) AS receptoras_utilizadas,
    COUNT(CASE WHEN pr.status = 'APTA' THEN 1 END) AS receptoras_aptas,
    COUNT(CASE WHEN pr.status = 'INICIADA' THEN 1 END) AS receptoras_iniciadas
FROM protocolos_sincronizacao ps
LEFT JOIN protocolo_receptoras pr ON pr.protocolo_id = ps.id
WHERE ps.status = 'EM_TE'
GROUP BY ps.id, ps.status, ps.data_inicio, ps.passo2_data
ORDER BY ps.data_inicio DESC
LIMIT 20;

-- ============================================================================
-- QUERY 4: Verificar se há views que calculam status automaticamente
-- ============================================================================
SELECT 
    schemaname,
    viewname,
    definition
FROM pg_views
WHERE viewname LIKE '%protocolo%'
  AND (definition LIKE '%status%' OR definition LIKE '%EM_TE%')
ORDER BY viewname;

-- ============================================================================
-- QUERY 5: Verificar triggers que atualizam status
-- ============================================================================
SELECT 
    tgname AS trigger_name,
    pg_get_triggerdef(oid) AS trigger_definition
FROM pg_trigger
WHERE tgrelid = 'protocolos_sincronizacao'::regclass
  AND tgname NOT LIKE 'pg_%'
ORDER BY tgname;
