-- ============================================================
-- Verificar Constraints em protocolo_receptoras
-- ============================================================
-- Objetivo: Verificar se ciclando_classificacao e qualidade_semaforo
--           têm constraints NOT NULL (devem ser opcionais)
-- ============================================================

-- 1. Verificar colunas ciclando_classificacao e qualidade_semaforo
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'protocolo_receptoras'
  AND column_name IN ('ciclando_classificacao', 'qualidade_semaforo')
ORDER BY column_name;

-- 2. Verificar constraints CHECK (se existirem)
SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'protocolo_receptoras'::regclass
  AND contype = 'c'  -- c = check constraint
ORDER BY conname;
