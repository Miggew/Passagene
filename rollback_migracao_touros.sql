-- Rollback: Reverter migração de touros
-- ATENÇÃO: Execute apenas se precisar reverter as mudanças

-- Passo 1: Remover foreign key e índice
ALTER TABLE public.doses_semen 
DROP CONSTRAINT IF EXISTS doses_semen_touro_id_fkey;

DROP INDEX IF EXISTS idx_doses_semen_touro_id;

-- Passo 2: Restaurar campos removidos (se foram removidos)
ALTER TABLE public.doses_semen 
ADD COLUMN IF NOT EXISTS nome TEXT,
ADD COLUMN IF NOT EXISTS raca TEXT;

-- Passo 3: Restaurar dados dos campos nome e raca a partir dos touros
-- (apenas se os campos foram removidos anteriormente)
UPDATE public.doses_semen d
SET 
    nome = t.nome,
    raca = t.raca
FROM public.touros t
WHERE d.touro_id = t.id
  AND (d.nome IS NULL OR d.raca IS NULL);

-- Passo 4: Remover campo touro_id
ALTER TABLE public.doses_semen 
DROP COLUMN IF EXISTS touro_id;

-- Passo 5: Remover tabela touros (apenas se necessário)
-- CUIDADO: Isso remove todos os touros cadastrados!
-- DROP TABLE IF EXISTS public.touros CASCADE;

COMMENT ON TABLE public.doses_semen IS 'Estrutura revertida para o formato anterior (sem referência a touros)';
