-- ============================================================
-- LIMPEZA: Protocolos sem Receptoras Vinculadas
-- ============================================================
-- ⚠️ ATENÇÃO: Este script REMOVE protocolos que não possuem receptoras vinculadas
-- ⚠️ Execute PRIMEIRO o script auditoria_protocolos_sem_receptoras.sql para revisar
-- ⚠️ Este script DELETA protocolos órfãos, mas preserva a estrutura das tabelas
-- ============================================================
-- RECOMENDAÇÃO: Execute em modo transação e revise antes de COMMIT
-- ============================================================

BEGIN;

-- ============================================================
-- 1. LIMPEZA SEGURA: Protocolos sem receptoras criados nos últimos 7 dias
-- ============================================================
-- Critério: Protocolos criados recentemente (7 dias) sem receptoras
-- Status: Qualquer status, mas apenas os mais recentes

-- IMPORTANTE: Descomente apenas após revisar a auditoria
-- DELETE FROM protocolos_sincronizacao
-- WHERE id IN (
--     SELECT p.id
--     FROM protocolos_sincronizacao p
--     LEFT JOIN protocolo_receptoras pr ON pr.protocolo_id = p.id
--     WHERE p.created_at >= NOW() - INTERVAL '7 days'
--     GROUP BY p.id
--     HAVING COUNT(pr.id) = 0
-- );

-- ============================================================
-- 2. LIMPEZA CRÍTICA: Protocolos com Passo 2 sem receptoras (muito raro, mas possível)
-- ============================================================
-- Critério: Protocolos que iniciaram Passo 2 mas não têm receptoras
-- Status: Qualquer status, mas com passo2_data preenchido

-- IMPORTANTE: MUITO RARO - Revisar cuidadosamente antes de executar
-- DELETE FROM protocolos_sincronizacao
-- WHERE id IN (
--     SELECT p.id
--     FROM protocolos_sincronizacao p
--     LEFT JOIN protocolo_receptoras pr ON pr.protocolo_id = p.id
--     WHERE p.passo2_data IS NOT NULL
--     GROUP BY p.id
--     HAVING COUNT(pr.id) = 0
-- );

-- ============================================================
-- 3. LIMPEZA CONSERVADORA: Apenas protocolos com status específicos
-- ============================================================
-- Critério: Protocolos sem receptoras com status que indicam erro
-- Status: PASSO1_FECHADO, PASSO1_ABERTO, ABERTO (sem receptoras = erro)

-- IMPORTANTE: Descomente apenas após revisar a auditoria
-- DELETE FROM protocolos_sincronizacao
-- WHERE id IN (
--     SELECT p.id
--     FROM protocolos_sincronizacao p
--     LEFT JOIN protocolo_receptoras pr ON pr.protocolo_id = p.id
--     WHERE p.status IN ('PASSO1_FECHADO', 'PASSO1_ABERTO', 'ABERTO')
--     GROUP BY p.id
--     HAVING COUNT(pr.id) = 0
-- );

-- ============================================================
-- VERIFICAÇÃO APÓS LIMPEZA (execute após DELETE)
-- ============================================================
-- Execute esta query para confirmar que não sobrou nenhum protocolo sem receptoras

-- SELECT COUNT(*) as protocolos_sem_receptoras_restantes
-- FROM (
--     SELECT p.id
--     FROM protocolos_sincronizacao p
--     LEFT JOIN protocolo_receptoras pr ON pr.protocolo_id = p.id
--     GROUP BY p.id
--     HAVING COUNT(pr.id) = 0
-- ) as protocolos_sem_receptoras;
-- 
-- Resultado esperado: 0 (zero protocolos sem receptoras restantes)

COMMIT;

-- ============================================================
-- ⚠️ IMPORTANTE
-- ============================================================
-- 1. Execute primeiro: auditoria_protocolos_sem_receptoras.sql
-- 2. Revise os resultados cuidadosamente
-- 3. Identifique quais protocolos podem ser deletados com segurança
-- 4. Ajuste os critérios de DELETE acima conforme necessário
-- 5. Execute em modo transação (BEGIN/COMMIT) para poder reverter (ROLLBACK)
-- 6. Se não tiver certeza, não execute os DELETEs - apenas use para auditoria
-- ============================================================
