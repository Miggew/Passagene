-- ============================================================
-- PassaGene: Admin Profile — Platform Stats RPC
-- Executar no Supabase Dashboard (SQL Editor)
-- ============================================================

-- RPC: Stats agregadas anônimas da plataforma inteira
CREATE OR REPLACE FUNCTION get_platform_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_clientes INTEGER;
  v_total_fazendas INTEGER;
  v_total_embrioes INTEGER;
  v_total_aspiracoes INTEGER;
  v_total_tes INTEGER;
  v_total_dg INTEGER;
  v_total_prenhe INTEGER;
  v_taxa_prenhez NUMERIC(5,2);
BEGIN
  -- Total de clientes
  SELECT COUNT(*) INTO v_total_clientes FROM clientes;

  -- Total de fazendas
  SELECT COUNT(*) INTO v_total_fazendas FROM fazendas;

  -- Total de embriões viáveis produzidos
  SELECT COUNT(*) INTO v_total_embrioes
  FROM embrioes
  WHERE classificacao IN ('A', 'B', 'C', 'BE', 'BN', 'BX', 'BL', 'BI');

  -- Total de aspirações (pacotes)
  SELECT COUNT(*) INTO v_total_aspiracoes FROM pacotes_aspiracao;

  -- Total de transferências de embriões
  SELECT COUNT(*) INTO v_total_tes FROM transferencias_embrioes;

  -- Taxa de prenhez global
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE dg.resultado IN ('PRENHE', 'PRENHE_RETOQUE'))
  INTO v_total_dg, v_total_prenhe
  FROM diagnosticos_gestacao dg
  WHERE dg.tipo_diagnostico = 'DG';

  IF v_total_dg > 0 THEN
    v_taxa_prenhez := ROUND((v_total_prenhe::numeric / v_total_dg) * 100, 1);
  ELSE
    v_taxa_prenhez := 0;
  END IF;

  RETURN json_build_object(
    'total_clientes', v_total_clientes,
    'total_fazendas', v_total_fazendas,
    'total_embrioes', v_total_embrioes,
    'total_aspiracoes', v_total_aspiracoes,
    'total_tes', v_total_tes,
    'taxa_prenhez', v_taxa_prenhez
  );
END;
$$;

COMMENT ON FUNCTION get_platform_stats IS 'Retorna estatísticas agregadas anônimas da plataforma PassaGene';
