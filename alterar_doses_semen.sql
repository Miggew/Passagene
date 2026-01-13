-- ============================================================
-- Alterar estrutura da tabela doses_semen
-- ============================================================
-- Objetivo: Adicionar campo de quantidade
-- ============================================================

-- Adicionar campo de quantidade
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'doses_semen' AND column_name = 'quantidade') THEN
        ALTER TABLE doses_semen ADD COLUMN quantidade INTEGER DEFAULT 0;
        COMMENT ON COLUMN doses_semen.quantidade IS 'Quantidade de doses de sêmen';
        RAISE NOTICE 'Coluna quantidade adicionada à tabela doses_semen.';
    ELSE
        RAISE NOTICE 'Coluna quantidade já existe.';
    END IF;
END $$;

-- Tornar a coluna partida nullable (se existir)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'doses_semen' AND column_name = 'partida') THEN
        ALTER TABLE doses_semen ALTER COLUMN partida DROP NOT NULL;
        RAISE NOTICE 'Constraint NOT NULL removida da coluna partida.';
    END IF;
END $$;

-- A coluna partida será mantida por compatibilidade, mas pode ser removida manualmente se desejado
-- Para remover: ALTER TABLE doses_semen DROP COLUMN IF EXISTS partida;

COMMENT ON TABLE doses_semen IS 'Tabela de doses de sêmen disponíveis';
