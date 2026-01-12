-- ============================================================
-- Fix: RPC mover_receptora_fazenda com remoção de protocolo
-- ============================================================
-- Objetivo: Quando receptora é movida durante sincronização,
--           remover do protocolo original e adicionar a protocolo
--           equivalente na nova fazenda (se existir)
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
    v_protocolo_original_id UUID;
    v_protocolo_original_status TEXT;
    v_protocolo_receptora_id UUID;
    v_protocolo_receptora_status TEXT;
    v_protocolo_destino_id UUID;
    v_ciclando_classificacao TEXT;
    v_qualidade_semaforo SMALLINT;
    v_data_inclusao DATE;
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
    SELECT identificacao INTO v_brinco_receptora
    FROM receptoras
    WHERE id = p_receptora_id;
    
    SELECT r.id INTO v_receptora_existente_id
    FROM receptoras r
    WHERE r.identificacao = v_brinco_receptora
      AND r.id != p_receptora_id
      AND r.fazenda_atual_id = p_nova_fazenda_id
    LIMIT 1;
    
    IF v_receptora_existente_id IS NOT NULL THEN
        RAISE EXCEPTION 'Já existe uma receptora com o brinco % na fazenda de destino. Não é possível mover esta receptora.', v_brinco_receptora;
    END IF;
    
    -- 3. Verificar se a receptora está em um protocolo ativo (não fechado)
    SELECT 
        pr.protocolo_id,
        pr.id,
        pr.status,
        ps.status as protocolo_status,
        pr.ciclando_classificacao,
        pr.qualidade_semaforo,
        pr.data_inclusao
    INTO 
        v_protocolo_original_id,
        v_protocolo_receptora_id,
        v_protocolo_receptora_status,
        v_protocolo_original_status,
        v_ciclando_classificacao,
        v_qualidade_semaforo,
        v_data_inclusao
    FROM protocolo_receptoras pr
    INNER JOIN protocolos_sincronizacao ps ON pr.protocolo_id = ps.id
    WHERE pr.receptora_id = p_receptora_id
      AND ps.status != 'PASSO2_FECHADO'  -- Apenas protocolos não fechados
      AND pr.status NOT IN ('INAPTA', 'DESCARTADA')  -- Apenas receptoras ativas no protocolo
    ORDER BY ps.data_inicio DESC
    LIMIT 1;
    
    -- 4. Fechar vínculo atual no histórico
    UPDATE receptora_fazenda_historico
    SET data_fim = p_data_mudanca - INTERVAL '1 day',
        updated_at = NOW()
    WHERE receptora_id = p_receptora_id
      AND data_fim IS NULL;
    
    -- 5. Inserir novo vínculo no histórico
    INSERT INTO receptora_fazenda_historico (receptora_id, fazenda_id, data_inicio, observacoes)
    VALUES (p_receptora_id, p_nova_fazenda_id, p_data_mudanca, p_observacoes)
    RETURNING id INTO v_historico_id;
    
    -- 6. Atualizar receptoras.fazenda_atual_id
    BEGIN
        UPDATE receptoras
        SET fazenda_atual_id = p_nova_fazenda_id
        WHERE id = p_receptora_id;
    EXCEPTION
        WHEN unique_violation THEN
            DELETE FROM receptora_fazenda_historico WHERE id = v_historico_id;
            
            UPDATE receptora_fazenda_historico
            SET data_fim = NULL, updated_at = NOW()
            WHERE id = (
                SELECT id FROM receptora_fazenda_historico
                WHERE receptora_id = p_receptora_id
                  AND id != v_historico_id
                  AND data_fim = p_data_mudanca - INTERVAL '1 day'
                ORDER BY created_at DESC LIMIT 1
            );
            
            SELECT identificacao INTO v_brinco_receptora FROM receptoras WHERE id = p_receptora_id;
            RAISE EXCEPTION 'Já existe uma receptora com o brinco % na fazenda de destino. Não é possível mover esta receptora.', v_brinco_receptora;
    END;
    
    -- 7. Se a receptora estava em um protocolo ativo, processar migração
    IF v_protocolo_original_id IS NOT NULL THEN
        -- 7.1. Remover do protocolo original (deletar registro)
        DELETE FROM protocolo_receptoras
        WHERE id = v_protocolo_receptora_id;
        
        -- 7.2. Tentar encontrar protocolo equivalente na nova fazenda
        -- Buscar protocolo no mesmo estágio na nova fazenda
        SELECT id INTO v_protocolo_destino_id
        FROM protocolos_sincronizacao
        WHERE fazenda_id = p_nova_fazenda_id
          AND status = v_protocolo_original_status  -- Mesmo status do protocolo original
          AND id NOT IN (
              -- Excluir protocolos que já têm esta receptora
              SELECT protocolo_id FROM protocolo_receptoras WHERE receptora_id = p_receptora_id
          )
        ORDER BY data_inicio DESC
        LIMIT 1;
        
        -- 7.3. Se encontrou protocolo equivalente, adicionar a receptora
        IF v_protocolo_destino_id IS NOT NULL THEN
            INSERT INTO protocolo_receptoras (
                protocolo_id,
                receptora_id,
                evento_fazenda_id,
                data_inclusao,
                status,
                ciclando_classificacao,
                qualidade_semaforo
            )
            VALUES (
                v_protocolo_destino_id,
                p_receptora_id,
                p_nova_fazenda_id,  -- Nova fazenda onde ocorreu a inclusão
                COALESCE(v_data_inclusao, p_data_mudanca),
                v_protocolo_receptora_status,  -- Mesmo status que tinha no protocolo original
                v_ciclando_classificacao,
                v_qualidade_semaforo
            );
        END IF;
        -- Se não encontrou protocolo equivalente, a receptora simplesmente sai do protocolo original
        -- Ela não aparecerá em nenhum protocolo na nova fazenda até ser adicionada manualmente
    END IF;
    
    RETURN v_historico_id;
END;
$$;

COMMENT ON FUNCTION mover_receptora_fazenda IS 'Move uma receptora para uma nova fazenda. Se estiver em protocolo ativo, remove do protocolo original e tenta adicionar a protocolo equivalente na nova fazenda.';
