-- ============================================================
-- AUDITORIA: Protocolos sem Receptoras Vinculadas
-- ============================================================
-- Este script identifica protocolos que não possuem receptoras vinculadas
-- Use este script para identificar inconsistências antes de fazer limpeza
-- ============================================================

-- 1. LISTAR TODOS OS PROTOCOLOS SEM RECEPTORAS VINCULADAS
SELECT 
    p.id,
    p.fazenda_id,
    f.nome as fazenda_nome,
    p.data_inicio,
    p.status,
    p.passo2_data,
    p.created_at,
    COUNT(pr.id) as receptoras_count
FROM protocolos_sincronizacao p
LEFT JOIN fazendas f ON f.id = p.fazenda_id
LEFT JOIN protocolo_receptoras pr ON pr.protocolo_id = p.id
GROUP BY p.id, p.fazenda_id, f.nome, p.data_inicio, p.status, p.passo2_data, p.created_at
HAVING COUNT(pr.id) = 0
ORDER BY p.created_at DESC;

-- ============================================================
-- 2. ESTATÍSTICAS POR STATUS
-- ============================================================
SELECT 
    p.status,
    COUNT(DISTINCT p.id) as total_protocolos,
    COUNT(DISTINCT CASE WHEN pr.id IS NULL THEN p.id END) as protocolos_sem_receptoras,
    ROUND(
        COUNT(DISTINCT CASE WHEN pr.id IS NULL THEN p.id END)::numeric / 
        NULLIF(COUNT(DISTINCT p.id), 0) * 100, 
        2
    ) as percentual_sem_receptoras
FROM protocolos_sincronizacao p
LEFT JOIN protocolo_receptoras pr ON pr.protocolo_id = p.id
GROUP BY p.status
ORDER BY p.status;

-- ============================================================
-- 3. PROTOCOLOS SEM RECEPTORAS CRIADOS RECENTEMENTE (últimos 30 dias)
-- ============================================================
-- Úteis para identificar protocolos problemáticos criados recentemente
SELECT 
    p.id,
    p.fazenda_id,
    f.nome as fazenda_nome,
    p.data_inicio,
    p.status,
    p.created_at,
    EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 86400 as dias_desde_criacao
FROM protocolos_sincronizacao p
LEFT JOIN fazendas f ON f.id = p.fazenda_id
LEFT JOIN protocolo_receptoras pr ON pr.protocolo_id = p.id
WHERE p.created_at >= NOW() - INTERVAL '30 days'
GROUP BY p.id, p.fazenda_id, f.nome, p.data_inicio, p.status, p.created_at
HAVING COUNT(pr.id) = 0
ORDER BY p.created_at DESC;

-- ============================================================
-- 4. PROTOCOLOS COM PASSO2_DATA MAS SEM RECEPTORAS (crítico)
-- ============================================================
-- Protocolos que iniciaram o Passo 2 mas não têm receptoras
SELECT 
    p.id,
    p.fazenda_id,
    f.nome as fazenda_nome,
    p.data_inicio,
    p.passo2_data,
    p.passo2_tecnico_responsavel,
    p.status,
    p.created_at
FROM protocolos_sincronizacao p
LEFT JOIN fazendas f ON f.id = p.fazenda_id
LEFT JOIN protocolo_receptoras pr ON pr.protocolo_id = p.id
WHERE p.passo2_data IS NOT NULL
GROUP BY p.id, p.fazenda_id, f.nome, p.data_inicio, p.passo2_data, p.passo2_tecnico_responsavel, p.status, p.created_at
HAVING COUNT(pr.id) = 0
ORDER BY p.passo2_data DESC;

-- ============================================================
-- 5. RESUMO GERAL
-- ============================================================
SELECT 
    'Total de Protocolos' as metrica,
    COUNT(*)::text as valor
FROM protocolos_sincronizacao
UNION ALL
SELECT 
    'Protocolos sem Receptoras' as metrica,
    COUNT(*)::text as valor
FROM (
    SELECT p.id
    FROM protocolos_sincronizacao p
    LEFT JOIN protocolo_receptoras pr ON pr.protocolo_id = p.id
    GROUP BY p.id
    HAVING COUNT(pr.id) = 0
) as protocolos_sem_receptoras
UNION ALL
SELECT 
    'Protocolos com Passo 2 sem Receptoras' as metrica,
    COUNT(*)::text as valor
FROM (
    SELECT p.id
    FROM protocolos_sincronizacao p
    LEFT JOIN protocolo_receptoras pr ON pr.protocolo_id = p.id
    WHERE p.passo2_data IS NOT NULL
    GROUP BY p.id
    HAVING COUNT(pr.id) = 0
) as protocolos_criticos;
