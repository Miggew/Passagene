-- ============================================================================
-- Investigar relação entre EM_TE e TEs realizadas
-- ============================================================================

-- ============================================================================
-- QUERY 1: Verificar se há views que calculam status EM_TE baseado em receptoras UTILIZADA
-- ============================================================================
SELECT 
    schemaname,
    viewname,
    definition
FROM pg_views
WHERE (viewname LIKE '%protocolo%' OR viewname LIKE '%status%')
  AND definition LIKE '%EM_TE%'
ORDER BY viewname;

-- ============================================================================
-- QUERY 2: Verificar se há triggers que atualizam status para EM_TE quando receptora vira UTILIZADA
-- ============================================================================
SELECT 
    tgname AS trigger_name,
    tgrelid::regclass AS table_name,
    pg_get_triggerdef(oid) AS trigger_definition
FROM pg_trigger
WHERE tgname NOT LIKE 'pg_%'
  AND (pg_get_triggerdef(oid) LIKE '%EM_TE%' OR pg_get_triggerdef(oid) LIKE '%UTILIZADA%')
ORDER BY tgrelid::regclass, tgname;

-- ============================================================================
-- QUERY 3: Protocolos EM_TE vs Receptoras UTILIZADA
-- Verificar se TODOS os protocolos EM_TE têm pelo menos uma receptora UTILIZADA
-- ============================================================================
SELECT 
    ps.id,
    ps.status,
    ps.data_inicio,
    ps.passo2_data,
    COUNT(pr.id) AS total_receptoras,
    COUNT(CASE WHEN pr.status = 'UTILIZADA' THEN 1 END) AS receptoras_utilizadas,
    COUNT(CASE WHEN pr.status = 'APTA' THEN 1 END) AS receptoras_aptas,
    COUNT(CASE WHEN pr.status = 'INICIADA' THEN 1 END) AS receptoras_iniciadas,
    COUNT(CASE WHEN pr.status = 'INAPTA' THEN 1 END) AS receptoras_inaptas,
    CASE 
        WHEN COUNT(CASE WHEN pr.status = 'UTILIZADA' THEN 1 END) > 0 
        THEN 'TEM TE REALIZADA'
        ELSE 'SEM TE REALIZADA'
    END AS tem_te
FROM protocolos_sincronizacao ps
LEFT JOIN protocolo_receptoras pr ON pr.protocolo_id = ps.id
WHERE ps.status = 'EM_TE'
GROUP BY ps.id, ps.status, ps.data_inicio, ps.passo2_data
ORDER BY ps.data_inicio DESC;

-- ============================================================================
-- QUERY 4: Protocolos PASSO1_FECHADO com passo2_data mas SEM receptoras UTILIZADA
-- (Esses deveriam estar EM_TE? Ou só quando há pelo menos uma UTILIZADA?)
-- ============================================================================
SELECT 
    ps.id,
    ps.status,
    ps.data_inicio,
    ps.passo2_data,
    COUNT(pr.id) AS total_receptoras,
    COUNT(CASE WHEN pr.status = 'UTILIZADA' THEN 1 END) AS receptoras_utilizadas,
    COUNT(CASE WHEN pr.status = 'APTA' THEN 1 END) AS receptoras_aptas,
    COUNT(CASE WHEN pr.status = 'INICIADA' THEN 1 END) AS receptoras_iniciadas,
    COUNT(CASE WHEN pr.status = 'INAPTA' THEN 1 END) AS receptoras_inaptas
FROM protocolos_sincronizacao ps
LEFT JOIN protocolo_receptoras pr ON pr.protocolo_id = ps.id
WHERE ps.status = 'PASSO1_FECHADO' 
  AND ps.passo2_data IS NOT NULL
GROUP BY ps.id, ps.status, ps.data_inicio, ps.passo2_data
HAVING COUNT(CASE WHEN pr.status = 'UTILIZADA' THEN 1 END) = 0
ORDER BY ps.data_inicio DESC;

-- ============================================================================
-- QUERY 5: Verificar se há funções que calculam/atualizam status para EM_TE
-- ============================================================================
SELECT 
    p.proname AS function_name,
    pg_get_function_arguments(p.oid) AS arguments,
    CASE 
        WHEN p.prosrc LIKE '%EM_TE%' THEN 'CONTÉM EM_TE'
        WHEN p.prosrc LIKE '%UTILIZADA%' THEN 'CONTÉM UTILIZADA'
        ELSE 'NÃO RELACIONADO'
    END AS relacionado
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND (p.proname LIKE '%protocolo%' OR p.proname LIKE '%status%' OR p.prosrc LIKE '%EM_TE%' OR p.prosrc LIKE '%UTILIZADA%')
ORDER BY p.proname;

-- ============================================================================
-- QUERY 6: Verificar tabela transferencias_embrioes (se existir)
-- ============================================================================
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name LIKE '%transferencia%' OR table_name LIKE '%embriao%'
ORDER BY table_name, ordinal_position;

-- ============================================================================
-- QUERY 7: Comparar protocolos EM_TE vs PASSO1_FECHADO com passo2_data
-- ============================================================================
SELECT 
    CASE 
        WHEN ps.status = 'EM_TE' THEN 'EM_TE'
        WHEN ps.status = 'PASSO1_FECHADO' AND ps.passo2_data IS NOT NULL THEN 'PASSO1_FECHADO (com passo2)'
        WHEN ps.status = 'PASSO1_FECHADO' AND ps.passo2_data IS NULL THEN 'PASSO1_FECHADO (sem passo2)'
        ELSE ps.status
    END AS categoria,
    COUNT(DISTINCT ps.id) AS total_protocolos,
    COUNT(pr.id) AS total_receptoras,
    COUNT(CASE WHEN pr.status = 'UTILIZADA' THEN 1 END) AS receptoras_utilizadas
FROM protocolos_sincronizacao ps
LEFT JOIN protocolo_receptoras pr ON pr.protocolo_id = ps.id
WHERE ps.status IN ('EM_TE', 'PASSO1_FECHADO', 'PRIMEIRO_PASSO_FECHADO')
GROUP BY categoria
ORDER BY categoria;
