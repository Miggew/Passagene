-- ============================================================
-- Fix: Remover constraint NOT NULL de classificações
-- ============================================================
-- Objetivo: Tornar ciclando_classificacao e qualidade_semaforo
--           nullable (opcional) em protocolo_receptoras
-- ============================================================

-- 1. Verificar estado atual das colunas
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'protocolo_receptoras'
  AND column_name IN ('ciclando_classificacao', 'qualidade_semaforo')
ORDER BY column_name;

-- 2. Remover constraint NOT NULL de ciclando_classificacao (se existir)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'protocolo_receptoras'
        AND column_name = 'ciclando_classificacao'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE protocolo_receptoras 
        ALTER COLUMN ciclando_classificacao DROP NOT NULL;
        
        RAISE NOTICE 'Constraint NOT NULL removida de protocolo_receptoras.ciclando_classificacao';
    ELSE
        RAISE NOTICE 'Coluna ciclando_classificacao já é nullable';
    END IF;
END $$;

-- 3. Remover constraint NOT NULL de qualidade_semaforo (se existir)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'protocolo_receptoras'
        AND column_name = 'qualidade_semaforo'
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE protocolo_receptoras 
        ALTER COLUMN qualidade_semaforo DROP NOT NULL;
        
        RAISE NOTICE 'Constraint NOT NULL removida de protocolo_receptoras.qualidade_semaforo';
    ELSE
        RAISE NOTICE 'Coluna qualidade_semaforo já é nullable';
    END IF;
END $$;

-- 4. Verificar resultado final
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'protocolo_receptoras'
  AND column_name IN ('ciclando_classificacao', 'qualidade_semaforo')
ORDER BY column_name;
