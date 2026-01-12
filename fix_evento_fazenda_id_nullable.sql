-- ============================================================
-- Fix: Tornar evento_fazenda_id NULLABLE
-- ============================================================
-- Objetivo: Remover constraint NOT NULL de evento_fazenda_id
--           já que esta coluna é opcional (apenas para auditoria)
-- ============================================================

-- Verificar se a coluna existe e remover NOT NULL se houver
DO $$
BEGIN
    -- Verificar se evento_fazenda_id existe e tem constraint NOT NULL
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'protocolo_receptoras' 
        AND column_name = 'evento_fazenda_id'
        AND is_nullable = 'NO'
    ) THEN
        -- Tornar a coluna nullable (remover NOT NULL)
        ALTER TABLE protocolo_receptoras 
        ALTER COLUMN evento_fazenda_id DROP NOT NULL;
        
        RAISE NOTICE 'Constraint NOT NULL removida de evento_fazenda_id em protocolo_receptoras';
    ELSE
        RAISE NOTICE 'Coluna evento_fazenda_id não encontrada ou já é nullable';
    END IF;
END $$;

-- Verificar também transferencias_embrioes (se existir)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'transferencias_embrioes' 
        AND column_name = 'evento_fazenda_id'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE transferencias_embrioes 
        ALTER COLUMN evento_fazenda_id DROP NOT NULL;
        
        RAISE NOTICE 'Constraint NOT NULL removida de evento_fazenda_id em transferencias_embrioes';
    END IF;
END $$;
