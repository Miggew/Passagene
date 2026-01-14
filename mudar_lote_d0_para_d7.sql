-- ============================================================
-- MUDAR LOTE FIV DE D0 PARA D7
-- Lote ID: 1eff2583-ba35-4dd8-8a93-1bd5fe5105ce
-- ============================================================
-- Este script atualiza a data_aspiracao do PACOTE relacionado ao lote
-- O cálculo do D0/D7 é baseado na data_aspiracao do pacote, não na data_abertura do lote
-- ============================================================

-- Verificar o lote e o pacote antes de atualizar
SELECT 
  l.id AS lote_id,
  l.pacote_aspiracao_id,
  l.data_abertura AS data_abertura_lote,
  p.data_aspiracao AS data_aspiracao_pacote_atual,
  p.fazenda_id,
  CURRENT_DATE - p.data_aspiracao AS dias_desde_aspiracao_atual,
  CASE 
    WHEN CURRENT_DATE - p.data_aspiracao = 0 THEN 'D0'
    WHEN CURRENT_DATE - p.data_aspiracao = 7 THEN 'D7'
    ELSE 'D' || (CURRENT_DATE - p.data_aspiracao)::text
  END AS dia_atual
FROM lotes_fiv l
LEFT JOIN pacotes_aspiracao p ON l.pacote_aspiracao_id = p.id
WHERE l.id = '1eff2583-ba35-4dd8-8a93-1bd5fe5105ce';

-- Atualizar a data_aspiracao do PACOTE para 8 dias atrás
-- IMPORTANTE: São 8 dias desde a aspiração (D0) até o D7
-- Para colocar um lote no D7, subtraímos 8 dias da data atual
UPDATE pacotes_aspiracao
SET data_aspiracao = (CURRENT_DATE - INTERVAL '8 days')::DATE
WHERE id = (
  SELECT pacote_aspiracao_id 
  FROM lotes_fiv 
  WHERE id = '1eff2583-ba35-4dd8-8a93-1bd5fe5105ce'
);

-- Verificar após atualização
SELECT 
  l.id AS lote_id,
  l.pacote_aspiracao_id,
  l.data_abertura AS data_abertura_lote,
  p.data_aspiracao AS data_aspiracao_pacote_nova,
  p.fazenda_id,
  CURRENT_DATE - p.data_aspiracao AS dias_desde_aspiracao_novo,
  CASE 
    WHEN CURRENT_DATE - p.data_aspiracao = 7 THEN 'D7 ✅'
    ELSE 'D' || (CURRENT_DATE - p.data_aspiracao)::text
  END AS dia_atual,
  'Lote atualizado com sucesso! Agora está no D7.' AS mensagem
FROM lotes_fiv l
LEFT JOIN pacotes_aspiracao p ON l.pacote_aspiracao_id = p.id
WHERE l.id = '1eff2583-ba35-4dd8-8a93-1bd5fe5105ce';
