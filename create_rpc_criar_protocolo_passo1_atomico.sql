-- ============================================================
-- Criar RPC: criar_protocolo_passo1_atomico
-- ============================================================
-- Objetivo: Criar protocolo e vincular receptoras em uma única transação
--           Garantir que não é possível criar protocolo sem receptoras
-- ============================================================

-- Remover função existente (se houver) - pode ter assinatura diferente
DROP FUNCTION IF EXISTS criar_protocolo_passo1_atomico(UUID, DATE, TEXT, UUID[], DATE, TEXT, TEXT[]);
DROP FUNCTION IF EXISTS criar_protocolo_passo1_atomico(UUID, DATE, TEXT, UUID[], UUID, DATE, TEXT, TEXT[]);
DROP FUNCTION IF EXISTS criar_protocolo_passo1_atomico CASCADE;

CREATE OR REPLACE FUNCTION criar_protocolo_passo1_atomico(
    p_fazenda_id UUID,
    p_data_inicio DATE,
    p_responsavel_inicio TEXT,
    p_receptoras_ids UUID[],
    p_data_inclusao DATE,
    p_observacoes TEXT DEFAULT NULL,
    p_receptoras_observacoes TEXT[] DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_protocolo_id UUID;
    v_receptora_id UUID;
    v_observacao TEXT;
    v_index INTEGER;
BEGIN
    -- Validação: deve ter pelo menos 1 receptora
    IF array_length(p_receptoras_ids, 1) IS NULL OR array_length(p_receptoras_ids, 1) = 0 THEN
        RAISE EXCEPTION 'Deve ter pelo menos 1 receptora';
    END IF;

    -- Validação: verificar se todas as receptoras existem
    IF NOT EXISTS (
        SELECT 1 FROM receptoras 
        WHERE id = ANY(p_receptoras_ids)
        GROUP BY 1
        HAVING COUNT(*) = array_length(p_receptoras_ids, 1)
    ) THEN
        RAISE EXCEPTION 'Uma ou mais receptoras não existem no banco de dados';
    END IF;

    -- Criar protocolo
    INSERT INTO protocolos_sincronizacao (
        fazenda_id,
        data_inicio,
        responsavel_inicio,
        observacoes,
        status
    )
    VALUES (
        p_fazenda_id,
        p_data_inicio,
        p_responsavel_inicio,
        p_observacoes,
        'PASSO1_FECHADO'
    )
    RETURNING id INTO v_protocolo_id;

    -- Vincular receptoras ao protocolo
    FOR v_index IN 1..array_length(p_receptoras_ids, 1) LOOP
        v_receptora_id := p_receptoras_ids[v_index];
        
        -- Obter observação correspondente (se existir)
        IF p_receptoras_observacoes IS NOT NULL AND v_index <= array_length(p_receptoras_observacoes, 1) THEN
            v_observacao := p_receptoras_observacoes[v_index];
        ELSE
            v_observacao := NULL;
        END IF;

        -- Inserir vínculo (evento_fazenda_id é opcional - apenas para auditoria)
        INSERT INTO protocolo_receptoras (
            protocolo_id,
            receptora_id,
            data_inclusao,
            status,
            observacoes
            -- evento_fazenda_id não é incluído (é opcional e apenas para auditoria)
        )
        VALUES (
            v_protocolo_id,
            v_receptora_id,
            p_data_inclusao,
            'INICIADA',
            v_observacao
        );
    END LOOP;

    RETURN v_protocolo_id;
EXCEPTION
    WHEN OTHERS THEN
        -- Em caso de erro, rollback automático (transação)
        RAISE;
END;
$$;

-- Comentário na função
COMMENT ON FUNCTION criar_protocolo_passo1_atomico IS 'Cria um protocolo e vincula receptoras em uma única transação. Garante que não é possível criar protocolo sem receptoras. Retorna o ID do protocolo criado.';
