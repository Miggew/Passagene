-- ============================================================================
-- Script para fechar protocolos SINCRONIZADO que não têm receptoras APTA
-- Se um protocolo não tem nenhuma receptora APTA, ele deve ser FECHADO
-- ============================================================================

-- 1. Identificar protocolos SINCRONIZADO sem receptoras APTA
SELECT 
    p.id,
    p.data_inicio,
    p.status,
    COUNT(pr.id) as total_receptoras,
    COUNT(CASE WHEN pr.status = 'APTA' THEN 1 END) as receptoras_aptas,
    COUNT(CASE WHEN pr.status = 'INAPTA' THEN 1 END) as receptoras_inaptas,
    CASE 
        WHEN COUNT(CASE WHEN pr.status = 'APTA' THEN 1 END) = 0 THEN 'FECHAR'
        ELSE 'MANTER'
    END as acao
FROM protocolos_sincronizacao p
LEFT JOIN protocolo_receptoras pr ON pr.protocolo_id = p.id
WHERE p.status = 'SINCRONIZADO'
GROUP BY p.id, p.data_inicio, p.status
HAVING COUNT(CASE WHEN pr.status = 'APTA' THEN 1 END) = 0
ORDER BY p.data_inicio DESC;

-- 2. Fechar protocolos sem receptoras APTA
UPDATE protocolos_sincronizacao
SET status = 'FECHADO'
WHERE id IN (
    SELECT p.id
    FROM protocolos_sincronizacao p
    LEFT JOIN protocolo_receptoras pr ON pr.protocolo_id = p.id
    WHERE p.status = 'SINCRONIZADO'
    GROUP BY p.id
    HAVING COUNT(CASE WHEN pr.status = 'APTA' THEN 1 END) = 0
);

-- 3. Verificar quantos foram fechados
SELECT 
    COUNT(*) as protocolos_fechados,
    'Protocolos SINCRONIZADO sem receptoras APTA foram fechados' as resultado
FROM protocolos_sincronizacao
WHERE status = 'FECHADO'
    AND id IN (
        SELECT p.id
        FROM protocolos_sincronizacao p
        LEFT JOIN protocolo_receptoras pr ON pr.protocolo_id = p.id
        GROUP BY p.id
        HAVING COUNT(CASE WHEN pr.status = 'APTA' THEN 1 END) = 0
    );

-- 4. Verificação final: Protocolos SINCRONIZADO devem ter pelo menos 1 receptora APTA
SELECT 
    p.id,
    p.data_inicio,
    p.status,
    COUNT(pr.id) as total_receptoras,
    COUNT(CASE WHEN pr.status = 'APTA' THEN 1 END) as receptoras_aptas,
    COUNT(CASE WHEN pr.status = 'INAPTA' THEN 1 END) as receptoras_inaptas
FROM protocolos_sincronizacao p
LEFT JOIN protocolo_receptoras pr ON pr.protocolo_id = p.id
WHERE p.status = 'SINCRONIZADO'
GROUP BY p.id, p.data_inicio, p.status
HAVING COUNT(CASE WHEN pr.status = 'APTA' THEN 1 END) = 0
ORDER BY p.data_inicio DESC;

-- Se esta query retornar 0 linhas, significa que todos os protocolos SINCRONIZADO têm pelo menos 1 receptora APTA
