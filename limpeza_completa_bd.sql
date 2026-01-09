-- ============================================================
-- SCRIPT DE LIMPEZA COMPLETA DO BANCO DE DADOS - PassaGene
-- ============================================================
-- ⚠️ ATENÇÃO: Este script remove TODOS os dados de TODAS as tabelas
-- ⚠️ Execute apenas se tiver certeza de que deseja limpar completamente o banco
-- ⚠️ Este script NÃO remove a estrutura das tabelas, apenas os dados
-- ============================================================

BEGIN;

-- ============================================================
-- 1. DELETAR dados em ordem (respeitando dependências de Foreign Keys)
-- ============================================================

-- Tabelas dependentes (que referenciam outras tabelas) - deletar primeiro
DELETE FROM diagnosticos_gestacao;
DELETE FROM transferencias_embrioes;
DELETE FROM protocolo_receptoras;
DELETE FROM protocolos_sincronizacao;
DELETE FROM embrioes;
DELETE FROM lotes_fiv;
DELETE FROM aspiracoes_doadoras;
DELETE FROM doses_semen;

-- Tabelas principais (que são referenciadas por outras)
DELETE FROM receptoras;
DELETE FROM doadoras;
DELETE FROM fazendas;
DELETE FROM clientes;

-- ============================================================
-- 2. RESETAR sequences/autoincrement (se existirem)
-- ============================================================
-- Nota: O Supabase geralmente usa UUID, mas se houver sequences definidas, 
-- elas podem ser resetadas aqui se necessário
-- Exemplo (descomente se necessário):
-- ALTER SEQUENCE IF EXISTS clientes_id_seq RESTART WITH 1;
-- ALTER SEQUENCE IF EXISTS fazendas_id_seq RESTART WITH 1;

-- ============================================================
-- 3. VERIFICAÇÃO (opcional - descomente para verificar se está tudo limpo)
-- ============================================================

-- SELECT 'clientes' as tabela, COUNT(*) as registros FROM clientes
-- UNION ALL
-- SELECT 'fazendas', COUNT(*) FROM fazendas
-- UNION ALL
-- SELECT 'receptoras', COUNT(*) FROM receptoras
-- UNION ALL
-- SELECT 'doadoras', COUNT(*) FROM doadoras
-- UNION ALL
-- SELECT 'protocolos_sincronizacao', COUNT(*) FROM protocolos_sincronizacao
-- UNION ALL
-- SELECT 'protocolo_receptoras', COUNT(*) FROM protocolo_receptoras
-- UNION ALL
-- SELECT 'aspiracoes_doadoras', COUNT(*) FROM aspiracoes_doadoras
-- UNION ALL
-- SELECT 'lotes_fiv', COUNT(*) FROM lotes_fiv
-- UNION ALL
-- SELECT 'embrioes', COUNT(*) FROM embrioes
-- UNION ALL
-- SELECT 'doses_semen', COUNT(*) FROM doses_semen
-- UNION ALL
-- SELECT 'transferencias_embrioes', COUNT(*) FROM transferencias_embrioes
-- UNION ALL
-- SELECT 'diagnosticos_gestacao', COUNT(*) FROM diagnosticos_gestacao;

COMMIT;

-- ============================================================
-- ✅ LIMPEZA CONCLUÍDA
-- ============================================================
-- Todas as tabelas foram limpas. A estrutura das tabelas permanece intacta.
-- Execute as queries de verificação acima (descomentadas) para confirmar.
