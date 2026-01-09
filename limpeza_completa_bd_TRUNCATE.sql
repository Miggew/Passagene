-- ============================================================
-- SCRIPT DE LIMPEZA COMPLETA - VERSÃO TRUNCATE (Mais Rápida)
-- ============================================================
-- ⚠️ ATENÇÃO: Este script remove TODOS os dados de TODAS as tabelas
-- ⚠️ Execute apenas se tiver certeza de que deseja limpar completamente o banco
-- ⚠️ TRUNCATE é mais rápido que DELETE e também reseta sequences automaticamente
-- ⚠️ Se houver Foreign Keys, pode ser necessário usar CASCADE
-- ============================================================

BEGIN;

-- ============================================================
-- MÉTODO 1: TRUNCATE COM CASCADE (mais rápido, reseta sequences)
-- ============================================================
-- Descomente as linhas abaixo se quiser usar TRUNCATE
-- O CASCADE remove dados de tabelas dependentes automaticamente

-- TRUNCATE TABLE diagnosticos_gestacao CASCADE;
-- TRUNCATE TABLE transferencias_embrioes CASCADE;
-- TRUNCATE TABLE protocolo_receptoras CASCADE;
-- TRUNCATE TABLE protocolos_sincronizacao CASCADE;
-- TRUNCATE TABLE embrioes CASCADE;
-- TRUNCATE TABLE lotes_fiv CASCADE;
-- TRUNCATE TABLE aspiracoes_doadoras CASCADE;
-- TRUNCATE TABLE doses_semen CASCADE;
-- TRUNCATE TABLE receptoras CASCADE;
-- TRUNCATE TABLE doadoras CASCADE;
-- TRUNCATE TABLE fazendas CASCADE;
-- TRUNCATE TABLE clientes CASCADE;

-- ============================================================
-- MÉTODO 2: TRUNCATE SEM CASCADE (mais seguro, ordem específica)
-- ============================================================
-- Se o método acima não funcionar por causa de Foreign Keys,
-- use esta versão que respeita a ordem de dependências:

TRUNCATE TABLE diagnosticos_gestacao RESTART IDENTITY;
TRUNCATE TABLE transferencias_embrioes RESTART IDENTITY;
TRUNCATE TABLE protocolo_receptoras RESTART IDENTITY;
TRUNCATE TABLE protocolos_sincronizacao RESTART IDENTITY;
TRUNCATE TABLE embrioes RESTART IDENTITY;
TRUNCATE TABLE lotes_fiv RESTART IDENTITY;
TRUNCATE TABLE aspiracoes_doadoras RESTART IDENTITY;
TRUNCATE TABLE doses_semen RESTART IDENTITY;
TRUNCATE TABLE receptoras RESTART IDENTITY;
TRUNCATE TABLE doadoras RESTART IDENTITY;
TRUNCATE TABLE fazendas RESTART IDENTITY;
TRUNCATE TABLE clientes RESTART IDENTITY;

-- ============================================================
-- Se der erro de Foreign Key, desabilite temporariamente:
-- ============================================================
-- SET session_replication_role = replica;
-- (execute os TRUNCATE aqui)
-- SET session_replication_role = DEFAULT;

COMMIT;

-- ============================================================
-- ✅ LIMPEZA CONCLUÍDA
-- ============================================================
-- Todas as tabelas foram limpas e sequences resetadas.
-- Execute verificar_dados_antes_limpeza.sql para confirmar que está tudo limpo.
