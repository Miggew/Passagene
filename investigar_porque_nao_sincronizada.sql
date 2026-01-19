-- Script para investigar por que a receptora "teste duplo" não aparece como SINCRONIZADA
-- na view v_protocolo_receptoras_status

-- 1. Primeiro, encontrar a receptora e o protocolo
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
),
protocolo_info AS (
    SELECT 
        ps.id as protocolo_id,
        ps.fazenda_id,
        ps.status as protocolo_status,
        ps.data_inicio,
        ps.data_retirada,
        f.nome as fazenda_nome
    FROM receptora_info ri
    JOIN protocolo_receptoras pr ON pr.receptora_id = ri.receptora_id
    JOIN protocolos_sincronizacao ps ON ps.id = pr.protocolo_id
    JOIN fazendas f ON f.id = ps.fazenda_id
    WHERE f.nome ILIKE '%bucaina%'
      AND ps.status = 'SINCRONIZADO'
    LIMIT 1
)
-- 2. Verificar o que a view retorna para essa receptora
SELECT 
    'VIEW_STATUS' as tipo,
    v.*
FROM receptora_info ri
CROSS JOIN protocolo_info pi
LEFT JOIN v_protocolo_receptoras_status v ON v.receptora_id = ri.receptora_id
WHERE v.receptora_id = ri.receptora_id
   OR v.receptora_id IS NULL;

-- 3. Verificar dados brutos que a view usa para calcular fase_ciclo
-- A view geralmente verifica:
-- - Status do protocolo (deve ser SINCRONIZADO)
-- - Status da receptora no protocolo (deve ser CONFIRMADA)
-- - Se há data_te_prevista ou data_limite_te
-- - Se não há TE já realizada

SELECT 
    'PROTOCOLO' as tipo,
    ps.id as protocolo_id,
    ps.status as protocolo_status,
    ps.data_inicio,
    ps.data_retirada,
    f.nome as fazenda_nome
FROM receptoras r
JOIN protocolo_receptoras pr ON pr.receptora_id = r.id
JOIN protocolos_sincronizacao ps ON ps.id = pr.protocolo_id
JOIN fazendas f ON f.id = ps.fazenda_id
WHERE (r.identificacao ILIKE '%teste duplo%' OR r.nome ILIKE '%teste duplo%')
  AND f.nome ILIKE '%bucaina%';

SELECT 
    'PROTOCOLO_RECEPTORA' as tipo,
    pr.id as protocolo_receptora_id,
    pr.receptora_id,
    pr.protocolo_id,
    pr.status as pr_status,
    pr.motivo_inapta,
    pr.ciclando_classificacao,
    pr.qualidade_semaforo,
    r.identificacao,
    r.nome
FROM receptoras r
JOIN protocolo_receptoras pr ON pr.receptora_id = r.id
WHERE (r.identificacao ILIKE '%teste duplo%' OR r.nome ILIKE '%teste duplo%');

-- 4. Verificar se há TE já realizada (isso pode fazer a view não retornar como SINCRONIZADA)
SELECT 
    'TRANSFERENCIAS' as tipo,
    te.*,
    r.identificacao,
    r.nome
FROM receptoras r
LEFT JOIN transferencias_embrioes te ON te.receptora_id = r.id
WHERE (r.identificacao ILIKE '%teste duplo%' OR r.nome ILIKE '%teste duplo%')
ORDER BY te.data_te DESC NULLS LAST;

-- 5. Verificar tentativas de TE
SELECT 
    'TENTATIVAS_TE' as tipo,
    tte.*,
    r.identificacao,
    r.nome
FROM receptoras r
LEFT JOIN tentativas_te tte ON tte.receptora_id = r.id
WHERE (r.identificacao ILIKE '%teste duplo%' OR r.nome ILIKE '%teste duplo%')
ORDER BY tte.data_te DESC NULLS LAST;

-- 6. Verificar diagnóstico de gestação (isso pode mudar o status)
SELECT 
    'DIAGNOSTICO_GESTACAO' as tipo,
    dg.*,
    r.identificacao,
    r.nome
FROM receptoras r
LEFT JOIN diagnosticos_gestacao dg ON dg.receptora_id = r.id
WHERE (r.identificacao ILIKE '%teste duplo%' OR r.nome ILIKE '%teste duplo%')
ORDER BY dg.data_diagnostico DESC NULLS LAST;

-- 7. Verificar status_reprodutivo da receptora
SELECT 
    'RECEPTORA_STATUS' as tipo,
    r.id,
    r.identificacao,
    r.nome,
    r.status_reprodutivo,
    f.nome as fazenda_atual
FROM receptoras r
LEFT JOIN vw_receptoras_fazenda_atual vw ON vw.receptora_id = r.id
LEFT JOIN fazendas f ON f.id = vw.fazenda_id_atual
WHERE (r.identificacao ILIKE '%teste duplo%' OR r.nome ILIKE '%teste duplo%');

-- 8. QUERY COMPLETA: Verificar todos os dados de uma vez
-- Esta query mostra tudo que pode afetar o status na view
SELECT 
    'RESUMO_COMPLETO' as tipo,
    r.id as receptora_id,
    r.identificacao,
    r.nome,
    r.status_reprodutivo as status_receptora,
    ps.id as protocolo_id,
    ps.status as protocolo_status,
    ps.data_inicio as protocolo_data_inicio,
    ps.data_retirada as protocolo_data_retirada,
    pr.status as pr_status,
    pr.motivo_inapta,
    pr.ciclando_classificacao,
    pr.qualidade_semaforo,
    f.nome as fazenda_nome,
    CASE 
        WHEN te.id IS NOT NULL THEN 'TEM_TE'
        ELSE 'SEM_TE'
    END as tem_transferencia,
    CASE 
        WHEN dg.id IS NOT NULL THEN 'TEM_DIAGNOSTICO'
        ELSE 'SEM_DIAGNOSTICO'
    END as tem_diagnostico,
    v.fase_ciclo as fase_ciclo_view,
    v.status_efetivo as status_efetivo_view,
    v.data_te_prevista as data_te_prevista_view,
    v.data_limite_te as data_limite_te_view
FROM receptoras r
JOIN protocolo_receptoras pr ON pr.receptora_id = r.id
JOIN protocolos_sincronizacao ps ON ps.id = pr.protocolo_id
JOIN fazendas f ON f.id = ps.fazenda_id
LEFT JOIN transferencias_embrioes te ON te.receptora_id = r.id AND te.status_te = 'REALIZADA'
LEFT JOIN diagnosticos_gestacao dg ON dg.receptora_id = r.id
LEFT JOIN v_protocolo_receptoras_status v ON v.receptora_id = r.id
WHERE (r.identificacao ILIKE '%teste duplo%' OR r.nome ILIKE '%teste duplo%')
  AND f.nome ILIKE '%bucaina%';
