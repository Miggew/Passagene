-- ============================================================
-- Fix: RPC mover_receptora_fazenda com validação de brinco
-- ============================================================
-- Objetivo: Adicionar validação para verificar se já existe
--           receptora com o mesmo brinco na fazenda de destino
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
    v_brinco_receptora TEXT;
    v_receptora_existente_id UUID;
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
    
    -- 2. VALIDAÇÃO: Verificar se já existe receptora com o mesmo brinco na fazenda de destino
    --    IMPORTANTE: A constraint ux_receptoras_brinco_por_fazenda valida (fazenda_atual_id, identificacao)
    --    Então precisamos verificar se já existe receptora com o mesmo brinco e fazenda_atual_id = p_nova_fazenda_id
    SELECT identificacao INTO v_brinco_receptora
    FROM receptoras
    WHERE id = p_receptora_id;
    
    -- Verificar se há outra receptora (diferente da que está sendo movida) 
    -- com o mesmo brinco na fazenda de destino (usando fazenda_atual_id da tabela receptoras)
    SELECT r.id INTO v_receptora_existente_id
    FROM receptoras r
    WHERE r.identificacao = v_brinco_receptora
      AND r.id != p_receptora_id  -- Diferente da receptora que está sendo movida
      AND r.fazenda_atual_id = p_nova_fazenda_id  -- Já está na fazenda de destino
    LIMIT 1;
    
    IF v_receptora_existente_id IS NOT NULL THEN
        RAISE EXCEPTION 'Já existe uma receptora com o brinco % na fazenda de destino. Não é possível mover esta receptora.', v_brinco_receptora;
    END IF;
    
    -- 3. Fechar vínculo atual
    UPDATE receptora_fazenda_historico
    SET data_fim = p_data_mudanca - INTERVAL '1 day',
        updated_at = NOW()
    WHERE receptora_id = p_receptora_id
      AND data_fim IS NULL;
    
    -- 4. Inserir novo vínculo
    INSERT INTO receptora_fazenda_historico (receptora_id, fazenda_id, data_inicio, observacoes)
    VALUES (p_receptora_id, p_nova_fazenda_id, p_data_mudanca, p_observacoes)
    RETURNING id INTO v_historico_id;
    
    -- 5. Atualizar receptoras.fazenda_atual_id
    --    IMPORTANTE: Fazer isso POR ÚLTIMO, pois pode violar constraint ux_receptoras_brinco_por_fazenda
    --    Se der erro, o histórico já foi atualizado, então precisamos reverter
    BEGIN
        UPDATE receptoras
        SET fazenda_atual_id = p_nova_fazenda_id
        WHERE id = p_receptora_id;
    EXCEPTION
        WHEN unique_violation THEN
            -- Se deu erro de constraint única, reverter a mudança no histórico
            -- Primeiro, deletar o registro que acabamos de criar
            DELETE FROM receptora_fazenda_historico
            WHERE id = v_historico_id;
            
            -- Restaurar vínculo anterior (o mais recente que foi fechado)
            UPDATE receptora_fazenda_historico
            SET data_fim = NULL,
                updated_at = NOW()
            WHERE id = (
                SELECT id
                FROM receptora_fazenda_historico
                WHERE receptora_id = p_receptora_id
                  AND id != v_historico_id
                  AND data_fim = p_data_mudanca - INTERVAL '1 day'
                ORDER BY created_at DESC
                LIMIT 1
            );
            
            -- Lançar erro claro
            SELECT identificacao INTO v_brinco_receptora
            FROM receptoras
            WHERE id = p_receptora_id;
            
            RAISE EXCEPTION 'Já existe uma receptora com o brinco % na fazenda de destino. Não é possível mover esta receptora.', v_brinco_receptora;
    END;
    
    RETURN v_historico_id;
END;
$$;

COMMENT ON FUNCTION mover_receptora_fazenda IS 'Move uma receptora para uma nova fazenda. Valida se já existe receptora com o mesmo brinco na fazenda de destino. Versão com validação.';
