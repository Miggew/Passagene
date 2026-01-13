-- Adicionar campos de estado e classificação genética na tabela doadoras

DO $$
BEGIN
    -- Adicionar campo disponivel_aspiracao (boolean, padrão true)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'doadoras' 
        AND column_name = 'disponivel_aspiracao'
    ) THEN
        ALTER TABLE doadoras 
        ADD COLUMN disponivel_aspiracao BOOLEAN DEFAULT true;
        
        COMMENT ON COLUMN doadoras.disponivel_aspiracao IS 'Indica se a doadora está disponível para aspiração';
    END IF;

    -- Adicionar campo classificacao_genetica (text, opcional)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'doadoras' 
        AND column_name = 'classificacao_genetica'
    ) THEN
        ALTER TABLE doadoras 
        ADD COLUMN classificacao_genetica TEXT NULL 
        CHECK (classificacao_genetica IS NULL OR classificacao_genetica IN ('1_estrela', '2_estrelas', '3_estrelas', 'diamante'));
        
        COMMENT ON COLUMN doadoras.classificacao_genetica IS 'Classificação opcional do preço da genética: 1_estrela, 2_estrelas, 3_estrelas ou diamante';
    END IF;
END $$;
