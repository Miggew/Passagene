-- ============================================================
-- Verificar Constraints em receptora_fazenda_historico
-- ============================================================
-- Objetivo: Encontrar todas as constraints que podem estar
--           causando o erro 409 (unique constraint violation)
-- ============================================================

-- 1. Verificar constraints únicas (incluindo índices únicos)
SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'receptora_fazenda_historico'::regclass
  AND contype IN ('u', 'p')  -- u = unique, p = primary key
ORDER BY conname;

-- 2. Verificar índices únicos (que criam constraints implícitas)
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'receptora_fazenda_historico'
  AND indexdef LIKE '%UNIQUE%'
ORDER BY indexname;

-- 3. Verificar se existe constraint ux_hist_receptora_ativa especificamente
SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conname = 'ux_hist_receptora_ativa';

-- 4. Se a constraint existir, mostrar detalhes do índice associado
SELECT 
    i.indexname,
    i.indexdef
FROM pg_indexes i
WHERE i.tablename = 'receptora_fazenda_historico'
  AND (i.indexname LIKE '%ux_hist_receptora_ativa%' 
       OR i.indexname LIKE '%receptora_fazenda_ativo%');
