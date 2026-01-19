-- ============================================================================
-- Investigar inconsistência: Protocolo SINCRONIZADO com receptoras descartadas
-- Protocolo ID: 545884c4-efca-4e1e-8b30-a2a52646c54f
-- ============================================================================

-- 1. Verificar status do protocolo
SELECT 
    id,
    fazenda_id,
    data_inicio,
    passo2_data,
    status as status_protocolo,
    data_retirada
FROM protocolos_sincronizacao
WHERE id = '545884c4-efca-4e1e-8b30-a2a52646c54f';

-- 2. Verificar status das receptoras no protocolo
SELECT 
    pr.id as protocolo_receptora_id,
    pr.receptora_id,
    r.identificacao,
    r.status_reprodutivo,
    pr.status as status_no_protocolo,
    pr.motivo_inapta
FROM protocolo_receptoras pr
JOIN receptoras r ON r.id = pr.receptora_id
WHERE pr.protocolo_id = '545884c4-efca-4e1e-8b30-a2a52646c54f'
ORDER BY pr.data_inclusao;

-- 3. Verificar se receptoras descartadas aparecem como SINCRONIZADA (bug!)
SELECT 
    pr.receptora_id,
    r.identificacao,
    pr.status as status_no_protocolo,
    r.status_reprodutivo,
    CASE 
        WHEN pr.status = 'INAPTA' AND r.status_reprodutivo = 'SINCRONIZADA' THEN 'INCONSISTÊNCIA: Descartada mas status SINCRONIZADA'
        WHEN pr.status = 'APTA' AND r.status_reprodutivo != 'SINCRONIZADA' THEN 'INCONSISTÊNCIA: Aprovada mas status não SINCRONIZADA'
        ELSE 'OK'
    END as situacao
FROM protocolo_receptoras pr
JOIN receptoras r ON r.id = pr.receptora_id
WHERE pr.protocolo_id = '545884c4-efca-4e1e-8b30-a2a52646c54f';

-- 4. Verificar se essas receptoras aparecem na view usada pelo menu de TE
SELECT 
    v.receptora_id,
    r.identificacao,
    v.fase_ciclo,
    v.status_efetivo,
    pr.status as status_no_protocolo
FROM v_protocolo_receptoras_status v
JOIN receptoras r ON r.id = v.receptora_id
JOIN protocolo_receptoras pr ON pr.receptora_id = v.receptora_id AND pr.protocolo_id = v.protocolo_id
WHERE v.protocolo_id = '545884c4-efca-4e1e-8b30-a2a52646c54f'
    AND v.fase_ciclo = 'SINCRONIZADA'
    AND pr.status = 'INAPTA';

-- 5. Verificar TEs realizadas neste protocolo
SELECT 
    te.id,
    te.receptora_id,
    r.identificacao,
    te.status_te,
    te.data_te,
    pr.status as status_receptora_no_protocolo
FROM tentativas_te te
JOIN receptoras r ON r.id = te.receptora_id
JOIN protocolo_receptoras pr ON pr.receptora_id = te.receptora_id AND pr.protocolo_id = te.protocolo_id
WHERE te.protocolo_id = '545884c4-efca-4e1e-8b30-a2a52646c54f';
