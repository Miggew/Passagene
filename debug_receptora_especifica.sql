-- ============================================================
-- Debug: Verificar receptora específica que não aparece
-- ============================================================
-- Receptora ID: a72a6339-98b0-4620-9cdb-a0609e23c94f
-- ============================================================

-- 1. Verificar se a receptora existe na tabela receptoras
SELECT 
    id,
    identificacao,
    nome,
    fazenda_atual_id,
    created_at
FROM receptoras
WHERE id = 'a72a6339-98b0-4620-9cdb-a0609e23c94f';

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
WHERE receptora_id = 'a72a6339-98b0-4620-9cdb-a0609e23c94f'
ORDER BY data_inicio DESC, created_at DESC;

-- 3. Verificar se a receptora aparece na view
SELECT 
    receptora_id,
    fazenda_id_atual,
    fazenda_nome_atual,
    data_inicio_atual
FROM vw_receptoras_fazenda_atual
WHERE receptora_id = 'a72a6339-98b0-4620-9cdb-a0609e23c94f';

-- 4. Verificar protocolos da receptora
SELECT 
    pr.id,
    pr.protocolo_id,
    pr.receptora_id,
    pr.status as pr_status,
    ps.status as protocolo_status,
    ps.data_inicio as protocolo_data_inicio,
    ps.fazenda_id as protocolo_fazenda_id
FROM protocolo_receptoras pr
INNER JOIN protocolos_sincronizacao ps ON pr.protocolo_id = ps.id
WHERE pr.receptora_id = 'a72a6339-98b0-4620-9cdb-a0609e23c94f'
ORDER BY ps.data_inicio DESC;

-- 5. Verificar se há outras receptoras na mesma fazenda que aparecem na view
--    (para entender se o problema é específico desta receptora)
SELECT 
    r.id,
    r.identificacao,
    r.fazenda_atual_id,
    CASE 
        WHEN v.receptora_id IS NOT NULL THEN 'Aparece na view'
        ELSE 'NÃO aparece na view'
    END as status_view
FROM receptoras r
LEFT JOIN vw_receptoras_fazenda_atual v ON r.id = v.receptora_id
WHERE r.fazenda_atual_id = (
    SELECT fazenda_atual_id 
    FROM receptoras 
    WHERE id = 'a72a6339-98b0-4620-9cdb-a0609e23c94f'
)
ORDER BY r.identificacao;
