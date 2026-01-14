-- ============================================================
-- FIX: Corrigir constraint de status_atual na tabela embrioes
-- ============================================================
-- O erro indica que a constraint embrioes_status_atual_chk existe
-- mas não aceita o valor 'FRESCO'. Este script corrige isso.
-- ============================================================

-- Remover TODAS as constraints de check do campo status_atual
DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  -- Buscar todas as constraints CHECK da tabela embrioes relacionadas a status_atual
  FOR constraint_record IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'embrioes'::regclass
    AND contype = 'c'
    AND (conname LIKE '%status%' OR conname LIKE '%embrioes%status%')
  LOOP
    EXECUTE 'ALTER TABLE embrioes DROP CONSTRAINT IF EXISTS ' || quote_ident(constraint_record.conname);
  END LOOP;
END $$;

-- Adicionar constraint correta que aceita FRESCO
ALTER TABLE embrioes 
ADD CONSTRAINT check_embrioes_status 
CHECK (status_atual IN ('FRESCO', 'CONGELADO', 'TRANSFERIDO', 'DESCARTADO'));

COMMENT ON CONSTRAINT check_embrioes_status ON embrioes IS 'Valores permitidos para status_atual: FRESCO, CONGELADO, TRANSFERIDO, DESCARTADO';
