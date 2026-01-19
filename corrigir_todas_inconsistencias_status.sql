-- ============================================================================
-- Script para corrigir TODAS as inconsistências de status_reprodutivo
-- Este script corrige receptoras descartadas e aprovadas que estão inconsistentes
-- ============================================================================

-- CORREÇÃO 1: Atualizar receptoras descartadas (INAPTA) para VAZIA
-- Receptoras descartadas em protocolos SINCRONIZADO/FECHADO devem ter status_reprodutivo = 'VAZIA'
UPDATE receptoras
SET status_reprodutivo = 'VAZIA'
WHERE id IN (
    SELECT DISTINCT pr.receptora_id
    FROM protocolo_receptoras pr
    JOIN protocolos_sincronizacao p ON p.id = pr.protocolo_id
    JOIN receptoras r ON r.id = pr.receptora_id
    WHERE pr.status = 'INAPTA'
        AND r.status_reprodutivo = 'SINCRONIZADA'
        AND p.status IN ('SINCRONIZADO', 'FECHADO')
);

-- Verificar quantas foram corrigidas (INAPTA)
SELECT 
    COUNT(*) as receptoras_corrigidas,
    'INAPTA → VAZIA' as correcao
FROM receptoras r
JOIN protocolo_receptoras pr ON pr.receptora_id = r.id
JOIN protocolos_sincronizacao p ON p.id = pr.protocolo_id
WHERE pr.status = 'INAPTA'
    AND r.status_reprodutivo = 'VAZIA'
    AND p.status IN ('SINCRONIZADO', 'FECHADO');

-- CORREÇÃO 2: Atualizar receptoras aprovadas (APTA) para SINCRONIZADA
-- Receptoras aprovadas em protocolos SINCRONIZADO/FECHADO devem ter status_reprodutivo = 'SINCRONIZADA'
UPDATE receptoras
SET status_reprodutivo = 'SINCRONIZADA'
WHERE id IN (
    SELECT DISTINCT pr.receptora_id
    FROM protocolo_receptoras pr
    JOIN protocolos_sincronizacao p ON p.id = pr.protocolo_id
    JOIN receptoras r ON r.id = pr.receptora_id
    WHERE pr.status = 'APTA'
        AND (r.status_reprodutivo IS NULL OR r.status_reprodutivo != 'SINCRONIZADA')
        AND p.status IN ('SINCRONIZADO', 'FECHADO')
);

-- Verificar quantas foram corrigidas (APTA)
SELECT 
    COUNT(*) as receptoras_corrigidas,
    'APTA → SINCRONIZADA' as correcao
FROM receptoras r
JOIN protocolo_receptoras pr ON pr.receptora_id = r.id
JOIN protocolos_sincronizacao p ON p.id = pr.protocolo_id
WHERE pr.status = 'APTA'
    AND r.status_reprodutivo = 'SINCRONIZADA'
    AND p.status IN ('SINCRONIZADO', 'FECHADO');

-- VERIFICAÇÃO FINAL: Listar todas as inconsistências restantes (deve retornar 0 linhas se tudo estiver correto)
SELECT 
    pr.receptora_id,
    r.identificacao,
    pr.status as status_no_protocolo,
    r.status_reprodutivo,
    p.status as status_protocolo,
    CASE 
        WHEN pr.status = 'INAPTA' AND r.status_reprodutivo = 'SINCRONIZADA' THEN 'INCONSISTÊNCIA: Descartada mas status SINCRONIZADA'
        WHEN pr.status = 'APTA' AND (r.status_reprodutivo IS NULL OR r.status_reprodutivo != 'SINCRONIZADA') THEN 'INCONSISTÊNCIA: Aprovada mas status não SINCRONIZADA'
        ELSE 'OK'
    END as situacao
FROM protocolo_receptoras pr
JOIN receptoras r ON r.id = pr.receptora_id
JOIN protocolos_sincronizacao p ON p.id = pr.protocolo_id
WHERE p.status IN ('SINCRONIZADO', 'FECHADO')
    AND (
        (pr.status = 'INAPTA' AND r.status_reprodutivo = 'SINCRONIZADA')
        OR (pr.status = 'APTA' AND (r.status_reprodutivo IS NULL OR r.status_reprodutivo != 'SINCRONIZADA'))
    )
ORDER BY pr.data_inclusao;
