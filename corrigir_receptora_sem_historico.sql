-- ============================================================
-- Correção: Criar registro no histórico para receptora que não aparece
-- ============================================================
-- Receptora ID: a72a6339-98b0-4620-9cdb-a0609e23c94f
-- ============================================================
-- Este script cria um registro no histórico se a receptora não tiver
-- ============================================================

DO $$
DECLARE
    v_receptora_id UUID := 'a72a6339-98b0-4620-9cdb-a0609e23c94f';
    v_fazenda_atual_id UUID;
    v_historico_existe BOOLEAN;
    v_historico_id UUID;
BEGIN
    -- 1. Verificar se a receptora existe
    SELECT fazenda_atual_id INTO v_fazenda_atual_id
    FROM receptoras
    WHERE id = v_receptora_id;
    
    IF v_fazenda_atual_id IS NULL THEN
        RAISE EXCEPTION 'Receptora não encontrada: %', v_receptora_id;
    END IF;
    
    -- 2. Verificar se já existe registro ativo no histórico
    SELECT EXISTS(
        SELECT 1 
        FROM receptora_fazenda_historico 
        WHERE receptora_id = v_receptora_id 
          AND data_fim IS NULL
    ) INTO v_historico_existe;
    
    IF NOT v_historico_existe THEN
        -- 3. Verificar se existe algum registro (mesmo que fechado)
        SELECT id INTO v_historico_id
        FROM receptora_fazenda_historico
        WHERE receptora_id = v_receptora_id
        ORDER BY data_inicio DESC, created_at DESC
        LIMIT 1;
        
        IF v_historico_id IS NOT NULL THEN
            -- Existe registro fechado - reativar o mais recente
            UPDATE receptora_fazenda_historico
            SET data_fim = NULL,
                updated_at = NOW()
            WHERE id = v_historico_id;
            
            RAISE NOTICE 'Registro histórico reativado para receptora %', v_receptora_id;
        ELSE
            -- Não existe nenhum registro - criar novo
            INSERT INTO receptora_fazenda_historico (
                receptora_id,
                fazenda_id,
                data_inicio,
                observacoes
            )
            VALUES (
                v_receptora_id,
                v_fazenda_atual_id,
                COALESCE(
                    (SELECT created_at::DATE FROM receptoras WHERE id = v_receptora_id),
                    CURRENT_DATE
                ),
                'Registro criado automaticamente para corrigir ausência no histórico'
            );
            
            RAISE NOTICE 'Registro histórico criado para receptora % na fazenda %', v_receptora_id, v_fazenda_atual_id;
        END IF;
    ELSE
        RAISE NOTICE 'Receptora % já possui registro ativo no histórico', v_receptora_id;
    END IF;
END $$;

-- 4. Verificar resultado
SELECT 
    r.id,
    r.identificacao,
    r.fazenda_atual_id,
    CASE 
        WHEN v.receptora_id IS NOT NULL THEN '✓ Aparece na view'
        ELSE '✗ NÃO aparece na view'
    END as status_view,
    rfh.data_inicio as historico_data_inicio,
    rfh.data_fim as historico_data_fim
FROM receptoras r
LEFT JOIN vw_receptoras_fazenda_atual v ON r.id = v.receptora_id
LEFT JOIN receptora_fazenda_historico rfh ON r.id = rfh.receptora_id AND rfh.data_fim IS NULL
WHERE r.id = 'a72a6339-98b0-4620-9cdb-a0609e23c94f';
