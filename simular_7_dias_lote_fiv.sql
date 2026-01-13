-- ============================================================
-- SIMULAR 7 DIAS PASSADOS PARA UM LOTE FIV (PARA TESTES)
-- ============================================================
-- Este script atualiza a data_abertura de um lote FIV para 7 dias atrás
-- Isso permite testar a funcionalidade de inserir quantidade de embriões
-- sem ter que esperar 7 dias reais
-- ============================================================

-- INSTRUÇÕES:
-- 1. Substitua 'SEU_LOTE_ID_AQUI' pelo ID do lote que você quer testar
-- 2. Execute o script
-- 3. O lote ficará com 7 dias abertos, permitindo testar a funcionalidade

-- ============================================================
-- OPÇÃO 1: Atualizar um lote específico por ID
-- ============================================================
-- Descomente e substitua o ID abaixo:
/*
UPDATE lotes_fiv
SET 
  data_abertura = CURRENT_DATE - INTERVAL '7 days',
  data_fecundacao = CURRENT_DATE - INTERVAL '7 days'
WHERE id = 'SEU_LOTE_ID_AQUI';
*/

-- ============================================================
-- OPÇÃO 2: Atualizar o lote mais recente
-- ============================================================
-- Descomente para atualizar o lote mais recente:
/*
UPDATE lotes_fiv
SET 
  data_abertura = CURRENT_DATE - INTERVAL '7 days',
  data_fecundacao = CURRENT_DATE - INTERVAL '7 days'
WHERE id = (
  SELECT id 
  FROM lotes_fiv 
  WHERE status = 'ABERTO'
  ORDER BY created_at DESC 
  LIMIT 1
);
*/

-- ============================================================
-- OPÇÃO 3: Atualizar todos os lotes abertos para 7 dias atrás
-- ============================================================
-- CUIDADO: Isso atualizará TODOS os lotes abertos!
-- Descomente apenas se quiser atualizar todos:
/*
UPDATE lotes_fiv
SET 
  data_abertura = CURRENT_DATE - INTERVAL '7 days',
  data_fecundacao = CURRENT_DATE - INTERVAL '7 days'
WHERE status = 'ABERTO';
*/

-- ============================================================
-- OPÇÃO 4: Ver lotes disponíveis antes de atualizar
-- ============================================================
-- Execute este SELECT primeiro para ver os lotes disponíveis:
SELECT 
  id,
  pacote_aspiracao_id,
  data_abertura,
  data_fecundacao,
  status,
  created_at,
  -- Calcular dias abertos
  CURRENT_DATE - data_abertura AS dias_abertos
FROM lotes_fiv
WHERE status = 'ABERTO'
ORDER BY created_at DESC;

-- ============================================================
-- OPÇÃO 5: Reverter para data original (se necessário)
-- ============================================================
-- Se você quiser reverter a data de volta, você precisará
-- saber a data original. Uma opção é criar um backup antes:
/*
-- Criar coluna de backup (execute uma vez)
ALTER TABLE lotes_fiv ADD COLUMN IF NOT EXISTS data_abertura_backup DATE;

-- Fazer backup antes de alterar
UPDATE lotes_fiv 
SET data_abertura_backup = data_abertura 
WHERE data_abertura_backup IS NULL;

-- Reverter (se necessário)
UPDATE lotes_fiv
SET 
  data_abertura = data_abertura_backup,
  data_fecundacao = data_abertura_backup
WHERE data_abertura_backup IS NOT NULL;
*/
