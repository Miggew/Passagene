-- ============================================================
-- Fix: Corrigir RPC mover_receptora_fazenda (Versão 2)
-- ============================================================
-- Objetivo: Corrigir erro 409 (Conflict) - versão mais robusta
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
    -- 1. Verificar se já está na fazenda de destino (se sim, retornar sucesso)
    SELECT fazenda_id INTO v_fazenda_atual_id
    FROM receptora_fazenda_historico
    WHERE receptora_id = p_receptora_id
      AND data_fim IS NULL
    LIMIT 1;
    
    -- Se já está na fazenda de destino, retornar o ID do registro atual
    IF v_fazenda_atual_id = p_nova_fazenda_id THEN
        SELECT id INTO v_historico_id
        FROM receptora_fazenda_historico
        WHERE receptora_id = p_receptora_id
          AND fazenda_id = p_nova_fazenda_id
          AND data_fim IS NULL
        LIMIT 1;
        
        -- Atualizar fazenda_atual_id para manter sincronizado
        UPDATE receptoras
        SET fazenda_atual_id = p_nova_fazenda_id
        WHERE id = p_receptora_id;
        
        RETURN v_historico_id;
    END IF;
    
    -- 2. Fechar TODOS os vínculos ativos (garantir que não há nenhum ativo)
    --    Usar uma data anterior para garantir que fecha antes do novo vínculo
    UPDATE receptora_fazenda_historico
    SET data_fim = p_data_mudanca - INTERVAL '1 day',
        updated_at = NOW()
    WHERE receptora_id = p_receptora_id
      AND data_fim IS NULL;
    
    -- 3. Verificar se realmente fechou (defensive check)
    --    Se ainda houver registros ativos, forçar fechamento
    PERFORM 1 FROM receptora_fazenda_historico
    WHERE receptora_id = p_receptora_id
      AND data_fim IS NULL
    LIMIT 1;
    
    IF FOUND THEN
        -- Forçar fechamento de TODOS os registros (sem WHERE data_fim IS NULL)
        UPDATE receptora_fazenda_historico
        SET data_fim = p_data_mudanca - INTERVAL '1 day',
            updated_at = NOW()
        WHERE receptora_id = p_receptora_id
          AND (data_fim IS NULL OR data_fim >= p_data_mudanca);
    END IF;
    
    -- 4. Inserir novo vínculo
    INSERT INTO receptora_fazenda_historico (receptora_id, fazenda_id, data_inicio, observacoes)
    VALUES (p_receptora_id, p_nova_fazenda_id, p_data_mudanca, p_observacoes)
    RETURNING id INTO v_historico_id;
    
    -- 5. Atualizar receptoras.fazenda_atual_id para manter compatibilidade temporária
    UPDATE receptoras
    SET fazenda_atual_id = p_nova_fazenda_id
    WHERE id = p_receptora_id;
    
    RETURN v_historico_id;
EXCEPTION
    WHEN unique_violation THEN
        -- Se ainda der erro 409, pode haver um problema com o índice único parcial
        -- Tentar uma última vez: deletar todos os registros ativos e inserir novo
        -- (Não deveria acontecer, mas por segurança)
        RAISE EXCEPTION 'Erro ao mover receptora: há um vínculo ativo que não pôde ser fechado. Verifique os dados no banco.';
    WHEN OTHERS THEN
        RAISE;
END;
$$;

-- Comentário na função
COMMENT ON FUNCTION mover_receptora_fazenda IS 'Move uma receptora para uma nova fazenda. Fecha o vínculo atual e abre um novo. NÃO afeta protocolos, ciclos ou histórico reprodutivo. Versão corrigida v2.';
