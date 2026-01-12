-- ============================================================
-- Fix: Corrigir RPC mover_receptora_fazenda (Versão 4 - Definitiva)
-- ============================================================
-- Objetivo: Versão que trata todos os casos possíveis
-- ============================================================

DROP FUNCTION IF EXISTS mover_receptora_fazenda(UUID, UUID, DATE, TEXT);
DROP FUNCTION IF EXISTS mover_receptora_fazenda CASCADE;

CREATE OR REPLACE FUNCTION mover_receptora_fazenda(
    p_receptora_id UUID,
    p_nova_fazenda_id UUID,
    p_data_mudanca DATE DEFAULT CURRENT_DATE,
    p_observacoes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_historico_id UUID;
    v_fazenda_atual_id UUID;
    v_registro_existe BOOLEAN;
BEGIN
    -- 1. Verificar se a receptora tem algum registro no histórico
    SELECT EXISTS(
        SELECT 1 FROM receptora_fazenda_historico 
        WHERE receptora_id = p_receptora_id
    ) INTO v_registro_existe;
    
    -- 2. Se NÃO tem registro, criar o primeiro
    IF NOT v_registro_existe THEN
        INSERT INTO receptora_fazenda_historico (receptora_id, fazenda_id, data_inicio, observacoes)
        VALUES (p_receptora_id, p_nova_fazenda_id, p_data_mudanca, p_observacoes)
        RETURNING id INTO v_historico_id;
        
        UPDATE receptoras SET fazenda_atual_id = p_nova_fazenda_id WHERE id = p_receptora_id;
        RETURN v_historico_id;
    END IF;
    
    -- 3. Se TEM registro, verificar fazenda atual
    SELECT fazenda_id INTO v_fazenda_atual_id
    FROM receptora_fazenda_historico
    WHERE receptora_id = p_receptora_id
      AND data_fim IS NULL
    LIMIT 1;
    
    -- 4. Se já está na fazenda de destino, retornar sucesso
    IF v_fazenda_atual_id = p_nova_fazenda_id THEN
        SELECT id INTO v_historico_id
        FROM receptora_fazenda_historico
        WHERE receptora_id = p_receptora_id
          AND fazenda_id = p_nova_fazenda_id
          AND data_fim IS NULL
        LIMIT 1;
        
        UPDATE receptoras SET fazenda_atual_id = p_nova_fazenda_id WHERE id = p_receptora_id;
        RETURN v_historico_id;
    END IF;
    
    -- 5. Fechar TODOS os registros ativos (pode haver múltiplos por erro)
    --    Usar CURRENT_DATE para garantir que fecha antes do novo
    UPDATE receptora_fazenda_historico
    SET data_fim = p_data_mudanca - INTERVAL '1 day',
        updated_at = NOW()
    WHERE receptora_id = p_receptora_id
      AND data_fim IS NULL;
    
    -- 6. Verificar se realmente fechou (defensive - garantir que não há nenhum ativo)
    PERFORM 1 FROM receptora_fazenda_historico
    WHERE receptora_id = p_receptora_id
      AND data_fim IS NULL;
    
    IF FOUND THEN
        -- Se ainda encontrou algum ativo, forçar fechamento de TODOS
        UPDATE receptora_fazenda_historico
        SET data_fim = p_data_mudanca - INTERVAL '2 days',
            updated_at = NOW()
        WHERE receptora_id = p_receptora_id
          AND data_fim IS NULL;
    END IF;
    
    -- 7. Inserir novo vínculo
    INSERT INTO receptora_fazenda_historico (receptora_id, fazenda_id, data_inicio, observacoes)
    VALUES (p_receptora_id, p_nova_fazenda_id, p_data_mudanca, p_observacoes)
    RETURNING id INTO v_historico_id;
    
    -- 8. Atualizar receptoras.fazenda_atual_id
    UPDATE receptoras
    SET fazenda_atual_id = p_nova_fazenda_id
    WHERE id = p_receptora_id;
    
    RETURN v_historico_id;
END;
$$;

COMMENT ON FUNCTION mover_receptora_fazenda IS 'Move uma receptora para uma nova fazenda. Versão definitiva v4 - trata todos os casos.';
