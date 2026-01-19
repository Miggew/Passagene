-- ============================================================================
-- Verificar função fechar_protocolo (pode definir EM_TE)
-- Execute essas queries uma por uma
-- ============================================================================

-- ============================================================================
-- QUERY 1: Informações básicas da função fechar_protocolo
-- ============================================================================
SELECT 
    p.proname AS function_name,
    pg_get_function_arguments(p.oid) AS arguments,
    pg_get_function_result(p.oid) AS return_type,
    l.lanname AS language,
    p.prokind AS function_kind
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
JOIN pg_language l ON p.prolang = l.oid
WHERE n.nspname = 'public'
  AND p.proname = 'fechar_protocolo';

-- ============================================================================
-- QUERY 2: Tentar ver definição (pode causar erro se usar array_agg)
-- Execute com cuidado ou selecione "No limit"
-- ============================================================================
SELECT pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'fechar_protocolo'
LIMIT 1;

-- Se a query acima der erro, tente esta alternativa:
-- SELECT prosrc AS function_source
-- FROM pg_proc p
-- JOIN pg_namespace n ON p.pronamespace = n.oid
-- WHERE n.nspname = 'public'
--   AND p.proname = 'fechar_protocolo';

-- ============================================================================
-- QUERY 3: Verificar se há outras funções relacionadas
-- ============================================================================
SELECT 
    p.proname AS function_name,
    pg_get_function_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND (
    p.proname LIKE '%fechar%'
    OR p.proname LIKE '%protocolo%'
    OR p.proname LIKE '%status%'
  )
ORDER BY p.proname;

-- ============================================================================
-- QUERY 4: Ver se há view que calcula EM_TE dinamicamente
-- ============================================================================
SELECT 
    schemaname,
    viewname
FROM pg_views
WHERE viewname LIKE '%protocolo%'
ORDER BY viewname;

-- Depois de ver os nomes das views, você pode executar manualmente:
-- SELECT definition FROM pg_views WHERE viewname = 'nome_da_view';
-- Para ver a definição de cada view específica
