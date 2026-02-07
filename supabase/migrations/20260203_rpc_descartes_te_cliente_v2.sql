-- DROP da função anterior se existir
DROP FUNCTION IF EXISTS get_descartes_te_cliente(UUID[], DATE);

-- RPC Function para buscar descartes de TE por cliente
-- Versão 2: Aceita cliente_id diretamente (mais simples, evita problemas com arrays)

CREATE OR REPLACE FUNCTION get_descartes_te_cliente(
  p_cliente_id UUID,
  p_dias_atras INTEGER DEFAULT 90
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
  INNER JOIN fazendas f ON f.id = ps.fazenda_id
  INNER JOIN receptoras r ON r.id = pr.receptora_id
  WHERE f.cliente_id = p_cliente_id
    AND pr.status = 'INAPTA'
    AND pr.motivo_inapta ILIKE '%TE%'
    AND pr.updated_at >= (CURRENT_DATE - (p_dias_atras || ' days')::INTERVAL)
  ORDER BY pr.updated_at DESC;
END;
$$;

-- Permitir acesso
GRANT EXECUTE ON FUNCTION get_descartes_te_cliente(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_descartes_te_cliente(UUID, INTEGER) TO anon;
