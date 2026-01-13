-- ============================================================
-- Verificar estrutura da tabela lotes_fiv
-- ============================================================

-- Verificar colunas existentes
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'lotes_fiv'
ORDER BY ordinal_position;
