-- ============================================================
-- Atualizar RPC mover_receptora_fazenda
-- Remove validação de conflito de brinco (frontend já trata)
-- Usa view vw_receptoras_fazenda_atual ao invés de fazenda_atual_id obsoleto
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
    v_protocolo_original_id UUID;
    v_protocolo_original_status TEXT;
    v_protocolo_original_data_inicio DATE;
    v_protocolo_original_responsavel TEXT;
    v_protocolo_receptora_id UUID;
    v_protocolo_receptora_status TEXT;
    v_protocolo_destino_id UUID;
    v_ciclando_classificacao TEXT;
    v_qualidade_semaforo SMALLINT;
    v_data_inclusao DATE;
    v_observacoes_protocolo TEXT;
    v_novo_protocolo_id UUID;
    v_count_receptoras_restantes INTEGER;
    v_protocolo_sera_deletado BOOLEAN;
    v_protocolo_origem_id_para_inserir UUID;
BEGIN
    -- 1. Verificar se já está na fazenda de destino usando view (fonte de verdade)
    SELECT fazenda_id_atual INTO v_fazenda_atual_id
    FROM vw_receptoras_fazenda_atual
    WHERE receptora_id = p_receptora_id
    LIMIT 1;
    
    IF v_fazenda_atual_id = p_nova_fazenda_id THEN
        SELECT id INTO v_historico_id
        FROM receptora_fazenda_historico
        WHERE receptora_id = p_receptora_id
          AND fazenda_id = p_nova_fazenda_id
          AND data_fim IS NULL
        LIMIT 1;
        RETURN v_historico_id;
    END IF;
    
    -- 2. NOTA: Validação de conflito de brinco foi REMOVIDA
    --    O frontend já trata isso renomeando a receptora ANTES de chamar esta RPC
    --    Se houver conflito, o frontend renomeia automaticamente com sufixo -MOV + data
    
    -- 3. Verificar se a receptora está em um protocolo ativo (não fechado)
    SELECT 
        pr.protocolo_id,
        pr.id,
        pr.status,
        ps.status as protocolo_status,
        ps.data_inicio,
        ps.responsavel_inicio,
        ps.observacoes,
        pr.ciclando_classificacao,
        pr.qualidade_semaforo,
        pr.data_inclusao
    INTO 
        v_protocolo_original_id,
        v_protocolo_receptora_id,
        v_protocolo_receptora_status,
        v_protocolo_original_status,
        v_protocolo_original_data_inicio,
        v_protocolo_original_responsavel,
        v_observacoes_protocolo,
        v_ciclando_classificacao,
        v_qualidade_semaforo,
        v_data_inclusao
    FROM protocolo_receptoras pr
    INNER JOIN protocolos_sincronizacao ps ON pr.protocolo_id = ps.id
    WHERE pr.receptora_id = p_receptora_id
      AND ps.status != 'FECHADO'  -- Atualizado: FECHADO ao invés de PASSO2_FECHADO
      AND ps.status != 'SINCRONIZADO'  -- SINCRONIZADO também não é ativo (já finalizado)
      AND pr.status NOT IN ('INAPTA', 'DESCARTADA', 'UTILIZADA')  -- UTILIZADA também não é ativa
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
    
    -- 6. REMOVIDO: Atualização de fazenda_atual_id (campo obsoleto)
    --    O sistema agora usa apenas receptora_fazenda_historico como fonte de verdade
    
    -- 7. Se a receptora estava em um protocolo ativo, processar migração
    IF v_protocolo_original_id IS NOT NULL THEN
        -- 7.1. Remover do protocolo original (deletar registro)
        DELETE FROM protocolo_receptoras
        WHERE id = v_protocolo_receptora_id;
        
        -- 7.2. Verificar quantas receptoras restam no protocolo original
        SELECT COUNT(*) INTO v_count_receptoras_restantes
        FROM protocolo_receptoras
        WHERE protocolo_id = v_protocolo_original_id;
        
        -- 7.3. Tentar encontrar protocolo "espelho" na nova fazenda ANTES de deletar o original
        -- Um protocolo "espelho" tem o mesmo protocolo_origem_id e mesmo status
        SELECT id INTO v_protocolo_destino_id
        FROM protocolos_sincronizacao
        WHERE fazenda_id = p_nova_fazenda_id
          AND status = v_protocolo_original_status
          AND protocolo_origem_id = v_protocolo_original_id  -- Mesmo protocolo original
          AND id NOT IN (
              SELECT protocolo_id FROM protocolo_receptoras WHERE receptora_id = p_receptora_id
          )
        ORDER BY data_inicio DESC
        LIMIT 1;
        
        -- 7.4. Se não encontrou protocolo "espelho", criar um novo
        -- IMPORTANTE: Se o protocolo original vai ser deletado, usar NULL para protocolo_origem_id
        -- para evitar violação de foreign key
        IF v_protocolo_destino_id IS NULL THEN
            -- Determinar se o protocolo original será deletado
            -- Atualizado: protocolos FECHADO ou SINCRONIZADO não devem ser deletados
            v_protocolo_sera_deletado := (
                v_count_receptoras_restantes = 0 
                AND v_protocolo_original_status NOT IN ('FECHADO', 'SINCRONIZADO', 'PASSO2_FECHADO')
            );
            
            IF v_protocolo_sera_deletado THEN
                -- Se vai deletar, usar NULL para evitar FK constraint violation
                v_protocolo_origem_id_para_inserir := NULL;
            ELSE
                -- Se não vai deletar, usar o ID do protocolo original
                v_protocolo_origem_id_para_inserir := v_protocolo_original_id;
            END IF;
            
            INSERT INTO protocolos_sincronizacao (
                fazenda_id,
                data_inicio,
                responsavel_inicio,
                status,
                observacoes,
                protocolo_origem_id  -- NULL se original será deletado, senão ID do original
            )
            VALUES (
                p_nova_fazenda_id,
                COALESCE(v_protocolo_original_data_inicio, p_data_mudanca),
                v_protocolo_original_responsavel,
                v_protocolo_original_status,  -- Mesmo status do protocolo original
                COALESCE(v_observacoes_protocolo, 'Protocolo criado automaticamente ao mover receptora(s) entre fazendas'),
                v_protocolo_origem_id_para_inserir
            )
            RETURNING id INTO v_novo_protocolo_id;
            
            v_protocolo_destino_id := v_novo_protocolo_id;
        END IF;
        
        -- 7.5. AGORA podemos deletar o protocolo original se ficou vazio
        -- (depois de criar o protocolo espelho para evitar FK constraint violation)
        -- Atualizado: não deletar protocolos FECHADO ou SINCRONIZADO
        IF v_count_receptoras_restantes = 0 
           AND v_protocolo_original_status NOT IN ('FECHADO', 'SINCRONIZADO', 'PASSO2_FECHADO') THEN
            DELETE FROM protocolos_sincronizacao
            WHERE id = v_protocolo_original_id;
        END IF;
        
        -- 7.6. Adicionar receptora ao protocolo destino (ou recém-criado, ou existente)
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
            p_nova_fazenda_id,
            COALESCE(v_data_inclusao, p_data_mudanca),
            v_protocolo_receptora_status,  -- Mesmo status que tinha no protocolo original
            v_ciclando_classificacao,
            v_qualidade_semaforo
        );
    END IF;
    
    RETURN v_historico_id;
END;
$$;

COMMENT ON FUNCTION mover_receptora_fazenda IS 'Move uma receptora para uma nova fazenda. O frontend já trata renomeação automática em caso de conflito de brinco. Se estiver em protocolo ativo, remove do protocolo original e adiciona a protocolo equivalente na nova fazenda, agrupando receptoras do mesmo protocolo original no mesmo protocolo destino. Se o protocolo original ficar sem receptoras e não estiver finalizado (FECHADO/SINCRONIZADO), deleta o protocolo automaticamente.';
