-- ============================================================
-- DELETAR PROTOCOLO PROBLEMÁTICO ESPECÍFICO (SEGURO)
-- ============================================================
-- INSTRUÇÕES:
-- 1. Execute primeiro: identificar_protocolos_problematicos.sql
-- 2. Anote o ID do protocolo que você quer deletar
-- 3. Substitua '<PROTOCOLO_ID>' abaixo pelo ID real
-- 4. Execute este script em modo transação (BEGIN/COMMIT)
-- ============================================================

BEGIN;

-- ============================================================
-- PASSO 1: BACKUP do protocolo antes de deletar
-- ============================================================
-- Execute esta query e copie o resultado antes de deletar!

SELECT 
    'BACKUP - Protocolo que será deletado:' as tipo,
    p.*,
    f.nome as fazenda_nome
FROM protocolos_sincronizacao p
LEFT JOIN fazendas f ON f.id = p.fazenda_id
WHERE p.id = '<PROTOCOLO_ID>';
-- ⚠️ COPIE O RESULTADO DESTA QUERY E SALVE COMO BACKUP!

-- ============================================================
-- PASSO 2: Verificar se realmente não tem receptoras
-- ============================================================
SELECT 
    'VERIFICAÇÃO - Receptoras vinculadas:' as tipo,
    COUNT(pr.id) as receptoras_count
FROM protocolos_sincronizacao p
LEFT JOIN protocolo_receptoras pr ON pr.protocolo_id = p.id
WHERE p.id = '<PROTOCOLO_ID>'
GROUP BY p.id;
-- ⚠️ Resultado deve ser: receptoras_count = 0

-- ============================================================
-- PASSO 3: DELETAR o protocolo (apenas se receptoras_count = 0)
-- ============================================================
-- ⚠️ DESCOMENTE A LINHA ABAIXO APENAS APÓS CONFIRMAR QUE receptoras_count = 0
-- ⚠️ E APÓS TER COPIADO O BACKUP ACIMA

-- DELETE FROM protocolos_sincronizacao
-- WHERE id = '<PROTOCOLO_ID>'
-- AND NOT EXISTS (
--     SELECT 1 FROM protocolo_receptoras pr 
--     WHERE pr.protocolo_id = protocolos_sincronizacao.id
-- );

-- ============================================================
-- PASSO 4: Verificar se foi deletado
-- ============================================================
-- Execute esta query após o DELETE para confirmar

-- SELECT 
--     CASE 
--         WHEN EXISTS (SELECT 1 FROM protocolos_sincronizacao WHERE id = '<PROTOCOLO_ID>')
--         THEN 'PROTOCOLO AINDA EXISTE - DELETE NÃO FUNCIONOU'
--         ELSE 'PROTOCOLO DELETADO COM SUCESSO ✅'
--     END as status_delecao;

-- ============================================================
-- FINALIZAR
-- ============================================================
-- Se tudo estiver OK, execute: COMMIT;
-- Se algo deu errado, execute: ROLLBACK; (reverte tudo)

-- COMMIT;
-- OU
-- ROLLBACK;
