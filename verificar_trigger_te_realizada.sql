-- ============================================================================
-- Verificar definição completa do trigger trg_te_realizada_after_insert
-- ============================================================================

-- Ver a definição completa do trigger
SELECT 
    tgname AS trigger_name,
    tgrelid::regclass AS table_name,
    pg_get_triggerdef(oid) AS trigger_definition
FROM pg_trigger
WHERE tgname = 'trg_te_realizada_after_insert';

-- Ver a função associada ao trigger (se houver)
SELECT 
    p.proname AS function_name,
    pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND (p.proname LIKE '%te_realizada%' OR p.proname LIKE '%trg_te%');

-- Verificar também a função fechar_protocolo que contém UTILIZADA
SELECT 
    p.proname AS function_name,
    pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'fechar_protocolo';
