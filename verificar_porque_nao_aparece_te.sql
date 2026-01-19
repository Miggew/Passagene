-- Script para verificar por que a receptora "teste duplo" não aparece no menu TE
-- mesmo estando como SINCRONIZADA na view

-- ID da receptora que está como SINCRONIZADA
-- receptora_id: 15f77862-9821-482b-8019-1e6c9c714223
-- protocolo_id: 24c55d63-fd3f-479f-8e8f-7f5d576f7b6b

-- 1. Verificar se a receptora está na fazenda Bucaina (usando vw_receptoras_fazenda_atual)
SELECT 
    'FAZENDA_ATUAL' as tipo,
    vw.receptora_id,
    vw.fazenda_id_atual,
    f.nome as fazenda_nome,
    r.identificacao,
    r.nome
FROM vw_receptoras_fazenda_atual vw
JOIN receptoras r ON r.id = vw.receptora_id
JOIN fazendas f ON f.id = vw.fazenda_id_atual
WHERE vw.receptora_id = '15f77862-9821-482b-8019-1e6c9c714223';

-- 2. Verificar o que a view v_protocolo_receptoras_status retorna para essa receptora
SELECT 
    'VIEW_STATUS' as tipo,
    v.*
FROM v_protocolo_receptoras_status v
WHERE v.receptora_id = '15f77862-9821-482b-8019-1e6c9c714223'
  AND v.fase_ciclo = 'SINCRONIZADA';

-- 3. Verificar se há alguma transferência que possa estar impedindo
SELECT 
    'TRANSFERENCIAS' as tipo,
    te.*
FROM transferencias_embrioes te
WHERE te.receptora_id = '15f77862-9821-482b-8019-1e6c9c714223'
ORDER BY te.data_te DESC;

-- 4. Verificar o status em protocolo_receptoras
SELECT 
    'PROTOCOLO_RECEPTORA' as tipo,
    pr.*,
    ps.status as protocolo_status,
    f.nome as fazenda_nome
FROM protocolo_receptoras pr
JOIN protocolos_sincronizacao ps ON ps.id = pr.protocolo_id
JOIN fazendas f ON f.id = ps.fazenda_id
WHERE pr.receptora_id = '15f77862-9821-482b-8019-1e6c9c714223'
  AND pr.protocolo_id = '24c55d63-fd3f-479f-8e8f-7f5d576f7b6b';

-- 5. QUERY COMPLETA: Simular o que o código faz
-- O código busca fazendas que têm receptoras sincronizadas
-- Depois filtra receptoras da fazenda selecionada que estão como SINCRONIZADA
SELECT 
    'SIMULACAO_CODIGO' as tipo,
    v.receptora_id,
    r.identificacao,
    r.nome,
    v.fase_ciclo,
    v.status_efetivo,
    vw.fazenda_id_atual,
    f.nome as fazenda_nome,
    CASE 
        WHEN vw.fazenda_id_atual IS NULL THEN '❌ NÃO ESTÁ NA FAZENDA'
        WHEN v.fase_ciclo != 'SINCRONIZADA' THEN '❌ NÃO ESTÁ COMO SINCRONIZADA'
        WHEN pr.status = 'INAPTA' THEN '❌ ESTÁ COMO INAPTA'
        ELSE '✅ DEVERIA APARECER'
    END as diagnostico
FROM receptoras r
LEFT JOIN vw_receptoras_fazenda_atual vw ON vw.receptora_id = r.id
LEFT JOIN fazendas f ON f.id = vw.fazenda_id_atual
LEFT JOIN v_protocolo_receptoras_status v ON v.receptora_id = r.id AND v.fase_ciclo = 'SINCRONIZADA'
LEFT JOIN protocolo_receptoras pr ON pr.receptora_id = r.id AND pr.protocolo_id = v.protocolo_id
WHERE r.id = '15f77862-9821-482b-8019-1e6c9c714223';

-- 6. Verificar se há ID da fazenda Bucaina correto
SELECT 
    'FAZENDA_BUCAINA' as tipo,
    f.id,
    f.nome
FROM fazendas f
WHERE f.nome ILIKE '%bucaina%';
