-- ============================================================
-- Fix: Corrigir RPC mover_receptora_fazenda (VERSÃO FINAL)
-- ============================================================
-- Objetivo: Usar abordagem mais direta - deletar e recriar
--           se necessário, ou usar um único UPDATE quando possível
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
BEGIN
    -- 1. Verificar se já está na fazenda de destino
    SELECT fazenda_id INTO v_fazenda_atual_id
    FROM receptora_fazenda_historico
    WHERE receptora_id = p_receptora_id
      AND data_fim IS NULL
    LIMIT 1;
    
    IF v_fazenda_atual_id = p_nova_fazenda_id THEN
        -- Já está na fazenda de destino - retornar o registro atual
        SELECT id INTO v_historico_id
        FROM receptora_fazenda_historico
        WHERE receptora_id = p_receptora_id
          AND fazenda_id = p_nova_fazenda_id
          AND data_fim IS NULL
        LIMIT 1;
        
        UPDATE receptoras SET fazenda_atual_id = p_nova_fazenda_id WHERE id = p_receptora_id;
        RETURN v_historico_id;
    END IF;
    
    -- 2. Fechar vínculo atual usando uma abordagem mais agressiva
    --    Fechar TODOS os registros onde data_fim é NULL
    UPDATE receptora_fazenda_historico
    SET data_fim = p_data_mudanca - INTERVAL '1 day',
        updated_at = NOW()
    WHERE receptora_id = p_receptora_id
      AND data_fim IS NULL;
    
    -- 3. Inserir novo vínculo
    --    Se ainda der erro 409, significa que o UPDATE acima não funcionou
    --    Nesse caso, a exceção será lançada e o usuário precisa verificar os dados
    BEGIN
        INSERT INTO receptora_fazenda_historico (receptora_id, fazenda_id, data_inicio, observacoes)
        VALUES (p_receptora_id, p_nova_fazenda_id, p_data_mudanca, p_observacoes)
        RETURNING id INTO v_historico_id;
    EXCEPTION
        WHEN unique_violation THEN
            -- Se ainda deu erro, pode haver um problema com os dados
            -- Tentar uma última vez: forçar fechamento e inserir
            UPDATE receptora_fazenda_historico
            SET data_fim = p_data_mudanca - INTERVAL '2 days',
                updated_at = NOW()
            WHERE receptora_id = p_receptora_id;
            
            INSERT INTO receptora_fazenda_historico (receptora_id, fazenda_id, data_inicio, observacoes)
            VALUES (p_receptora_id, p_nova_fazenda_id, p_data_mudanca, p_observacoes)
            RETURNING id INTO v_historico_id;
    END;
    
    -- 4. Atualizar receptoras.fazenda_atual_id
    UPDATE receptoras
    SET fazenda_atual_id = p_nova_fazenda_id
    WHERE id = p_receptora_id;
    
    RETURN v_historico_id;
END;
$$;

COMMENT ON FUNCTION mover_receptora_fazenda IS 'Move uma receptora para uma nova fazenda. Versão FINAL com tratamento de exceção.';
