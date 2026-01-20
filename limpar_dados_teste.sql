-- ============================================================
-- Script para Limpar TODOS os Dados do Banco (Mantém Estrutura)
-- ============================================================
-- Objetivo: Remover apenas os dados cadastrados, mantendo todas as tabelas, 
--           índices, constraints e estrutura do banco intacta.
-- 
-- ⚠️ ATENÇÃO: Isso remove TODOS os dados! Use apenas em ambiente de teste.
-- 
-- Última atualização: 2026-01-20
-- Inclui: Touros, Embriões com cliente_id, Histórico de renomeações, etc.
-- ============================================================

BEGIN;

-- Limpar dados em ordem (respeitando foreign keys)
-- O CASCADE garante que dependências sejam tratadas automaticamente

-- 1. Tabelas de dados transacionais/operações (mais dependentes)
-- Truncar apenas tabelas que existem (ignorar erros se não existirem)
DO $$
BEGIN
    -- Transferências de embriões
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transferencias_embrioes') THEN
        TRUNCATE TABLE transferencias_embrioes CASCADE;
    END IF;
    
    -- Diagnósticos de gestação
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'diagnosticos_gestacao') THEN
        TRUNCATE TABLE diagnosticos_gestacao CASCADE;
    END IF;
    
    -- Histórico de embriões
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'historico_embrioes') THEN
        TRUNCATE TABLE historico_embrioes CASCADE;
    END IF;
    
    -- Mídia de acasalamentos
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'acasalamento_embrioes_media') THEN
        TRUNCATE TABLE acasalamento_embrioes_media CASCADE;
    END IF;
    
    -- Embriões (inclui campo cliente_id)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'embrioes') THEN
        TRUNCATE TABLE embrioes CASCADE;
    END IF;
    
    -- Sexagem (se existir)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sexagens') THEN
        TRUNCATE TABLE sexagens CASCADE;
    END IF;
END $$;

-- 2. Lotes FIV e acasalamentos
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lotes_fiv_acasalamentos') THEN
        TRUNCATE TABLE lotes_fiv_acasalamentos CASCADE;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lotes_fiv') THEN
        TRUNCATE TABLE lotes_fiv CASCADE;
    END IF;
END $$;

-- 3. Aspirações e pacotes
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'aspiracoes_doadoras') THEN
        TRUNCATE TABLE aspiracoes_doadoras CASCADE;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pacotes_aspiracao_fazendas_destino') THEN
        TRUNCATE TABLE pacotes_aspiracao_fazendas_destino CASCADE;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pacotes_aspiracao') THEN
        TRUNCATE TABLE pacotes_aspiracao CASCADE;
    END IF;
END $$;

-- 4. Resetar status das receptoras ANTES de limpar protocolos
-- CRÍTICO: Isso garante que receptoras fiquem disponíveis para novos protocolos
-- Mesmo que tenham status_reprodutivo = 'EM_SINCRONIZACAO' de protocolos anteriores
DO $$
DECLARE
    receptoras_afetadas INTEGER;
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'receptoras') THEN
        IF EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'receptoras' 
            AND column_name = 'status_reprodutivo'
        ) THEN
            -- Resetar TODOS os status_reprodutivo para NULL
            UPDATE receptoras 
            SET status_reprodutivo = NULL 
            WHERE status_reprodutivo IS NOT NULL;
            
            GET DIAGNOSTICS receptoras_afetadas = ROW_COUNT;
            RAISE NOTICE '✅ Status de % receptoras resetado para NULL', receptoras_afetadas;
        END IF;
    END IF;
END $$;

-- 5. Protocolos e receptoras (depois de resetar status)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'protocolo_receptoras') THEN
        TRUNCATE TABLE protocolo_receptoras CASCADE;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'protocolos_sincronizacao') THEN
        TRUNCATE TABLE protocolos_sincronizacao CASCADE;
    END IF;
END $$;

-- 6. Touros e doses de sêmen (catálogo de touros)
DO $$
BEGIN
    -- Doses de sêmen primeiro (dependem de touros)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'doses_semen') THEN
        TRUNCATE TABLE doses_semen CASCADE;
    END IF;
    
    -- Touros (catálogo)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'touros') THEN
        TRUNCATE TABLE touros CASCADE;
    END IF;
END $$;

-- 7. Doadoras
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'doadoras') THEN
        TRUNCATE TABLE doadoras CASCADE;
    END IF;
END $$;

-- 8. Receptoras e histórico
DO $$
BEGIN
    -- Histórico de renomeações de fazenda
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'historico_renomeacoes') THEN
        TRUNCATE TABLE historico_renomeacoes CASCADE;
    END IF;
    
    -- Histórico de fazendas das receptoras
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'receptoras_fazenda_historico') THEN
        TRUNCATE TABLE receptoras_fazenda_historico CASCADE;
    END IF;
    
    -- Receptoras (status já foi resetado anteriormente na seção 4, apenas truncar)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'receptoras') THEN
        TRUNCATE TABLE receptoras CASCADE;
    END IF;
END $$;

-- 9. Fazendas
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fazendas') THEN
        TRUNCATE TABLE fazendas CASCADE;
    END IF;
END $$;

-- 10. Clientes (último, pois outras tabelas podem referenciar)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clientes') THEN
        TRUNCATE TABLE clientes CASCADE;
    END IF;
END $$;

-- 11. Tabelas auxiliares e de histórico (se existirem)
DO $$
BEGIN
    -- Histórico de renomeações de fazendas (se existir como tabela separada)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'historico_fazendas') THEN
        TRUNCATE TABLE historico_fazendas CASCADE;
    END IF;
END $$;

COMMIT;

-- ============================================================
-- Verificação: Contar registros restantes
-- ============================================================
-- Execute após o TRUNCATE para verificar se tudo foi limpo

-- Verificação: Contar registros nas tabelas principais
-- Nota: Apenas contará tabelas que existem (ignorará as que não existem)
DO $$
DECLARE
    tabela_nome TEXT;
    contagem INTEGER;
    total_geral INTEGER := 0;
BEGIN
    RAISE NOTICE '=== Verificação de Limpeza ===';
    
    FOR tabela_nome IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name IN (
            'clientes', 'fazendas', 'doadoras', 'receptoras',
            'protocolos_sincronizacao', 'protocolo_receptoras',
            'pacotes_aspiracao', 'aspiracoes_doadoras',
            'pacotes_aspiracao_fazendas_destino',
            'lotes_fiv', 'lotes_fiv_acasalamentos',
            'embrioes', 'transferencias_embrioes',
            'diagnosticos_gestacao', 'sexagens',
            'touros', 'doses_semen',
            'historico_embrioes', 'acasalamento_embrioes_media',
            'receptoras_fazenda_historico', 'historico_renomeacoes'
        )
        ORDER BY table_name
    LOOP
        BEGIN
            EXECUTE format('SELECT COUNT(*) FROM %I', tabela_nome) INTO contagem;
            total_geral := total_geral + contagem;
            IF contagem > 0 THEN
                RAISE NOTICE '⚠️  %: % registros', tabela_nome, contagem;
            ELSE
                RAISE NOTICE '✅ %: 0 registros (limpo)', tabela_nome;
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE '❌ %: Erro ao contar (tabela pode não existir)', tabela_nome;
        END;
    END LOOP;
    
    RAISE NOTICE '=== Total de registros restantes: % ===', total_geral;
    IF total_geral = 0 THEN
        RAISE NOTICE '✅ Limpeza concluída com sucesso! Todas as tabelas estão vazias.';
    ELSE
        RAISE NOTICE '⚠️  Ainda há registros em algumas tabelas. Verifique acima.';
    END IF;
END $$;

-- Verificação adicional: Status das receptoras após limpeza
DO $$
DECLARE
    receptoras_com_status INTEGER;
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'receptoras') THEN
        IF EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'receptoras' 
            AND column_name = 'status_reprodutivo'
        ) THEN
            SELECT COUNT(*) INTO receptoras_com_status
            FROM receptoras
            WHERE status_reprodutivo IS NOT NULL;
            
            IF receptoras_com_status > 0 THEN
                RAISE NOTICE '⚠️  ATENÇÃO: % receptoras ainda têm status_reprodutivo definido após limpeza!', receptoras_com_status;
                RAISE NOTICE '   Execute: UPDATE receptoras SET status_reprodutivo = NULL WHERE status_reprodutivo IS NOT NULL;';
            ELSE
                RAISE NOTICE '✅ Todas as receptoras têm status_reprodutivo = NULL (correto)';
            END IF;
        END IF;
    END IF;
END $$;

-- Se todas retornarem 0, a limpeza foi bem-sucedida!
