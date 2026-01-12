-- ============================================================
-- Fix: Atualizar RPC criar_protocolo_passo1_atomico
-- ============================================================
-- Objetivo: Atualizar a RPC para usar evento_fazenda_id 
--           ao invés de fazenda_atual_id (coluna renomeada)
-- ============================================================

-- Verificar se a coluna foi renomeada
DO $$
BEGIN
    -- Se a coluna evento_fazenda_id existe, a RPC precisa ser atualizada
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'protocolo_receptoras' 
        AND column_name = 'evento_fazenda_id'
    ) THEN
        RAISE NOTICE 'Coluna evento_fazenda_id encontrada. RPC precisa ser atualizada.';
        RAISE NOTICE 'Execute manualmente o ALTER FUNCTION ou recrie a RPC.';
    ELSE
        RAISE NOTICE 'Coluna evento_fazenda_id não encontrada. Nenhuma ação necessária.';
    END IF;
END $$;

-- NOTA: Para atualizar a RPC, você precisa:
-- 1. Ver a definição atual: \df+ criar_protocolo_passo1_atomico (no psql)
-- 2. Recriar a função substituindo fazenda_atual_id por evento_fazenda_id
-- 3. Ou simplesmente remover o parâmetro p_fazenda_atual_id se não for mais necessário

-- Alternativa: Se a RPC ainda usa fazenda_atual_id, podemos temporariamente
-- criar uma coluna compatibilidade ou ajustar a RPC para não usar essa coluna
-- (já que ela é apenas para auditoria)
