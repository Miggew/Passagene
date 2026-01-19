-- Script para investigar e corrigir o problema da receptora "teste duplo"
-- que está como SINCRONIZADA mas não está na fazenda Bucaina na view vw_receptoras_fazenda_atual

-- ID da receptora: 15f77862-9821-482b-8019-1e6c9c714223
-- Protocolo: 24c55d63-fd3f-479f-8e8f-7f5d576f7b6b

-- 1. Verificar histórico de fazendas da receptora
SELECT 
    'HISTORICO_FAZENDAS' as tipo,
    rfh.*,
    f.nome as fazenda_nome,
    r.identificacao,
    r.nome as receptora_nome
FROM receptora_fazenda_historico rfh
JOIN receptoras r ON r.id = rfh.receptora_id
LEFT JOIN fazendas f ON f.id = rfh.fazenda_id
WHERE rfh.receptora_id = '15f77862-9821-482b-8019-1e6c9c714223'
ORDER BY rfh.data_inicio DESC;

-- 2. Verificar qual fazenda o protocolo está vinculado
SELECT 
    'PROTOCOLO_FAZENDA' as tipo,
    ps.id as protocolo_id,
    ps.fazenda_id,
    ps.status,
    f.nome as fazenda_nome,
    r.identificacao,
    r.nome as receptora_nome
FROM protocolos_sincronizacao ps
JOIN fazendas f ON f.id = ps.fazenda_id
JOIN protocolo_receptoras pr ON pr.protocolo_id = ps.id
JOIN receptoras r ON r.id = pr.receptora_id
WHERE ps.id = '24c55d63-fd3f-479f-8e8f-7f5d576f7b6b'
  AND pr.receptora_id = '15f77862-9821-482b-8019-1e6c9c714223';

-- 3. Verificar o que a view vw_receptoras_fazenda_atual retorna
SELECT 
    'VIEW_FAZENDA_ATUAL' as tipo,
    vw.*,
    f.nome as fazenda_nome,
    r.identificacao,
    r.nome as receptora_nome
FROM vw_receptoras_fazenda_atual vw
JOIN receptoras r ON r.id = vw.receptora_id
LEFT JOIN fazendas f ON f.id = vw.fazenda_id_atual
WHERE vw.receptora_id = '15f77862-9821-482b-8019-1e6c9c714223';

-- 4. Verificar se há algum registro na tabela receptora_fazenda_historico
-- Se não houver, precisamos criar um registro
SELECT 
    'VERIFICAR_HISTORICO' as tipo,
    COUNT(*) as total_registros,
    MAX(rfh.data_inicio) as ultima_data,
    MAX(rfh.fazenda_id) as ultima_fazenda_id
FROM receptora_fazenda_historico rfh
WHERE rfh.receptora_id = '15f77862-9821-482b-8019-1e6c9c714223';

-- 5. SOLUÇÃO: Criar registro no histórico de fazendas se não existir
-- Primeiro, vamos verificar qual é o ID da fazenda Bucaina
-- Depois, vamos criar o registro no histórico se necessário

-- IMPORTANTE: Execute estas queries em ordem e verifique os resultados antes de executar o INSERT

-- 5.1. Verificar ID da fazenda Bucaina
SELECT 
    'ID_FAZENDA_BUCAINA' as tipo,
    f.id,
    f.nome
FROM fazendas f
WHERE f.nome ILIKE '%bucaina%';

-- 5.2. Verificar se já existe histórico para essa receptora
-- Se não existir, precisamos criar um registro
-- Se existir mas estiver em outra fazenda, precisamos verificar se precisa atualizar

-- 5.3. CRIAR REGISTRO NO HISTÓRICO (execute apenas se não houver histórico)
-- Substitua 'ID_DA_FAZENDA_BUCAINA' pelo ID real da fazenda Bucaina
/*
INSERT INTO receptora_fazenda_historico (
    receptora_id,
    fazenda_id,
    data_inicio,
    observacoes
)
SELECT 
    '15f77862-9821-482b-8019-1e6c9c714223' as receptora_id,
    ps.fazenda_id,
    ps.data_inicio,
    'Correção: Receptora não estava na fazenda na view vw_receptoras_fazenda_atual'
FROM protocolos_sincronizacao ps
WHERE ps.id = '24c55d63-fd3f-479f-8e8f-7f5d576f7b6b'
  AND NOT EXISTS (
      SELECT 1 
      FROM receptora_fazenda_historico rfh
      WHERE rfh.receptora_id = '15f77862-9821-482b-8019-1e6c9c714223'
  );
*/

-- 6. Verificar se há evento_fazenda_id no protocolo_receptoras que possa estar causando o problema
SELECT 
    'EVENTO_FAZENDA' as tipo,
    pr.id,
    pr.receptora_id,
    pr.protocolo_id,
    pr.evento_fazenda_id,
    f.nome as evento_fazenda_nome,
    ps.fazenda_id as protocolo_fazenda_id,
    f2.nome as protocolo_fazenda_nome
FROM protocolo_receptoras pr
JOIN protocolos_sincronizacao ps ON ps.id = pr.protocolo_id
LEFT JOIN fazendas f ON f.id = pr.evento_fazenda_id
LEFT JOIN fazendas f2 ON f2.id = ps.fazenda_id
WHERE pr.receptora_id = '15f77862-9821-482b-8019-1e6c9c714223'
  AND pr.protocolo_id = '24c55d63-fd3f-479f-8e8f-7f5d576f7b6b';
