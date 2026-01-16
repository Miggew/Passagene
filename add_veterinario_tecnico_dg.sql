-- Migration: Adicionar campos veterinario_responsavel e tecnico_responsavel na tabela diagnosticos_gestacao
-- Estes campos armazenam quem fez o DG, separado de quem fez a TE

-- Adicionar campo veterinario_responsavel se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'diagnosticos_gestacao' 
        AND column_name = 'veterinario_responsavel'
    ) THEN
        ALTER TABLE diagnosticos_gestacao 
        ADD COLUMN veterinario_responsavel VARCHAR(255);
        
        COMMENT ON COLUMN diagnosticos_gestacao.veterinario_responsavel IS 
        'Veterinário responsável pelo diagnóstico de gestação (DG) - diferente do veterinário da TE';
    END IF;
END $$;

-- Adicionar campo tecnico_responsavel se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'diagnosticos_gestacao' 
        AND column_name = 'tecnico_responsavel'
    ) THEN
        ALTER TABLE diagnosticos_gestacao 
        ADD COLUMN tecnico_responsavel VARCHAR(255);
        
        COMMENT ON COLUMN diagnosticos_gestacao.tecnico_responsavel IS 
        'Técnico responsável pelo diagnóstico de gestação (DG) - diferente do técnico da TE';
    END IF;
END $$;
