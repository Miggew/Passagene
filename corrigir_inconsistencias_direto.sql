-- ============================================================================
-- Script DIRETO para corrigir inconsistências de status_reprodutivo
-- Atualiza diretamente receptoras que estão inconsistentes
-- ============================================================================

-- CORREÇÃO 1: Atualizar receptoras descartadas (INAPTA) para VAZIA
-- Lista os IDs das receptoras que precisam ser corrigidas
SELECT 
    r.id,
    r.identificacao,
    pr.status as status_no_protocolo,
    r.status_reprodutivo as status_atual,
    'VAZIA' as novo_status
FROM receptoras r
JOIN protocolo_receptoras pr ON pr.receptora_id = r.id
JOIN protocolos_sincronizacao p ON p.id = pr.protocolo_id
WHERE pr.status = 'INAPTA'
    AND r.status_reprodutivo = 'SINCRONIZADA'
    AND p.status IN ('SINCRONIZADO', 'FECHADO')
ORDER BY r.identificacao;

-- Atualizar essas receptoras para VAZIA
UPDATE receptoras
SET status_reprodutivo = 'VAZIA'
WHERE id IN (
    SELECT DISTINCT r.id
    FROM receptoras r
    JOIN protocolo_receptoras pr ON pr.receptora_id = r.id
    JOIN protocolos_sincronizacao p ON p.id = pr.protocolo_id
    WHERE pr.status = 'INAPTA'
        AND r.status_reprodutivo = 'SINCRONIZADA'
        AND p.status IN ('SINCRONIZADO', 'FECHADO')
);

-- Verificar se foi atualizado
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
-- Lista os IDs das receptoras que precisam ser corrigidas
SELECT 
    r.id,
    r.identificacao,
    pr.status as status_no_protocolo,
    r.status_reprodutivo as status_atual,
    'SINCRONIZADA' as novo_status
FROM receptoras r
JOIN protocolo_receptoras pr ON pr.receptora_id = r.id
JOIN protocolos_sincronizacao p ON p.id = pr.protocolo_id
WHERE pr.status = 'APTA'
    AND (r.status_reprodutivo IS NULL OR r.status_reprodutivo != 'SINCRONIZADA')
    AND p.status IN ('SINCRONIZADO', 'FECHADO')
ORDER BY r.identificacao;

-- Atualizar essas receptoras para SINCRONIZADA
UPDATE receptoras
SET status_reprodutivo = 'SINCRONIZADA'
WHERE id IN (
    SELECT DISTINCT r.id
    FROM receptoras r
    JOIN protocolo_receptoras pr ON pr.receptora_id = r.id
    JOIN protocolos_sincronizacao p ON p.id = pr.protocolo_id
    WHERE pr.status = 'APTA'
        AND (r.status_reprodutivo IS NULL OR r.status_reprodutivo != 'SINCRONIZADA')
        AND p.status IN ('SINCRONIZADO', 'FECHADO')
);

-- Verificar se foi atualizado
SELECT 
    COUNT(*) as receptoras_corrigidas,
    'APTA → SINCRONIZADA' as correcao
FROM receptoras r
JOIN protocolo_receptoras pr ON pr.receptora_id = r.id
JOIN protocolos_sincronizacao p ON p.id = pr.protocolo_id
WHERE pr.status = 'APTA'
    AND r.status_reprodutivo = 'SINCRONIZADA'
    AND p.status IN ('SINCRONIZADO', 'FECHADO');

-- VERIFICAÇÃO FINAL: Deve retornar 0 linhas se tudo estiver correto
SELECT 
    pr.receptora_id,
    r.identificacao,
    pr.status as status_no_protocolo,
    r.status_reprodutivo,
    p.status as status_protocolo,
    pr.motivo_inapta,
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
ORDER BY r.identificacao;
