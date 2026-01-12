-- ============================================================
-- Fix: Corrigir RPC mover_receptora_fazenda (Versão 3 - Simplificada)
-- ============================================================
-- Objetivo: Versão mais simples que garante atomicidade
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
        -- Já está na fazenda de destino
        SELECT id INTO v_historico_id
        FROM receptora_fazenda_historico
        WHERE receptora_id = p_receptora_id
          AND fazenda_id = p_nova_fazenda_id
          AND data_fim IS NULL
        LIMIT 1;
        
        UPDATE receptoras SET fazenda_atual_id = p_nova_fazenda_id WHERE id = p_receptora_id;
        RETURN v_historico_id;
    END IF;
    
    -- 2. Fechar TODOS os vínculos ativos (sem WHERE, para garantir)
    UPDATE receptora_fazenda_historico
    SET data_fim = p_data_mudanca - INTERVAL '1 day',
        updated_at = NOW()
    WHERE receptora_id = p_receptora_id
      AND data_fim IS NULL;
    
    -- 3. Garantir que realmente fechou (fechar também registros que podem ter data_fim >= data_mudanca)
    UPDATE receptora_fazenda_historico
    SET data_fim = p_data_mudanca - INTERVAL '1 day',
        updated_at = NOW()
    WHERE receptora_id = p_receptora_id
      AND (data_fim IS NULL OR data_fim >= p_data_mudanca);
    
    -- 4. Inserir novo vínculo
    INSERT INTO receptora_fazenda_historico (receptora_id, fazenda_id, data_inicio, observacoes)
    VALUES (p_receptora_id, p_nova_fazenda_id, p_data_mudanca, p_observacoes)
    RETURNING id INTO v_historico_id;
    
    -- 5. Atualizar receptoras.fazenda_atual_id
    UPDATE receptoras
    SET fazenda_atual_id = p_nova_fazenda_id
    WHERE id = p_receptora_id;
    
    RETURN v_historico_id;
END;
$$;

COMMENT ON FUNCTION mover_receptora_fazenda IS 'Move uma receptora para uma nova fazenda. Versão simplificada v3.';
