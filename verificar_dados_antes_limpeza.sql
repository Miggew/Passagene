-- ============================================================
-- VERIFICAÇÃO DE DADOS ANTES DA LIMPEZA - PassaGene
-- ============================================================
-- Execute este script ANTES de executar limpeza_completa_bd.sql
-- Este script mostra quantos registros existem em cada tabela
-- ============================================================

SELECT 
    'clientes' as tabela, 
    COUNT(*) as total_registros,
    'Tabela principal' as tipo
FROM clientes
UNION ALL
SELECT 
    'fazendas', 
    COUNT(*),
    'Tabela principal'
FROM fazendas
UNION ALL
SELECT 
    'receptoras', 
    COUNT(*),
    'Tabela principal'
FROM receptoras
UNION ALL
SELECT 
    'doadoras', 
    COUNT(*),
    'Tabela principal'
FROM doadoras
UNION ALL
SELECT 
    'protocolos_sincronizacao', 
    COUNT(*),
    'Dependente'
FROM protocolos_sincronizacao
UNION ALL
SELECT 
    'protocolo_receptoras', 
    COUNT(*),
    'Dependente'
FROM protocolo_receptoras
UNION ALL
SELECT 
    'aspiracoes_doadoras', 
    COUNT(*),
    'Dependente'
FROM aspiracoes_doadoras
UNION ALL
SELECT 
    'lotes_fiv', 
    COUNT(*),
    'Dependente'
FROM lotes_fiv
UNION ALL
SELECT 
    'embrioes', 
    COUNT(*),
    'Dependente'
FROM embrioes
UNION ALL
SELECT 
    'doses_semen', 
    COUNT(*),
    'Dependente'
FROM doses_semen
UNION ALL
SELECT 
    'transferencias_embrioes', 
    COUNT(*),
    'Dependente'
FROM transferencias_embrioes
UNION ALL
SELECT 
    'diagnosticos_gestacao', 
    COUNT(*),
    'Dependente'
FROM diagnosticos_gestacao
ORDER BY tipo, tabela;

-- ============================================================
-- Total geral de registros
-- ============================================================
SELECT 
    SUM(total) as total_geral_registros
FROM (
    SELECT COUNT(*) as total FROM clientes
    UNION ALL
    SELECT COUNT(*) FROM fazendas
    UNION ALL
    SELECT COUNT(*) FROM receptoras
    UNION ALL
    SELECT COUNT(*) FROM doadoras
    UNION ALL
    SELECT COUNT(*) FROM protocolos_sincronizacao
    UNION ALL
    SELECT COUNT(*) FROM protocolo_receptoras
    UNION ALL
    SELECT COUNT(*) FROM aspiracoes_doadoras
    UNION ALL
    SELECT COUNT(*) FROM lotes_fiv
    UNION ALL
    SELECT COUNT(*) FROM embrioes
    UNION ALL
    SELECT COUNT(*) FROM doses_semen
    UNION ALL
    SELECT COUNT(*) FROM transferencias_embrioes
    UNION ALL
    SELECT COUNT(*) FROM diagnosticos_gestacao
) as totais;
