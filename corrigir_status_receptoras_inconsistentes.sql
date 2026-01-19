-- ============================================================================
-- Script para corrigir inconsistências de status_reprodutivo
-- Receptoras descartadas (INAPTA) em protocolos SINCRONIZADO devem ter status_reprodutivo = 'VAZIA'
-- ============================================================================

-- 1. Verificar inconsistências
SELECT 
    pr.receptora_id,
    r.identificacao,
    pr.status as status_no_protocolo,
    r.status_reprodutivo,
    p.status as status_protocolo,
    'INCONSISTÊNCIA: Descartada mas status SINCRONIZADA' as problema
FROM protocolo_receptoras pr
JOIN receptoras r ON r.id = pr.receptora_id
JOIN protocolos_sincronizacao p ON p.id = pr.protocolo_id
WHERE pr.status = 'INAPTA'
    AND r.status_reprodutivo = 'SINCRONIZADA'
    AND p.status IN ('SINCRONIZADO', 'FECHADO');

-- 2. Corrigir: Atualizar status_reprodutivo para VAZIA em receptoras descartadas
-- Usar subquery separada para evitar problema com auto-referência
UPDATE receptoras r
SET status_reprodutivo = 'VAZIA'
FROM protocolo_receptoras pr
JOIN protocolos_sincronizacao p ON p.id = pr.protocolo_id
WHERE r.id = pr.receptora_id
    AND pr.status = 'INAPTA'
    AND r.status_reprodutivo = 'SINCRONIZADA'
    AND p.status IN ('SINCRONIZADO', 'FECHADO');

-- 3. Verificar também receptoras APTA que não estão SINCRONIZADA
SELECT 
    pr.receptora_id,
    r.identificacao,
    pr.status as status_no_protocolo,
    r.status_reprodutivo,
    p.status as status_protocolo,
    'INCONSISTÊNCIA: Aprovada mas status não SINCRONIZADA' as problema
FROM protocolo_receptoras pr
JOIN receptoras r ON r.id = pr.receptora_id
JOIN protocolos_sincronizacao p ON p.id = pr.protocolo_id
WHERE pr.status = 'APTA'
    AND r.status_reprodutivo != 'SINCRONIZADA'
    AND p.status IN ('SINCRONIZADO', 'FECHADO');

-- 4. Corrigir: Atualizar status_reprodutivo para SINCRONIZADA em receptoras aprovadas
-- Usar subquery separada para evitar problema com auto-referência
UPDATE receptoras r
SET status_reprodutivo = 'SINCRONIZADA'
FROM protocolo_receptoras pr
JOIN protocolos_sincronizacao p ON p.id = pr.protocolo_id
WHERE r.id = pr.receptora_id
    AND pr.status = 'APTA'
    AND (r.status_reprodutivo IS NULL OR r.status_reprodutivo != 'SINCRONIZADA')
    AND p.status IN ('SINCRONIZADO', 'FECHADO');

-- 5. Verificar o protocolo específico mencionado
SELECT 
    pr.receptora_id,
    r.identificacao,
    pr.status as status_no_protocolo,
    r.status_reprodutivo,
    pr.motivo_inapta,
    CASE 
        WHEN pr.status = 'INAPTA' AND r.status_reprodutivo = 'SINCRONIZADA' THEN 'INCONSISTÊNCIA: Descartada mas status SINCRONIZADA'
        WHEN pr.status = 'APTA' AND r.status_reprodutivo != 'SINCRONIZADA' THEN 'INCONSISTÊNCIA: Aprovada mas status não SINCRONIZADA'
        ELSE 'OK'
    END as situacao
FROM protocolo_receptoras pr
JOIN receptoras r ON r.id = pr.receptora_id
WHERE pr.protocolo_id = '545884c4-efca-4e1e-8b30-a2a52646c54f'
ORDER BY pr.data_inclusao;
