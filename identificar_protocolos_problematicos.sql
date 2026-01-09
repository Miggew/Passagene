-- ============================================================
-- IDENTIFICAR PROTOCOLOS PROBLEMÁTICOS ESPECÍFICOS
-- ============================================================
-- Execute este script para ver os detalhes dos protocolos sem receptoras
-- ============================================================

-- 1. PROTOCOLO SEM RECEPTORAS (mais detalhes)
SELECT 
    p.id,
    p.fazenda_id,
    f.nome as fazenda_nome,
    p.data_inicio,
    p.status,
    p.passo2_data,
    p.passo2_tecnico_responsavel,
    p.created_at,
    p.observacoes,
    EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 86400 as dias_desde_criacao
FROM protocolos_sincronizacao p
LEFT JOIN fazendas f ON f.id = p.fazenda_id
LEFT JOIN protocolo_receptoras pr ON pr.protocolo_id = p.id
WHERE NOT EXISTS (
    SELECT 1 FROM protocolo_receptoras pr2 
    WHERE pr2.protocolo_id = p.id
)
ORDER BY p.created_at DESC;

-- ============================================================
-- 2. PROTOCOLO COM PASSO 2 SEM RECEPTORAS (CRÍTICO)
-- ============================================================
SELECT 
    p.id,
    p.fazenda_id,
    f.nome as fazenda_nome,
    p.data_inicio,
    p.passo2_data,
    p.passo2_tecnico_responsavel,
    p.status,
    p.created_at,
    EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 86400 as dias_desde_criacao,
    EXTRACT(EPOCH FROM (NOW() - p.passo2_data) / 86400) as dias_desde_passo2
FROM protocolos_sincronizacao p
LEFT JOIN fazendas f ON f.id = p.fazenda_id
WHERE p.passo2_data IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM protocolo_receptoras pr 
    WHERE pr.protocolo_id = p.id
)
ORDER BY p.passo2_data DESC;

-- ============================================================
-- 3. VERIFICAR SE HÁ VÍNCULOS ÓRFÃOS (protocolo_receptoras sem protocolo válido)
-- ============================================================
-- Isso não deveria acontecer, mas vamos verificar
SELECT 
    pr.id as protocolo_receptora_id,
    pr.protocolo_id,
    pr.receptora_id,
    pr.status,
    CASE WHEN p.id IS NULL THEN 'PROTOCOLO NÃO EXISTE' ELSE 'OK' END as status_protocolo
FROM protocolo_receptoras pr
LEFT JOIN protocolos_sincronizacao p ON p.id = pr.protocolo_id
WHERE p.id IS NULL;
