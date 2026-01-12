-- ============================================================
-- Script para Analisar Dados em fazenda_atual_id
-- ============================================================
-- Objetivo: Verificar quais receptoras têm fazenda_atual_id
--           e se têm histórico correspondente
-- ============================================================

-- ============================================================
-- 1. Receptoras com fazenda_atual_id preenchido
-- ============================================================
SELECT 
    r.id AS receptora_id,
    r.identificacao AS brinco,
    r.nome,
    r.fazenda_atual_id,
    f.nome AS fazenda_nome_atual_id,
    -- Verificar se tem histórico ativo
    rfh_historico.fazenda_id AS fazenda_id_historico,
    rfh_historico.data_inicio AS data_inicio_historico,
    CASE 
        WHEN rfh_historico.fazenda_id IS NULL THEN 'SEM HISTÓRICO'
        WHEN rfh_historico.fazenda_id = r.fazenda_atual_id THEN 'HISTÓRICO CORRETO'
        ELSE 'HISTÓRICO DIFERENTE'
    END AS status_comparacao
FROM receptoras r
LEFT JOIN fazendas f ON f.id = r.fazenda_atual_id
LEFT JOIN receptora_fazenda_historico rfh_historico 
    ON rfh_historico.receptora_id = r.id 
    AND rfh_historico.data_fim IS NULL
WHERE r.fazenda_atual_id IS NOT NULL
ORDER BY r.identificacao;

-- ============================================================
-- 2. Resumo: Contagem por situação
-- ============================================================
SELECT 
    COUNT(*) AS total_com_fazenda_atual_id,
    COUNT(CASE WHEN rfh_historico.fazenda_id IS NULL THEN 1 END) AS sem_historico,
    COUNT(CASE WHEN rfh_historico.fazenda_id = r.fazenda_atual_id THEN 1 END) AS historico_correto,
    COUNT(CASE WHEN rfh_historico.fazenda_id IS NOT NULL AND rfh_historico.fazenda_id != r.fazenda_atual_id THEN 1 END) AS historico_diferente
FROM receptoras r
LEFT JOIN receptora_fazenda_historico rfh_historico 
    ON rfh_historico.receptora_id = r.id 
    AND rfh_historico.data_fim IS NULL
WHERE r.fazenda_atual_id IS NOT NULL;

-- ============================================================
-- 3. Receptoras SEM histórico mas COM fazenda_atual_id
-- ============================================================
-- Estas precisam ter histórico criado antes de remover fazenda_atual_id
SELECT 
    r.id AS receptora_id,
    r.identificacao AS brinco,
    r.nome,
    r.fazenda_atual_id,
    f.nome AS fazenda_nome,
    'PRECISA CRIAR HISTÓRICO' AS acao_necessaria
FROM receptoras r
LEFT JOIN fazendas f ON f.id = r.fazenda_atual_id
WHERE r.fazenda_atual_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 
      FROM receptora_fazenda_historico rfh
      WHERE rfh.receptora_id = r.id
        AND rfh.data_fim IS NULL
  )
ORDER BY r.identificacao;

-- ============================================================
-- 4. Receptoras COM histórico DIFERENTE de fazenda_atual_id
-- ============================================================
-- Estas têm inconsistência - histórico tem prioridade
SELECT 
    r.id AS receptora_id,
    r.identificacao AS brinco,
    r.fazenda_atual_id AS fazenda_atual_id_valor,
    f1.nome AS fazenda_atual_id_nome,
    rfh_historico.fazenda_id AS fazenda_id_historico,
    f2.nome AS fazenda_historico_nome,
    'HISTÓRICO TEM PRIORIDADE' AS acao_necessaria
FROM receptoras r
INNER JOIN receptora_fazenda_historico rfh_historico 
    ON rfh_historico.receptora_id = r.id 
    AND rfh_historico.data_fim IS NULL
LEFT JOIN fazendas f1 ON f1.id = r.fazenda_atual_id
LEFT JOIN fazendas f2 ON f2.id = rfh_historico.fazenda_id
WHERE r.fazenda_atual_id IS NOT NULL
  AND rfh_historico.fazenda_id != r.fazenda_atual_id
ORDER BY r.identificacao;

-- ============================================================
-- INSTRUÇÕES:
-- ============================================================
-- 1. Execute todas as queries acima
-- 2. Se houver receptoras SEM histórico (query 3):
--    - Execute o script criar_historico_para_fazenda_atual_id.sql
--
-- 3. Se houver receptoras COM histórico diferente (query 4):
--    - O histórico tem prioridade, pode remover fazenda_atual_id
--
-- 4. Se todas as receptoras têm histórico correto:
--    - Pode remover fazenda_atual_id com segurança
-- ============================================================
