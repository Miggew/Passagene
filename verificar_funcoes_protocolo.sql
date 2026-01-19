-- ============================================================================
-- Verificar definição das funções relacionadas a protocolos
-- Especialmente a função fechar_protocolo que pode definir EM_TE
-- ============================================================================

-- ============================================================================
-- QUERY 1: Ver definição da função fechar_protocolo
-- ============================================================================
-- Esta função pode ser responsável por definir o status EM_TE
SELECT 
    p.proname AS function_name,
    pg_get_function_arguments(p.oid) AS arguments,
    pg_get_function_result(p.oid) AS return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'fechar_protocolo';

-- Se a query acima funcionar, tente esta para ver a definição completa:
-- (Pode causar erro se a função usar array_agg, então execute com cuidado)
SELECT pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'fechar_protocolo';

-- ============================================================================
-- QUERY 2: Ver definição da função criar_protocolo_passo1_atomico
-- ============================================================================
SELECT 
    p.proname AS function_name,
    pg_get_function_arguments(p.oid) AS arguments,
    pg_get_function_result(p.oid) AS return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND (p.proname LIKE '%criar_protocolo%' OR p.proname LIKE '%protocolo_passo%');

-- ============================================================================
-- QUERY 3: Buscar todas as funções que fazem UPDATE em protocolos_sincronizacao
-- ============================================================================
-- Listar nomes de funções que podem atualizar protocolos
SELECT DISTINCT
    p.proname AS function_name,
    pg_get_function_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
JOIN pg_depend d ON d.objid = p.oid
JOIN pg_rewrite r ON r.oid = d.refobjid
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
ORDER BY p.proname;

-- ============================================================================
-- QUERY 4: Verificar se há outras funções relacionadas
-- ============================================================================
-- Buscar por funções que mencionam "protocolo" no nome
SELECT 
    p.proname AS function_name,
    pg_get_function_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND (
    p.proname LIKE '%protocolo%'
    OR p.proname LIKE '%fechar%'
    OR p.proname LIKE '%atualizar%status%'
  )
ORDER BY p.proname;
