-- ============================================================
-- Debug: Verificar por que receptora não aparece na lista
-- ============================================================
-- Objetivo: Verificar se a receptora está no histórico
--           e se aparece na view vw_receptoras_fazenda_atual
-- ============================================================

-- Substitua 'RECEPTORA_ID_AQUI' pelo ID da receptora que não está aparecendo
-- Exemplo: '4f93ad81-d3d1-4a69-a213-33ce48da801d'

-- 1. Verificar se a receptora existe na tabela receptoras
SELECT 
    id,
    identificacao,
    nome,
    fazenda_atual_id,
    created_at
FROM receptoras
WHERE id = 'RECEPTORA_ID_AQUI';  -- SUBSTITUA PELO ID DA RECEPTORA

-- 2. Verificar se a receptora tem registro no histórico
SELECT 
    id,
    receptora_id,
    fazenda_id,
    data_inicio,
    data_fim,
    created_at,
    updated_at
FROM receptora_fazenda_historico
WHERE receptora_id = 'RECEPTORA_ID_AQUI'  -- SUBSTITUA PELO ID DA RECEPTORA
ORDER BY data_inicio DESC, created_at DESC;

-- 3. Verificar se a receptora aparece na view
SELECT 
    receptora_id,
    fazenda_id_atual,
    fazenda_nome_atual,
    data_inicio_atual
FROM vw_receptoras_fazenda_atual
WHERE receptora_id = 'RECEPTORA_ID_AQUI';  -- SUBSTITUA PELO ID DA RECEPTORA

-- 4. Verificar protocolos da receptora
SELECT 
    pr.id,
    pr.protocolo_id,
    pr.receptora_id,
    pr.status as pr_status,
    ps.status as protocolo_status,
    ps.data_inicio as protocolo_data_inicio
FROM protocolo_receptoras pr
INNER JOIN protocolos_sincronizacao ps ON pr.protocolo_id = ps.id
WHERE pr.receptora_id = 'RECEPTORA_ID_AQUI'  -- SUBSTITUA PELO ID DA RECEPTORA
ORDER BY ps.data_inicio DESC;
