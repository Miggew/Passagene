-- ============================================================
-- TESTE: Comparar 7 dias vs 8 dias para chegar em D7
-- ============================================================
-- Este script ajuda a entender qual valor funciona corretamente
-- ============================================================

-- Primeiro, verificar o estado atual
SELECT 
  'ESTADO ATUAL' AS teste,
  l.id AS lote_id,
  p.data_aspiracao AS data_aspiracao_atual,
  CURRENT_DATE AS hoje,
  CURRENT_DATE - p.data_aspiracao AS diferenca_atual,
  CASE 
    WHEN CURRENT_DATE - p.data_aspiracao = 0 THEN 'D0'
    WHEN CURRENT_DATE - p.data_aspiracao = 7 THEN 'D7'
    ELSE 'D' || (CURRENT_DATE - p.data_aspiracao)::text
  END AS dia_atual
FROM lotes_fiv l
LEFT JOIN pacotes_aspiracao p ON l.pacote_aspiracao_id = p.id
WHERE l.id = '1eff2583-ba35-4dd8-8a93-1bd5fe5105ce'

UNION ALL

-- Simular: Se subtrairmos 7 dias
SELECT 
  'SIMULAÇÃO: -7 dias' AS teste,
  l.id AS lote_id,
  (CURRENT_DATE - INTERVAL '7 days')::DATE AS data_aspiracao_simulada,
  CURRENT_DATE AS hoje,
  CURRENT_DATE - (CURRENT_DATE - INTERVAL '7 days')::DATE AS diferenca_simulada,
  'D7 (esperado)' AS dia_atual
FROM lotes_fiv l
WHERE l.id = '1eff2583-ba35-4dd8-8a93-1bd5fe5105ce'

UNION ALL

-- Simular: Se subtrairmos 8 dias
SELECT 
  'SIMULAÇÃO: -8 dias' AS teste,
  l.id AS lote_id,
  (CURRENT_DATE - INTERVAL '8 days')::DATE AS data_aspiracao_simulada,
  CURRENT_DATE AS hoje,
  CURRENT_DATE - (CURRENT_DATE - INTERVAL '8 days')::DATE AS diferenca_simulada,
  'D8 (se usar -8)' AS dia_atual
FROM lotes_fiv l
WHERE l.id = '1eff2583-ba35-4dd8-8a93-1bd5fe5105ce';

-- ============================================================
-- INSTRUÇÕES:
-- ============================================================
-- 1. Execute este script primeiro para ver as simulações
-- 2. Baseado no resultado, escolha se usa 7 ou 8 dias
-- 3. O cálculo TypeScript é: Math.floor((hoje - data_aspiracao) / (24*60*60*1000))
-- 4. Se CURRENT_DATE - data_aspiracao = 7, o código TypeScript deve mostrar D7
-- 5. Se CURRENT_DATE - data_aspiracao = 8, o código TypeScript deve mostrar D8
-- ============================================================
