-- ============================================================
-- Fix: Corrigir RPC mover_receptora_fazenda
-- ============================================================
-- Objetivo: Corrigir a função para evitar erro 409 (Conflict)
--           O problema é que o índice único parcial pode estar
--           impedindo o INSERT se o UPDATE não fechar o registro corretamente
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
BEGIN
    -- 1. Fechar TODOS os vínculos ativos (defensive - garante que não há nenhum ativo)
    UPDATE receptora_fazenda_historico
    SET data_fim = p_data_mudanca - INTERVAL '1 day',
        updated_at = NOW()
    WHERE receptora_id = p_receptora_id
      AND data_fim IS NULL;
    
    -- 2. Inserir novo vínculo (agora não deve haver conflito com índice único parcial)
    INSERT INTO receptora_fazenda_historico (receptora_id, fazenda_id, data_inicio, observacoes)
    VALUES (p_receptora_id, p_nova_fazenda_id, p_data_mudanca, p_observacoes)
    RETURNING id INTO v_historico_id;
    
    -- 3. (Opcional) Atualizar receptoras.fazenda_atual_id para manter compatibilidade temporária
    UPDATE receptoras
    SET fazenda_atual_id = p_nova_fazenda_id
    WHERE id = p_receptora_id;
    
    RETURN v_historico_id;
EXCEPTION
    WHEN unique_violation THEN
        -- Se ainda der erro de constraint única, pode ser que o UPDATE não funcionou
        -- Tentar novamente: fechar TODOS os registros ativos explicitamente
        UPDATE receptora_fazenda_historico
        SET data_fim = p_data_mudanca - INTERVAL '1 day',
            updated_at = NOW()
        WHERE receptora_id = p_receptora_id;
        
        -- Tentar inserir novamente
        INSERT INTO receptora_fazenda_historico (receptora_id, fazenda_id, data_inicio, observacoes)
        VALUES (p_receptora_id, p_nova_fazenda_id, p_data_mudanca, p_observacoes)
        RETURNING id INTO v_historico_id;
        
        -- Atualizar fazenda_atual_id
        UPDATE receptoras
        SET fazenda_atual_id = p_nova_fazenda_id
        WHERE id = p_receptora_id;
        
        RETURN v_historico_id;
    WHEN OTHERS THEN
        RAISE;
END;
$$;

-- Comentário na função
COMMENT ON FUNCTION mover_receptora_fazenda IS 'Move uma receptora para uma nova fazenda. Fecha o vínculo atual e abre um novo. NÃO afeta protocolos, ciclos ou histórico reprodutivo. Versão corrigida para evitar erro 409.';
