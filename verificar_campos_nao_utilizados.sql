-- ============================================================
-- Script para Verificar Campos Não Utilizados
-- ============================================================
-- Este script verifica se campos potencialmente não utilizados
-- ainda contêm dados no banco.
-- ============================================================

-- ============================================================
-- 1. Verificar fazenda_atual_id em receptoras
-- ============================================================
SELECT 
    'receptoras.fazenda_atual_id' AS campo,
    COUNT(*) AS total_registros,
    COUNT(fazenda_atual_id) AS registros_com_valor,
    COUNT(*) - COUNT(fazenda_atual_id) AS registros_nulos
FROM receptoras;

-- Se registros_com_valor = 0, a coluna pode ser removida

-- ============================================================
-- 2. Verificar status_reprodutivo em receptoras
-- ============================================================
SELECT 
    'receptoras.status_reprodutivo' AS campo,
    COUNT(*) AS total_registros,
    COUNT(status_reprodutivo) AS registros_com_valor,
    COUNT(*) - COUNT(status_reprodutivo) AS registros_nulos,
    COUNT(DISTINCT status_reprodutivo) AS valores_distintos
FROM receptoras;

-- Se registros_com_valor = 0 ou valores_distintos = 0, considerar remover

-- ============================================================
-- 3. Verificar pacote_producao_id em protocolos_sincronizacao
-- ============================================================
SELECT 
    'protocolos_sincronizacao.pacote_producao_id' AS campo,
    COUNT(*) AS total_registros,
    COUNT(pacote_producao_id) AS registros_com_valor,
    COUNT(*) - COUNT(pacote_producao_id) AS registros_nulos
FROM protocolos_sincronizacao;

-- Se registros_com_valor = 0, considerar remover

-- ============================================================
-- 4. Verificar uso de evento_fazenda_id (apenas auditoria)
-- ============================================================
SELECT 
    'protocolo_receptoras.evento_fazenda_id' AS campo,
    COUNT(*) AS total_registros,
    COUNT(evento_fazenda_id) AS registros_com_valor,
    COUNT(*) - COUNT(evento_fazenda_id) AS registros_nulos
FROM protocolo_receptoras;

SELECT 
    'transferencias_embrioes.evento_fazenda_id' AS campo,
    COUNT(*) AS total_registros,
    COUNT(evento_fazenda_id) AS registros_com_valor,
    COUNT(*) - COUNT(evento_fazenda_id) AS registros_nulos
FROM transferencias_embrioes;

-- Estes campos são apenas para auditoria, não devem ser removidos
-- mas é bom verificar se estão sendo preenchidos

-- ============================================================
-- 5. Resumo Geral
-- ============================================================
SELECT 
    'RESUMO' AS tipo,
    'receptoras.fazenda_atual_id' AS campo,
    COUNT(fazenda_atual_id) AS registros_com_valor
FROM receptoras
UNION ALL
SELECT 
    'RESUMO',
    'receptoras.status_reprodutivo',
    COUNT(status_reprodutivo)
FROM receptoras
UNION ALL
SELECT 
    'RESUMO',
    'protocolos_sincronizacao.pacote_producao_id',
    COUNT(pacote_producao_id)
FROM protocolos_sincronizacao;

-- ============================================================
-- 6. Verificar se há referências a fazenda_atual_id em views
-- ============================================================
SELECT 
    table_name,
    view_definition
FROM information_schema.views
WHERE table_schema = 'public'
  AND view_definition ILIKE '%fazenda_atual_id%';

-- ============================================================
-- 7. Verificar se há constraints ou índices em fazenda_atual_id
-- ============================================================
SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'receptoras'::regclass
  AND pg_get_constraintdef(oid) ILIKE '%fazenda_atual_id%';

-- ============================================================
-- INSTRUÇÕES:
-- ============================================================
-- 1. Execute todas as queries acima
-- 2. Se fazenda_atual_id tiver 0 registros_com_valor:
--    - Pode ser removido com segurança
--    - Execute: ALTER TABLE receptoras DROP COLUMN IF EXISTS fazenda_atual_id;
--
-- 3. Se status_reprodutivo não for usado:
--    - Verificar se há lógica que depende dele
--    - Se não, considerar remover
--
-- 4. Se pacote_producao_id não for usado:
--    - Verificar se há planos futuros para usar
--    - Se não, considerar remover
--
-- 5. evento_fazenda_id deve ser mantido (auditoria)
--    - Mas verificar se está sendo preenchido corretamente
