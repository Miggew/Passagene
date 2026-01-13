-- ============================================================
-- SIMULAR 7 DIAS PARA O LOTE: b0d3057d-dcc6-4bc7-b1c7-367f3a20ee9a
-- ============================================================
-- Este script atualiza a data_abertura deste lote para 7 dias atrás
-- Isso permite testar a funcionalidade de inserir quantidade de embriões
-- ============================================================

-- Verificar o lote antes de atualizar
SELECT 
  id,
  pacote_aspiracao_id,
  data_abertura AS data_abertura_atual,
  data_fecundacao AS data_fecundacao_atual,
  status,
  CURRENT_DATE - data_abertura AS dias_abertos_atual,
  created_at
FROM lotes_fiv
WHERE id = 'b0d3057d-dcc6-4bc7-b1c7-367f3a20ee9a';

-- Atualizar para 7 dias atrás
UPDATE lotes_fiv
SET 
  data_abertura = CURRENT_DATE - INTERVAL '7 days',
  data_fecundacao = CURRENT_DATE - INTERVAL '7 days'
WHERE id = 'b0d3057d-dcc6-4bc7-b1c7-367f3a20ee9a';

-- Verificar após atualização
SELECT 
  id,
  data_abertura AS data_abertura_nova,
  data_fecundacao AS data_fecundacao_nova,
  status,
  CURRENT_DATE - data_abertura AS dias_abertos_novo,
  'Lote atualizado com sucesso! Agora tem 7 dias abertos.' AS mensagem
FROM lotes_fiv
WHERE id = 'b0d3057d-dcc6-4bc7-b1c7-367f3a20ee9a';
