-- ============================================================
-- Verificar triggers e funções relacionadas a lotes_fiv
-- ============================================================

-- 1. Verificar triggers na tabela lotes_fiv
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE event_object_table = 'lotes_fiv'
ORDER BY trigger_name;

-- 2. Verificar funções que podem estar relacionadas
SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (
    routine_definition ILIKE '%data_fecundacao%'
    OR routine_definition ILIKE '%aspiracao_id%'
    OR routine_definition ILIKE '%lotes_fiv%'
  )
ORDER BY routine_name;
