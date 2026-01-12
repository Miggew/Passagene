-- ============================================================
-- Fix: Remover constraint ux_hist_receptora_ativa conflitante
-- ============================================================
-- Objetivo: Remover constraint/índice conflitante que está
--           impedindo a inserção (causando erro 409)
-- ============================================================

-- 1. Remover constraint se existir
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'ux_hist_receptora_ativa'
    ) THEN
        ALTER TABLE receptora_fazenda_historico 
        DROP CONSTRAINT IF EXISTS ux_hist_receptora_ativa CASCADE;
        
        RAISE NOTICE 'Constraint ux_hist_receptora_ativa removida';
    END IF;
END $$;

-- 2. Remover índice se existir (pode ter nome similar)
DROP INDEX IF EXISTS ux_hist_receptora_ativa CASCADE;
DROP INDEX IF EXISTS idx_receptora_fazenda_historico_receptora_ativo CASCADE;
DROP INDEX IF EXISTS idx_ux_hist_receptora_ativa CASCADE;

-- 3. Garantir que apenas o índice correto existe (o que criamos na migration)
--    Se não existir, criar
DROP INDEX IF EXISTS idx_receptora_fazenda_ativo;
CREATE UNIQUE INDEX IF NOT EXISTS idx_receptora_fazenda_ativo 
ON receptora_fazenda_historico (receptora_id) 
WHERE data_fim IS NULL;

-- 4. Verificar resultado
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'receptora_fazenda_historico'
  AND indexdef LIKE '%UNIQUE%'
ORDER BY indexname;
