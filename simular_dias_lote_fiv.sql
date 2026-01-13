-- ============================================================
-- SIMULAR DIAS PASSADOS PARA UM LOTE FIV (PARA TESTES)
-- ============================================================
-- Este script permite simular que passaram X dias desde a abertura do lote
-- Útil para testar funcionalidades que dependem do tempo decorrido
-- ============================================================

-- ============================================================
-- FUNÇÃO PARA SIMULAR DIAS (MAIS FÁCIL DE USAR)
-- ============================================================
-- Use esta função para atualizar um lote específico:
-- Exemplo: SELECT simular_dias_lote_fiv('lote-id-aqui', 7);
-- Isso fará com que o lote tenha 7 dias abertos

CREATE OR REPLACE FUNCTION simular_dias_lote_fiv(
  p_lote_id UUID,
  p_dias INTEGER DEFAULT 7
)
RETURNS TABLE (
  lote_id UUID,
  data_abertura_original DATE,
  data_abertura_nova DATE,
  dias_simulados INTEGER,
  dias_abertos_calculados INTEGER
) AS $$
DECLARE
  v_data_abertura_original DATE;
  v_data_abertura_nova DATE;
BEGIN
  -- Buscar data de abertura atual
  SELECT data_abertura INTO v_data_abertura_original
  FROM lotes_fiv
  WHERE id = p_lote_id;

  IF v_data_abertura_original IS NULL THEN
    RAISE EXCEPTION 'Lote com ID % não encontrado', p_lote_id;
  END IF;

  -- Calcular nova data (p_dias dias atrás)
  v_data_abertura_nova := CURRENT_DATE - p_dias;

  -- Atualizar lote
  UPDATE lotes_fiv
  SET 
    data_abertura = v_data_abertura_nova,
    data_fecundacao = v_data_abertura_nova
  WHERE id = p_lote_id;

  -- Retornar informações
  RETURN QUERY SELECT 
    p_lote_id,
    v_data_abertura_original,
    v_data_abertura_nova,
    p_dias,
    CURRENT_DATE - v_data_abertura_nova;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- EXEMPLOS DE USO
-- ============================================================

-- 1. Simular 7 dias para um lote específico:
-- SELECT * FROM simular_dias_lote_fiv('seu-lote-id-aqui', 7);

-- 2. Simular 10 dias para um lote específico:
-- SELECT * FROM simular_dias_lote_fiv('seu-lote-id-aqui', 10);

-- 3. Ver lotes disponíveis antes de simular:
SELECT 
  id,
  pacote_aspiracao_id,
  data_abertura,
  status,
  CURRENT_DATE - data_abertura AS dias_abertos_atual
FROM lotes_fiv
WHERE status = 'ABERTO'
ORDER BY created_at DESC;

-- ============================================================
-- ATUALIZAÇÃO DIRETA (ALTERNATIVA SEM FUNÇÃO)
-- ============================================================

-- Atualizar lote específico para 7 dias atrás:
/*
UPDATE lotes_fiv
SET 
  data_abertura = CURRENT_DATE - 7,
  data_fecundacao = CURRENT_DATE - 7
WHERE id = 'seu-lote-id-aqui';
*/

-- Atualizar lote mais recente para 7 dias atrás:
/*
UPDATE lotes_fiv
SET 
  data_abertura = CURRENT_DATE - 7,
  data_fecundacao = CURRENT_DATE - 7
WHERE id = (
  SELECT id 
  FROM lotes_fiv 
  WHERE status = 'ABERTO'
  ORDER BY created_at DESC 
  LIMIT 1
);
*/
