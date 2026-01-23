-- Define default para status_reprodutivo e corrige registros nulos
ALTER TABLE public.receptoras
  ALTER COLUMN status_reprodutivo SET DEFAULT 'VAZIA';

UPDATE public.receptoras
SET status_reprodutivo = 'VAZIA'
WHERE status_reprodutivo IS NULL;

-- Opcional: aplicar NOT NULL após validação
-- ALTER TABLE public.receptoras
--   ALTER COLUMN status_reprodutivo SET NOT NULL;
