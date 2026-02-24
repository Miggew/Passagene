-- ============================================================
-- Passagene - Fase 5: Performance RPCs
-- ============================================================

-- 1. Otimização de Receptoras com Status
-- Substitui fetchReceptorasComStatusByFazenda (N+1 queries)
CREATE OR REPLACE FUNCTION public.get_receptoras_status(p_fazenda_id uuid)
RETURNS TABLE (
  id uuid,
  identificacao text,
  nome text,
  raca text,
  status_calculado text,
  numero_gestacoes int,
  dias_gestacao int,
  ultima_atualizacao timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id, 
    r.identificacao,
    r.nome,
    r.raca,
    COALESCE(r.status_reprodutivo, 'VAZIA') as status_calculado,
    (
      SELECT MAX(numero_gestacoes) 
      FROM diagnosticos_gestacao dg 
      WHERE dg.receptora_id = r.id AND dg.resultado IN ('PRENHE', 'PRENHE_FEMEA', 'PRENHE_MACHO')
    ) as numero_gestacoes,
    (
      -- Cálculo aproximado de dias de gestação baseado na data do diagnóstico
      SELECT (CURRENT_DATE - MAX(dg.data_diagnostico)::date) + 30 -- assumindo dg com 30 dias
      FROM diagnosticos_gestacao dg
      WHERE dg.receptora_id = r.id 
      AND dg.resultado LIKE 'PRENHE%'
      AND r.status_reprodutivo LIKE 'PRENHE%'
    ) as dias_gestacao,
    r.updated_at
  FROM receptoras r
  JOIN receptora_fazenda_historico rfh ON r.id = rfh.receptora_id
  WHERE rfh.fazenda_id = p_fazenda_id 
  AND rfh.data_fim IS NULL -- Apenas receptoras atuais da fazenda
  ORDER BY r.identificacao ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Resumo de Lotes FIV (Dashboard)
-- Agrega contagens para evitar buscar todos os embriões
CREATE OR REPLACE FUNCTION public.get_resumo_lotes_fiv(p_cliente_id uuid)
RETURNS TABLE (
  id uuid,
  codigo text,
  data_aspiracao date,
  total_oocitos int,
  total_embrioes int,
  taxa_conversao numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    lf.id,
    lf.codigo,
    pa.data_aspiracao,
    pa.total_oocitos,
    (SELECT COUNT(*) FROM embrioes e WHERE e.lote_fiv_id = lf.id)::int as total_embrioes,
    CASE 
      WHEN pa.total_oocitos > 0 THEN 
        ROUND(((SELECT COUNT(*) FROM embrioes e WHERE e.lote_fiv_id = lf.id)::numeric / pa.total_oocitos) * 100, 1)
      ELSE 0 
    END as taxa_conversao
  FROM lotes_fiv lf
  JOIN pacotes_aspiracao pa ON lf.pacote_aspiracao_id = pa.id
  JOIN fazendas f ON pa.fazenda_id = f.id
  WHERE f.cliente_id = p_cliente_id
  ORDER BY pa.data_aspiracao DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
