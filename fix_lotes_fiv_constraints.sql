-- ============================================================
-- CORRIGIR CONSTRAINTS E COLUNAS NA TABELA lotes_fiv
-- ============================================================
-- Este script garante que a tabela lotes_fiv tenha todas as colunas necessárias
-- e que as colunas antigas sejam tornadas opcionais
-- ============================================================

-- 1. Tornar aspiracao_id nullable (se ainda não for)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'lotes_fiv'
          AND column_name = 'aspiracao_id'
          AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE lotes_fiv ALTER COLUMN aspiracao_id DROP NOT NULL;
        RAISE NOTICE 'Coluna aspiracao_id tornada nullable.';
    END IF;
END $$;

-- 2. Tornar dose_semen_id nullable (se ainda não for)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'lotes_fiv'
          AND column_name = 'dose_semen_id'
          AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE lotes_fiv ALTER COLUMN dose_semen_id DROP NOT NULL;
        RAISE NOTICE 'Coluna dose_semen_id tornada nullable.';
    END IF;
END $$;

-- 2.1. Tornar data_fecundacao nullable (se ainda não for)
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
    END IF;
END $$;

-- 3. Garantir que pacote_aspiracao_id existe
DO $$
BEGIN
    -- Verificar se a tabela pacotes_aspiracao existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'pacotes_aspiracao'
    ) THEN
        RAISE NOTICE 'AVISO: Tabela pacotes_aspiracao não existe. Pulando criação de pacote_aspiracao_id.';
    ELSIF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'lotes_fiv'
          AND column_name = 'pacote_aspiracao_id'
    ) THEN
        ALTER TABLE lotes_fiv ADD COLUMN pacote_aspiracao_id UUID;
        
        -- Adicionar constraint de foreign key apenas se a tabela referenciada existir
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name = 'pacotes_aspiracao'
        ) THEN
            ALTER TABLE lotes_fiv 
            ADD CONSTRAINT fk_lotes_fiv_pacote_aspiracao 
            FOREIGN KEY (pacote_aspiracao_id) REFERENCES pacotes_aspiracao(id) ON DELETE RESTRICT;
        END IF;
        
        COMMENT ON COLUMN lotes_fiv.pacote_aspiracao_id IS 'ID do pacote de aspiração ao qual este lote pertence';
        RAISE NOTICE 'Coluna pacote_aspiracao_id adicionada.';
    ELSE
        RAISE NOTICE 'Coluna pacote_aspiracao_id já existe.';
    END IF;
END $$;

-- 4. Garantir que data_abertura existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'lotes_fiv'
          AND column_name = 'data_abertura'
    ) THEN
        ALTER TABLE lotes_fiv ADD COLUMN data_abertura DATE;
        COMMENT ON COLUMN lotes_fiv.data_abertura IS 'Data de abertura do lote (data do pacote + 1 dia)';
        RAISE NOTICE 'Coluna data_abertura adicionada.';
    ELSE
        RAISE NOTICE 'Coluna data_abertura já existe.';
    END IF;
END $$;

-- 5. Garantir que status existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'lotes_fiv'
          AND column_name = 'status'
    ) THEN
        -- Primeiro adicionar a coluna
        ALTER TABLE lotes_fiv ADD COLUMN status TEXT DEFAULT 'ABERTO';
        
        -- Depois adicionar a constraint CHECK separadamente
        BEGIN
            ALTER TABLE lotes_fiv ADD CONSTRAINT check_lotes_fiv_status 
            CHECK (status IN ('ABERTO', 'FECHADO'));
        EXCEPTION WHEN duplicate_object THEN
            RAISE NOTICE 'Constraint check_lotes_fiv_status já existe.';
        END;
        
        COMMENT ON COLUMN lotes_fiv.status IS 'Status do lote: ABERTO ou FECHADO';
        RAISE NOTICE 'Coluna status adicionada.';
    ELSE
        -- Se a coluna já existe, verificar se a constraint existe
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_schema = 'public'
              AND table_name = 'lotes_fiv'
              AND constraint_name = 'check_lotes_fiv_status'
        ) THEN
            BEGIN
                ALTER TABLE lotes_fiv ADD CONSTRAINT check_lotes_fiv_status 
                CHECK (status IN ('ABERTO', 'FECHADO'));
                RAISE NOTICE 'Constraint check_lotes_fiv_status adicionada.';
            EXCEPTION WHEN duplicate_object THEN
                RAISE NOTICE 'Constraint check_lotes_fiv_status já existe com outro nome.';
            END;
        END IF;
        RAISE NOTICE 'Coluna status já existe.';
    END IF;
END $$;

-- Verificação final
SELECT 'Verificação concluída. Estrutura da tabela lotes_fiv:' AS mensagem;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'lotes_fiv'
ORDER BY ordinal_position;
