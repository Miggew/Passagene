-- ============================================================
-- Corrigir constraint NOT NULL da coluna partida
-- ============================================================
-- Objetivo: Tornar a coluna partida nullable para permitir valores NULL
-- ============================================================

-- Tornar a coluna partida nullable
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'doses_semen' AND column_name = 'partida') THEN
        ALTER TABLE doses_semen ALTER COLUMN partida DROP NOT NULL;
        RAISE NOTICE 'Constraint NOT NULL removida da coluna partida.';
    ELSE
        RAISE NOTICE 'Coluna partida não existe.';
    END IF;
END $$;

COMMENT ON COLUMN doses_semen.partida IS 'Campo partida (mantido para compatibilidade, pode ser NULL)';
