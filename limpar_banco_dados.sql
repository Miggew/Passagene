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
    -- Diagnosticos de Gestação (depende de transferencias_embrioes e receptoras)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'diagnosticos_gestacao') THEN
        DELETE FROM diagnosticos_gestacao;
    END IF;

    -- Transferências de Embriões (depende de receptoras, embrioes, etc)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transferencias_embrioes') THEN
        DELETE FROM transferencias_embrioes;
    END IF;

    -- Protocolo Receptoras (depende de protocolos_sincronizacao e receptoras)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'protocolo_receptoras') THEN
        DELETE FROM protocolo_receptoras;
    END IF;

    -- Protocolos de Sincronização (depende de fazendas)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'protocolos_sincronizacao') THEN
        DELETE FROM protocolos_sincronizacao;
    END IF;

    -- Histórico de Fazendas das Receptoras (depende de receptoras e fazendas)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'receptora_fazenda_historico') THEN
        DELETE FROM receptora_fazenda_historico;
    END IF;

    -- Receptoras (depende de fazendas)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'receptoras') THEN
        DELETE FROM receptoras;
    END IF;

    -- Embriões (depende de doadoras, lotes_fiv)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'embrioes') THEN
        DELETE FROM embrioes;
    END IF;

    -- Lotes FIV (depende de doadoras)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lotes_fiv') THEN
        DELETE FROM lotes_fiv;
    END IF;

    -- Aspirações Doadoras (depende de doadoras)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'aspiracoes_doadoras') THEN
        DELETE FROM aspiracoes_doadoras;
    END IF;

    -- Doadoras (depende de fazendas)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'doadoras') THEN
        DELETE FROM doadoras;
    END IF;

    -- Doses de Sêmen (depende de clientes/fazendas)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'doses_semen') THEN
        DELETE FROM doses_semen;
    END IF;

    -- Fazendas (depende de clientes)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fazendas') THEN
        DELETE FROM fazendas;
    END IF;

    -- Clientes (tabela base)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clientes') THEN
        DELETE FROM clientes;
    END IF;
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
SELECT 'lotes_fiv', COUNT(*) FROM lotes_fiv
UNION ALL
SELECT 'embrioes', COUNT(*) FROM embrioes
UNION ALL
SELECT 'aspiracoes_doadoras', COUNT(*) FROM aspiracoes_doadoras
UNION ALL
SELECT 'doses_semen', COUNT(*) FROM doses_semen;

-- Todos os totais devem ser 0 após a limpeza
