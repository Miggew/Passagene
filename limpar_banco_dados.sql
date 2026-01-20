-- ============================================================
-- Script para Limpar Todos os Dados do Banco de Dados
-- ============================================================
-- ATENÇÃO: Este script remove TODOS os dados cadastrados,
-- mas mantém a estrutura das tabelas intacta.
-- 
-- Execute este script no SQL Editor do Supabase.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Limpar tabelas dependentes (ordem: mais dependente primeiro)
-- ============================================================
-- IMPORTANTE: A ordem importa devido às foreign keys!
-- Começamos pelas tabelas mais dependentes e vamos subindo
-- Usando DO $$ para tratar erros caso alguma tabela não exista

DO $$
BEGIN
    -- ============================================================
    -- Tabelas mais dependentes (nível 1)
    -- ============================================================
    
    -- Diagnosticos de Gestação (depende de transferencias_embrioes e receptoras)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'diagnosticos_gestacao') THEN
        DELETE FROM diagnosticos_gestacao;
        RAISE NOTICE 'Limpeza: diagnosticos_gestacao';
    END IF;

    -- Transferências de Embriões (depende de receptoras, embrioes, etc)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transferencias_embrioes') THEN
        DELETE FROM transferencias_embrioes;
        RAISE NOTICE 'Limpeza: transferencias_embrioes';
    END IF;

    -- Histórico de Embriões (se existir)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'historico_embrioes') THEN
        DELETE FROM historico_embrioes;
        RAISE NOTICE 'Limpeza: historico_embrioes';
    END IF;

    -- ============================================================
    -- Tabelas de relacionamento (nível 2)
    -- ============================================================
    
    -- Protocolo Receptoras (depende de protocolos_sincronizacao e receptoras)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'protocolo_receptoras') THEN
        DELETE FROM protocolo_receptoras;
        RAISE NOTICE 'Limpeza: protocolo_receptoras';
    END IF;

    -- Histórico de Fazendas das Receptoras (depende de receptoras e fazendas)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'receptora_fazenda_historico') THEN
        DELETE FROM receptora_fazenda_historico;
        RAISE NOTICE 'Limpeza: receptora_fazenda_historico';
    END IF;

    -- Histórico de Renomeações (se existir)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'historico_renomeacoes') THEN
        DELETE FROM historico_renomeacoes;
        RAISE NOTICE 'Limpeza: historico_renomeacoes';
    END IF;

    -- ============================================================
    -- Tabelas de embriões e lotes FIV (nível 3)
    -- ============================================================
    
    -- Embriões (depende de lotes_fiv e acasalamentos)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'embrioes') THEN
        DELETE FROM embrioes;
        RAISE NOTICE 'Limpeza: embrioes';
    END IF;

    -- Acasalamentos de Lotes FIV (depende de lotes_fiv, aspiracoes, doses_semen)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lote_fiv_acasalamentos') THEN
        DELETE FROM lote_fiv_acasalamentos;
        RAISE NOTICE 'Limpeza: lote_fiv_acasalamentos';
    END IF;

    -- Fazendas Destino dos Lotes FIV (depende de lotes_fiv e fazendas)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lote_fiv_fazendas_destino') THEN
        DELETE FROM lote_fiv_fazendas_destino;
        RAISE NOTICE 'Limpeza: lote_fiv_fazendas_destino';
    END IF;

    -- Lotes FIV (depende de pacotes_aspiracao)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lotes_fiv') THEN
        DELETE FROM lotes_fiv;
        RAISE NOTICE 'Limpeza: lotes_fiv';
    END IF;

    -- ============================================================
    -- Tabelas de protocolos (nível 4)
    -- ============================================================
    
    -- Protocolos de Sincronização (depende de fazendas)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'protocolos_sincronizacao') THEN
        DELETE FROM protocolos_sincronizacao;
        RAISE NOTICE 'Limpeza: protocolos_sincronizacao';
    END IF;

    -- ============================================================
    -- Tabelas de aspiração e pacotes (nível 5)
    -- ============================================================
    
    -- Fazendas Destino dos Pacotes de Aspiração (depende de pacotes_aspiracao e fazendas)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pacotes_aspiracao_fazendas_destino') THEN
        DELETE FROM pacotes_aspiracao_fazendas_destino;
        RAISE NOTICE 'Limpeza: pacotes_aspiracao_fazendas_destino';
    END IF;

    -- Pacotes de Aspiração (depende de fazendas)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'pacotes_aspiracao') THEN
        DELETE FROM pacotes_aspiracao;
        RAISE NOTICE 'Limpeza: pacotes_aspiracao';
    END IF;

    -- Aspirações Doadoras (depende de doadoras e pacotes_aspiracao)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'aspiracoes_doadoras') THEN
        DELETE FROM aspiracoes_doadoras;
        RAISE NOTICE 'Limpeza: aspiracoes_doadoras';
    END IF;

    -- ============================================================
    -- Tabelas de animais (nível 6)
    -- ============================================================
    
    -- Receptoras (depende de fazendas)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'receptoras') THEN
        DELETE FROM receptoras;
        RAISE NOTICE 'Limpeza: receptoras';
    END IF;

    -- Doadoras (depende de fazendas)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'doadoras') THEN
        DELETE FROM doadoras;
        RAISE NOTICE 'Limpeza: doadoras';
    END IF;

    -- ============================================================
    -- Tabelas de materiais (nível 7)
    -- ============================================================
    
    -- Doses de Sêmen (depende de clientes/fazendas)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'doses_semen') THEN
        DELETE FROM doses_semen;
        RAISE NOTICE 'Limpeza: doses_semen';
    END IF;

    -- ============================================================
    -- Tabelas de estrutura (nível 8)
    -- ============================================================
    
    -- Fazendas (depende de clientes)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fazendas') THEN
        DELETE FROM fazendas;
        RAISE NOTICE 'Limpeza: fazendas';
    END IF;

    -- Clientes (tabela base)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clientes') THEN
        DELETE FROM clientes;
        RAISE NOTICE 'Limpeza: clientes';
    END IF;

    RAISE NOTICE '✅ Limpeza completa do banco de dados concluída!';
END $$;

COMMIT;

-- ============================================================
-- Verificação: Contar registros em cada tabela
-- ============================================================
-- Execute estas queries para verificar se tudo foi limpo:

SELECT 'clientes' as tabela, COUNT(*) as total FROM clientes
UNION ALL
SELECT 'fazendas', COUNT(*) FROM fazendas
UNION ALL
SELECT 'doadoras', COUNT(*) FROM doadoras
UNION ALL
SELECT 'receptoras', COUNT(*) FROM receptoras
UNION ALL
SELECT 'protocolos_sincronizacao', COUNT(*) FROM protocolos_sincronizacao
UNION ALL
SELECT 'protocolo_receptoras', COUNT(*) FROM protocolo_receptoras
UNION ALL
SELECT 'receptora_fazenda_historico', COUNT(*) FROM receptora_fazenda_historico
UNION ALL
SELECT 'transferencias_embrioes', COUNT(*) FROM transferencias_embrioes
UNION ALL
SELECT 'diagnosticos_gestacao', COUNT(*) FROM diagnosticos_gestacao
UNION ALL
SELECT 'pacotes_aspiracao', COUNT(*) FROM pacotes_aspiracao
UNION ALL
SELECT 'pacotes_aspiracao_fazendas_destino', COUNT(*) FROM pacotes_aspiracao_fazendas_destino
UNION ALL
SELECT 'lotes_fiv', COUNT(*) FROM lotes_fiv
UNION ALL
SELECT 'lote_fiv_acasalamentos', COUNT(*) FROM lote_fiv_acasalamentos
UNION ALL
SELECT 'lote_fiv_fazendas_destino', COUNT(*) FROM lote_fiv_fazendas_destino
UNION ALL
SELECT 'embrioes', COUNT(*) FROM embrioes
UNION ALL
SELECT 'aspiracoes_doadoras', COUNT(*) FROM aspiracoes_doadoras
UNION ALL
SELECT 'doses_semen', COUNT(*) FROM doses_semen
ORDER BY tabela;

-- Todos os totais devem ser 0 após a limpeza
