-- Verificar a definição da constraint diagnosticos_regras_chk
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conname = 'diagnosticos_regras_chk'
AND conrelid = 'diagnosticos_gestacao'::regclass;

-- Verificar também outras constraints da tabela
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'diagnosticos_gestacao'::regclass
ORDER BY conname;
