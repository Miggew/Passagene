-- Script para investigar o problema da receptora "teste duplo" na fazenda Bucaina
-- Protocolo sincronizado mas receptora não aparece no menu TE

-- 1. Verificar se a receptora existe e está na fazenda Bucaina
SELECT 
    r.id as receptora_id,
    r.identificacao,
    r.nome,
    r.status_reprodutivo,
    f.id as fazenda_id,
    f.nome as fazenda_nome
FROM receptoras r
LEFT JOIN vw_receptoras_fazenda_atual vw ON vw.receptora_id = r.id
LEFT JOIN fazendas f ON f.id = vw.fazenda_id_atual
WHERE r.identificacao ILIKE '%teste duplo%'
   OR r.nome ILIKE '%teste duplo%';

-- 2. Verificar protocolos na fazenda Bucaina
SELECT 
    ps.id as protocolo_id,
    ps.fazenda_id,
    ps.status,
    ps.data_inicio,
    ps.data_retirada,
    f.nome as fazenda_nome
FROM protocolos_sincronizacao ps
JOIN fazendas f ON f.id = ps.fazenda_id
WHERE f.nome ILIKE '%bucaina%'
ORDER BY ps.data_inicio DESC;

-- 3. Verificar receptoras vinculadas ao protocolo sincronizado na Bucaina
SELECT 
    pr.id as protocolo_receptora_id,
    pr.protocolo_id,
    pr.receptora_id,
    pr.status as pr_status,
    pr.motivo_inapta,
    r.identificacao,
    r.nome,
    ps.status as protocolo_status,
    f.nome as fazenda_nome
FROM protocolo_receptoras pr
JOIN receptoras r ON r.id = pr.receptora_id
JOIN protocolos_sincronizacao ps ON ps.id = pr.protocolo_id
JOIN fazendas f ON f.id = ps.fazenda_id
WHERE f.nome ILIKE '%bucaina%'
  AND ps.status = 'SINCRONIZADO'
  AND (r.identificacao ILIKE '%teste duplo%' OR r.nome ILIKE '%teste duplo%');

-- 4. Verificar o que a view v_protocolo_receptoras_status retorna para essa receptora
SELECT 
    v.*
FROM v_protocolo_receptoras_status v
JOIN receptoras r ON r.id = v.receptora_id
WHERE (r.identificacao ILIKE '%teste duplo%' OR r.nome ILIKE '%teste duplo%');

-- 5. Verificar fazenda atual da receptora usando a view
SELECT 
    vw.*,
    f.nome as fazenda_nome
FROM vw_receptoras_fazenda_atual vw
JOIN receptoras r ON r.id = vw.receptora_id
JOIN fazendas f ON f.id = vw.fazenda_id_atual
WHERE (r.identificacao ILIKE '%teste duplo%' OR r.nome ILIKE '%teste duplo%');

-- 6. Verificar histórico de TE para essa receptora
SELECT 
    te.*,
    r.identificacao,
    r.nome
FROM transferencias_embrioes te
JOIN receptoras r ON r.id = te.receptora_id
WHERE (r.identificacao ILIKE '%teste duplo%' OR r.nome ILIKE '%teste duplo%')
ORDER BY te.data_te DESC;

-- 7. Verificar se há tentativas de TE relacionadas
SELECT 
    tte.*,
    r.identificacao,
    r.nome
FROM tentativas_te tte
JOIN receptoras r ON r.id = tte.receptora_id
WHERE (r.identificacao ILIKE '%teste duplo%' OR r.nome ILIKE '%teste duplo%')
ORDER BY tte.data_te DESC;

-- 8. Verificar diagnóstico de gestação
SELECT 
    dg.*,
    r.identificacao,
    r.nome
FROM diagnosticos_gestacao dg
JOIN receptoras r ON r.id = dg.receptora_id
WHERE (r.identificacao ILIKE '%teste duplo%' OR r.nome ILIKE '%teste duplo%')
ORDER BY dg.data_diagnostico DESC;

-- 9. DIAGNÓSTICO COMPLETO: Verificar todos os dados relacionados
-- Esta query mostra tudo de uma vez para facilitar o diagnóstico
WITH receptora_info AS (
    SELECT 
        r.id as receptora_id,
        r.identificacao,
        r.nome,
        r.status_reprodutivo
    FROM receptoras r
    WHERE r.identificacao ILIKE '%teste duplo%'
       OR r.nome ILIKE '%teste duplo%'
    LIMIT 1
)
SELECT 
    'RECEPTORA' as tipo,
    ri.receptora_id::text as id,
    ri.identificacao as nome_identificacao,
    ri.status_reprodutivo as status,
    NULL::text as fazenda,
    NULL::text as protocolo_status
FROM receptora_info ri

UNION ALL

SELECT 
    'FAZENDA_ATUAL' as tipo,
    vw.receptora_id::text as id,
    f.nome as nome_identificacao,
    NULL::text as status,
    f.nome as fazenda,
    NULL::text as protocolo_status
FROM receptora_info ri
JOIN vw_receptoras_fazenda_atual vw ON vw.receptora_id = ri.receptora_id
JOIN fazendas f ON f.id = vw.fazenda_id_atual

UNION ALL

SELECT 
    'PROTOCOLO' as tipo,
    ps.id::text as id,
    ps.status as nome_identificacao,
    NULL::text as status,
    f.nome as fazenda,
    ps.status as protocolo_status
FROM receptora_info ri
JOIN protocolo_receptoras pr ON pr.receptora_id = ri.receptora_id
JOIN protocolos_sincronizacao ps ON ps.id = pr.protocolo_id
JOIN fazendas f ON f.id = ps.fazenda_id

UNION ALL

SELECT 
    'PROTOCOLO_RECEPTORA' as tipo,
    pr.id::text as id,
    pr.status as nome_identificacao,
    pr.motivo_inapta as status,
    f.nome as fazenda,
    ps.status as protocolo_status
FROM receptora_info ri
JOIN protocolo_receptoras pr ON pr.receptora_id = ri.receptora_id
JOIN protocolos_sincronizacao ps ON ps.id = pr.protocolo_id
JOIN fazendas f ON f.id = ps.fazenda_id

UNION ALL

SELECT 
    'VIEW_STATUS' as tipo,
    v.receptora_id::text as id,
    v.fase_ciclo as nome_identificacao,
    v.status_efetivo as status,
    NULL::text as fazenda,
    NULL::text as protocolo_status
FROM receptora_info ri
JOIN v_protocolo_receptoras_status v ON v.receptora_id = ri.receptora_id

ORDER BY tipo, id;
