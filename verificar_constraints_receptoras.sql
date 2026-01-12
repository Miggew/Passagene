-- ============================================================
-- Verificar Constraints em receptoras
-- ============================================================
-- Objetivo: Verificar quais constraints estão impedindo
--           receptoras com o mesmo brinco em fazendas diferentes
-- ============================================================

-- 1. Verificar constraints únicas na tabela receptoras
SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'receptoras'::regclass
  AND contype IN ('u', 'p')  -- u = unique, p = primary key
ORDER BY conname;

-- 2. Verificar índices únicos na tabela receptoras
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'receptoras'
  AND indexdef LIKE '%UNIQUE%'
ORDER BY indexname;

-- 3. Verificar se há constraint envolvendo identificacao e fazenda_atual_id
SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'receptoras'::regclass
  AND pg_get_constraintdef(oid) LIKE '%identificacao%'
ORDER BY conname;
