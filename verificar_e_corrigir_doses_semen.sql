-- Script para verificar e corrigir a estrutura da tabela doses_semen
-- Execute este script para verificar se há problemas e corrigir

-- ============================================================
-- PASSO 1: Verificar estrutura atual da tabela doses_semen
-- ============================================================

-- Ver todas as colunas da tabela doses_semen
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'doses_semen'
ORDER BY ordinal_position;

-- ============================================================
-- PASSO 2: Verificar se touro_id existe
-- ============================================================

DO $$
BEGIN
    -- Verificar se a coluna touro_id existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'doses_semen' 
        AND column_name = 'touro_id'
    ) THEN
        RAISE NOTICE 'ERRO: A coluna touro_id NÃO existe na tabela doses_semen!';
        RAISE NOTICE 'Execute o script migrar_doses_semen_para_touros_limpo.sql primeiro.';
    ELSE
        RAISE NOTICE 'OK: A coluna touro_id existe.';
    END IF;
END $$;

-- ============================================================
-- PASSO 3: Verificar se há dados órfãos (doses sem touro_id)
-- ============================================================

SELECT COUNT(*) as doses_sem_touro
FROM doses_semen
WHERE touro_id IS NULL;

-- ============================================================
-- PASSO 4: Verificar se a tabela touros existe
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'touros'
    ) THEN
        RAISE NOTICE 'ERRO: A tabela touros NÃO existe!';
        RAISE NOTICE 'Execute o script criar_tabela_touros.sql primeiro.';
    ELSE
        RAISE NOTICE 'OK: A tabela touros existe.';
    END IF;
END $$;

-- ============================================================
-- PASSO 5: Verificar se há touros cadastrados
-- ============================================================

SELECT COUNT(*) as total_touros
FROM touros;

-- Se retornar 0, você precisa cadastrar touros primeiro!

-- ============================================================
-- SOLUÇÃO: Se touro_id não existe, execute:
-- ============================================================

-- Se a coluna touro_id NÃO existe, execute este bloco:
DO $$
BEGIN
    -- Verificar se a coluna touro_id não existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'doses_semen' 
        AND column_name = 'touro_id'
    ) THEN
        -- Adicionar coluna touro_id (permitir NULL temporariamente se houver dados)
        ALTER TABLE public.doses_semen 
        ADD COLUMN touro_id UUID REFERENCES public.touros(id) ON DELETE RESTRICT;
        
        RAISE NOTICE 'Coluna touro_id adicionada (permitindo NULL temporariamente).';
        RAISE NOTICE 'IMPORTANTE: Você precisa atualizar as doses existentes para vincular a um touro_id.';
        RAISE NOTICE 'Depois disso, você pode tornar o campo obrigatório com:';
        RAISE NOTICE 'ALTER TABLE public.doses_semen ALTER COLUMN touro_id SET NOT NULL;';
    ELSE
        RAISE NOTICE 'Coluna touro_id já existe.';
    END IF;
END $$;

-- ============================================================
-- Verificar foreign key constraints
-- ============================================================

SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name = 'doses_semen';
