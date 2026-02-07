-- RPC Function para buscar descartes de TE por cliente
-- Evita limitações da API REST com queries complexas

CREATE OR REPLACE FUNCTION get_descartes_te_cliente(
  p_fazenda_ids UUID[],
  p_data_inicio DATE DEFAULT (CURRENT_DATE - INTERVAL '90 days')
)
RETURNS TABLE (
  receptora_id UUID,
  identificacao TEXT,
  motivo_inapta TEXT,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pr.receptora_id,
    r.identificacao,
    pr.motivo_inapta,
    pr.updated_at
  FROM protocolo_receptoras pr
  INNER JOIN protocolos_sincronizacao ps ON ps.id = pr.protocolo_id
  INNER JOIN receptoras r ON r.id = pr.receptora_id
  WHERE ps.fazenda_id = ANY(p_fazenda_ids)
    AND pr.status = 'INAPTA'
    AND pr.motivo_inapta ILIKE '%TE%'
    AND pr.updated_at >= p_data_inicio
  ORDER BY pr.updated_at DESC;
END;
$$;

-- Permitir acesso para usuários autenticados
GRANT EXECUTE ON FUNCTION get_descartes_te_cliente(UUID[], DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_descartes_te_cliente(UUID[], DATE) TO anon;
