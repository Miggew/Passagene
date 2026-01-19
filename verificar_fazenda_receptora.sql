-- Verificar a qual fazenda a receptora 15f77862-9821-482b-8019-1e6c9c714223 está vinculada

SELECT 
    r.id AS receptora_id,
    r.identificacao,
    r.nome,
    r.status_reprodutivo,
    rfh.id AS vinculo_id,
    rfh.fazenda_id,
    f.nome AS fazenda_nome,
    f.id AS fazenda_id_completo,
    rfh.data_inicio,
    rfh.data_fim,
    CASE 
        WHEN rfh.data_fim IS NULL THEN '✅ VÍNCULO ATIVO'
        ELSE '❌ VÍNCULO FECHADO'
    END AS status_vinculo,
    rfh.observacoes
FROM receptoras r
LEFT JOIN receptora_fazenda_historico rfh ON rfh.receptora_id = r.id
LEFT JOIN fazendas f ON f.id = rfh.fazenda_id
WHERE r.id = '15f77862-9821-482b-8019-1e6c9c714223'
ORDER BY rfh.data_inicio DESC NULLS LAST;

-- Verificar também na view vw_receptoras_fazenda_atual
SELECT 
    'VIEW_FAZENDA_ATUAL' AS tipo,
    vw.receptora_id,
    r.identificacao,
    r.nome,
    vw.fazenda_id_atual,
    vw.fazenda_nome_atual,
    vw.data_inicio_atual
FROM vw_receptoras_fazenda_atual vw
JOIN receptoras r ON r.id = vw.receptora_id
WHERE vw.receptora_id = '15f77862-9821-482b-8019-1e6c9c714223';

-- Verificar protocolo vinculado
SELECT 
    'PROTOCOLO' AS tipo,
    ps.id AS protocolo_id,
    ps.fazenda_id AS protocolo_fazenda_id,
    f.nome AS protocolo_fazenda_nome,
    ps.status AS protocolo_status,
    ps.data_inicio,
    r.identificacao,
    r.nome AS receptora_nome
FROM protocolo_receptoras pr
JOIN protocolos_sincronizacao ps ON ps.id = pr.protocolo_id
JOIN fazendas f ON f.id = ps.fazenda_id
JOIN receptoras r ON r.id = pr.receptora_id
WHERE pr.receptora_id = '15f77862-9821-482b-8019-1e6c9c714223'
  AND pr.protocolo_id = '24c55d63-fd3f-479f-8e8f-7f5d576f7b6b';
