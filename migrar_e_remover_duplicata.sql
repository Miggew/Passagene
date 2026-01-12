-- ============================================================
-- Script para Migrar Dados e Remover Duplicata "teste duplo"
-- ============================================================
-- A receptora 2b1de3a9-4afc-4454-a86a-64f6ff381b99 está em 1 protocolo
-- Vamos migrar os dados para a receptora mais antiga e remover a duplicata
-- ============================================================

BEGIN;

DO $$
DECLARE
    v_receptora_manter UUID := 'd488a22a-56eb-4787-b545-e5b488ccfadd'::UUID;  -- Mais antiga
    v_receptora_remover UUID := '2b1de3a9-4afc-4454-a86a-64f6ff381b99'::UUID;  -- Mais nova
    v_protocolo_receptora_id UUID;
    v_protocolo_id UUID;
    v_status TEXT;
    v_ciclando_classificacao TEXT;
    v_qualidade_semaforo SMALLINT;
    v_motivo_inapta TEXT;
    v_observacoes TEXT;
    v_data_inclusao DATE;
    v_evento_fazenda_id UUID;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migrando dados e removendo duplicata';
    RAISE NOTICE 'Mantendo: %', v_receptora_manter;
    RAISE NOTICE 'Removendo: %', v_receptora_remover;
    RAISE NOTICE '';
    
    -- 1. Verificar se a receptora a remover está em protocolos
    SELECT 
        pr.id,
        pr.protocolo_id,
        pr.status,
        pr.ciclando_classificacao,
        pr.qualidade_semaforo,
        pr.motivo_inapta,
        pr.observacoes,
        pr.data_inclusao,
        pr.evento_fazenda_id
    INTO 
        v_protocolo_receptora_id,
        v_protocolo_id,
        v_status,
        v_ciclando_classificacao,
        v_qualidade_semaforo,
        v_motivo_inapta,
        v_observacoes,
        v_data_inclusao,
        v_evento_fazenda_id
    FROM protocolo_receptoras pr
    WHERE pr.receptora_id = v_receptora_remover
    LIMIT 1;
    
    IF v_protocolo_receptora_id IS NOT NULL THEN
        RAISE NOTICE 'Protocolo encontrado: %', v_protocolo_id;
        RAISE NOTICE 'Status: %', v_status;
        
        -- Verificar se a receptora a manter já está no mesmo protocolo
        DECLARE
            v_ja_esta_no_protocolo BOOLEAN;
        BEGIN
            SELECT EXISTS(
                SELECT 1 
                FROM protocolo_receptoras 
                WHERE protocolo_id = v_protocolo_id 
                  AND receptora_id = v_receptora_manter
            ) INTO v_ja_esta_no_protocolo;
            
            IF v_ja_esta_no_protocolo THEN
                RAISE NOTICE 'A receptora a manter já está no protocolo. Removendo apenas a duplicata do protocolo.';
                -- Remover apenas o vínculo da receptora duplicata
                DELETE FROM protocolo_receptoras
                WHERE id = v_protocolo_receptora_id;
            ELSE
                RAISE NOTICE 'Migrando vínculo do protocolo para a receptora a manter...';
                -- Atualizar o vínculo do protocolo para apontar para a receptora a manter
                UPDATE protocolo_receptoras
                SET receptora_id = v_receptora_manter
                WHERE id = v_protocolo_receptora_id;
                
                RAISE NOTICE '  ✓ Vínculo do protocolo migrado';
            END IF;
        END;
    END IF;
    
    -- 2. Remover histórico de fazendas da receptora duplicata
    RAISE NOTICE '';
    RAISE NOTICE 'Removendo histórico de fazendas...';
    DELETE FROM receptora_fazenda_historico
    WHERE receptora_id = v_receptora_remover;
    RAISE NOTICE '  ✓ Histórico removido';
    
    -- 3. Remover a receptora duplicata
    RAISE NOTICE '';
    RAISE NOTICE 'Removendo receptora duplicata...';
    DELETE FROM receptoras
    WHERE id = v_receptora_remover;
    RAISE NOTICE '  ✓ Receptora removida';
    
    RAISE NOTICE '';
    RAISE NOTICE 'SUCESSO: Duplicata removida e dados migrados!';
END $$;

COMMIT;

-- ============================================================
-- VERIFICAÇÃO FINAL
-- ============================================================
SELECT 
    'VERIFICAÇÃO FINAL' AS status,
    COUNT(*) AS total_duplicatas_restantes
FROM (
    SELECT 
        r.identificacao,
        f.id AS fazenda_id,
        COUNT(*) AS quantidade
    FROM receptoras r
    INNER JOIN receptora_fazenda_historico rfh 
        ON rfh.receptora_id = r.id
        AND rfh.data_fim IS NULL
    INNER JOIN fazendas f ON f.id = rfh.fazenda_id
    GROUP BY r.identificacao, f.id
    HAVING COUNT(*) > 1
) duplicatas;

-- Verificar se a receptora mantida está no protocolo
SELECT 
    'Receptora mantida no protocolo' AS status,
    pr.id AS protocolo_receptora_id,
    pr.protocolo_id,
    pr.status,
    r.identificacao AS brinco
FROM protocolo_receptoras pr
INNER JOIN receptoras r ON r.id = pr.receptora_id
WHERE pr.receptora_id = 'd488a22a-56eb-4787-b545-e5b488ccfadd'::UUID;
