-- ============================================================
-- DELETAR PROTOCOLO PROBLEMÁTICO
-- ID: ea3df11b-a390-42f0-aa72-3656f56f7e9b
-- ============================================================
-- Execute este script passo a passo no Supabase SQL Editor
-- ============================================================

BEGIN;

-- ============================================================
-- PASSO 1: VERIFICAR DETALHES DO PROTOCOLO (BACKUP)
-- ============================================================
-- Execute esta query primeiro para ver os detalhes e fazer backup
SELECT 
    '=== DETALHES DO PROTOCOLO ===' as info,
    p.id,
    p.fazenda_id,
    f.nome as fazenda_nome,
    p.data_inicio,
    p.status,
    p.passo2_data,
    p.passo2_tecnico_responsavel,
    p.responsavel_inicio,
    p.data_retirada,
    p.responsavel_retirada,
    p.observacoes,
    p.created_at,
    EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 86400 as dias_desde_criacao,
    CASE 
        WHEN p.passo2_data IS NOT NULL THEN '⚠️ TEM PASSO 2 - CUIDADO!'
        ELSE '✅ Sem Passo 2 - Mais seguro deletar'
    END as alerta
FROM protocolos_sincronizacao p
LEFT JOIN fazendas f ON f.id = p.fazenda_id
WHERE p.id = 'ea3df11b-a390-42f0-aa72-3656f56f7e9b';

-- ⚠️ IMPORTANTE: COPIE O RESULTADO ACIMA E SALVE COMO BACKUP!

-- ============================================================
-- PASSO 2: VERIFICAR SE TEM RECEPTORAS VINCULADAS
-- ============================================================
SELECT 
    '=== VERIFICAÇÃO DE RECEPTORAS ===' as info,
    COUNT(pr.id) as total_receptoras_vinculadas,
    CASE 
        WHEN COUNT(pr.id) = 0 THEN '✅ Nenhuma receptora - SEGURO DELETAR'
        ELSE '❌ TEM RECEPTORAS - NÃO DELETAR!'
    END as status_delecao
FROM protocolos_sincronizacao p
LEFT JOIN protocolo_receptoras pr ON pr.protocolo_id = p.id
WHERE p.id = 'ea3df11b-a390-42f0-aa72-3656f56f7e9b'
GROUP BY p.id;

-- ⚠️ Se total_receptoras_vinculadas > 0, NÃO DELETE! Pare aqui.

-- ============================================================
-- PASSO 3: LISTAR RECEPTORAS (se houver)
-- ============================================================
-- Execute esta query para ver se há receptoras (deve retornar 0 linhas)
SELECT 
    '=== RECEPTORAS VINCULADAS ===' as info,
    pr.id as protocolo_receptora_id,
    pr.receptora_id,
    r.identificacao as brinco,
    r.nome,
    pr.status,
    pr.data_inclusao
FROM protocolo_receptoras pr
JOIN receptoras r ON r.id = pr.receptora_id
WHERE pr.protocolo_id = 'ea3df11b-a390-42f0-aa72-3656f56f7e9b';

-- ⚠️ Se esta query retornar linhas, NÃO DELETE o protocolo!

-- ============================================================
-- PASSO 4: DELETAR O PROTOCOLO
-- ============================================================
-- ⚠️ APENAS EXECUTE O DELETE ABAIXO SE:
--    1. Você copiou o backup do PASSO 1 ✅
--    2. O PASSO 2 mostrou 0 receptoras vinculadas ✅
--    3. O PASSO 3 não retornou nenhuma linha ✅

-- DELETE FROM protocolos_sincronizacao
-- WHERE id = 'ea3df11b-a390-42f0-aa72-3656f56f7e9b'
-- AND NOT EXISTS (
--     SELECT 1 FROM protocolo_receptoras pr 
--     WHERE pr.protocolo_id = protocolos_sincronizacao.id
-- );

-- ============================================================
-- PASSO 5: VERIFICAR SE FOI DELETADO
-- ============================================================
-- Execute esta query após o DELETE para confirmar

-- SELECT 
--     CASE 
--         WHEN EXISTS (
--             SELECT 1 FROM protocolos_sincronizacao 
--             WHERE id = 'ea3df11b-a390-42f0-aa72-3656f56f7e9b'
--         )
--         THEN '❌ PROTOCOLO AINDA EXISTE - DELETE NÃO FUNCIONOU'
--         ELSE '✅ PROTOCOLO DELETADO COM SUCESSO!'
--     END as status_delecao;

-- ============================================================
-- FINALIZAR TRANSAÇÃO
-- ============================================================
-- Após confirmar que tudo está OK, execute:
-- COMMIT;

-- Se algo deu errado, execute:
-- ROLLBACK;

-- ⚠️ NÃO ESQUEÇA DE FAZER COMMIT ou ROLLBACK!
