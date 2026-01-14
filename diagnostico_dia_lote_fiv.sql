-- ============================================================
-- DIAGNÓSTICO: Verificar cálculo de dia para lote FIV
-- Lote ID: 1eff2583-ba35-4dd8-8a93-1bd5fe5105ce
-- ============================================================

SELECT 
  l.id AS lote_id,
  l.pacote_aspiracao_id,
  p.data_aspiracao AS data_aspiracao_pacote,
  l.data_abertura AS data_abertura_lote,
  CURRENT_DATE AS hoje,
  CURRENT_DATE - p.data_aspiracao AS diferenca_dias_postgresql,
  -- Cálculo manual para verificar
  EXTRACT(EPOCH FROM (CURRENT_DATE - p.data_aspiracao)) / 86400 AS diferenca_dias_calculada,
  -- Para estar no D7, a diferença deve ser 7
  CASE 
    WHEN CURRENT_DATE - p.data_aspiracao = 7 THEN 'D7 ✅'
    WHEN CURRENT_DATE - p.data_aspiracao = 6 THEN 'D6 (precisa ajustar)'
    WHEN CURRENT_DATE - p.data_aspiracao = 8 THEN 'D8'
    ELSE 'Outro: D' || (CURRENT_DATE - p.data_aspiracao)::text
  END AS status_atual
FROM lotes_fiv l
LEFT JOIN pacotes_aspiracao p ON l.pacote_aspiracao_id = p.id
WHERE l.id = '1eff2583-ba35-4dd8-8a93-1bd5fe5105ce';
