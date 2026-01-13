-- ============================================================
-- Tornar data_fecundacao nullable na tabela lotes_fiv
-- ============================================================
-- O campo data_fecundacao não é mais obrigatório na nova estrutura
-- ============================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'lotes_fiv'
          AND column_name = 'data_fecundacao'
          AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE lotes_fiv ALTER COLUMN data_fecundacao DROP NOT NULL;
        RAISE NOTICE 'Coluna data_fecundacao tornada nullable.';
    ELSE
        RAISE NOTICE 'Coluna data_fecundacao já é nullable ou não existe.';
    END IF;
END $$;
