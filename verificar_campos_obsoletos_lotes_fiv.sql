-- ============================================================
-- VERIFICAÇÃO: Campos Obsoletos na Tabela lotes_fiv
-- ============================================================
-- Este script verifica se os campos obsoletos têm dados
-- antes de removê-los
-- ============================================================

-- 1. Verificar estrutura atual da tabela
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'lotes_fiv'
ORDER BY ordinal_position;

-- 2. Verificar se campos obsoletos têm dados
SELECT 
  COUNT(*) AS total_lotes,
  COUNT(aspiracao_id) AS lotes_com_aspiracao_id,
  COUNT(dose_semen_id) AS lotes_com_dose_semen_id,
  COUNT(data_fecundacao) AS lotes_com_data_fecundacao,
  COUNT(DISTINCT aspiracao_id) AS valores_distintos_aspiracao_id,
  COUNT(DISTINCT dose_semen_id) AS valores_distintos_dose_semen_id
FROM lotes_fiv;

-- 3. Verificar se data_abertura_backup existe (campo de teste)
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = 'lotes_fiv'
        AND column_name = 'data_abertura_backup'
    ) THEN 'EXISTE - Pode ser removido (foi criado apenas para testes)'
    ELSE 'NÃO EXISTE - OK'
  END AS status_data_abertura_backup;

-- 4. Verificar uso de data_fecundacao (se houver dados)
SELECT 
  COUNT(*) AS total_com_data_fecundacao,
  MIN(data_fecundacao) AS data_mais_antiga,
  MAX(data_fecundacao) AS data_mais_recente
FROM lotes_fiv
WHERE data_fecundacao IS NOT NULL;

-- 5. Comparar data_fecundacao com data_abertura (se ambas existirem)
SELECT 
  COUNT(*) AS total_comparacoes,
  COUNT(CASE WHEN data_fecundacao = data_abertura THEN 1 END) AS iguais,
  COUNT(CASE WHEN data_fecundacao != data_abertura THEN 1 END) AS diferentes,
  COUNT(CASE WHEN data_fecundacao IS NULL THEN 1 END) AS data_fecundacao_null
FROM lotes_fiv
WHERE data_fecundacao IS NOT NULL OR data_abertura IS NOT NULL;

-- ============================================================
-- INTERPRETAÇÃO DOS RESULTADOS:
-- ============================================================
-- Se lotes_com_aspiracao_id = 0: campo aspiracao_id pode ser removido
-- Se lotes_com_dose_semen_id = 0: campo dose_semen_id pode ser removido
-- Se lotes_com_data_fecundacao = 0: campo data_fecundacao pode ser removido
-- 
-- ATENÇÃO: Antes de remover, verificar se há:
-- - Constraints/Foreign Keys
-- - Índices
-- - Triggers
-- - Views que usam esses campos
-- ============================================================
