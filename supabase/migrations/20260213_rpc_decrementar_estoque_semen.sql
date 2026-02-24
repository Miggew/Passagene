-- RPC atômica para baixa de estoque de sêmen
-- Evita race conditions na subtração de palhetas

CREATE OR REPLACE FUNCTION decrementar_estoque_semen(
  p_dose_id UUID,
  p_quantidade NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_quantidade_atual NUMERIC;
  v_nova_quantidade NUMERIC;
BEGIN
  -- Lock da linha para evitar race condition
  SELECT quantidade INTO v_quantidade_atual
  FROM doses_semen
  WHERE id = p_dose_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dose de sêmen não encontrada: %', p_dose_id;
  END IF;

  v_nova_quantidade := COALESCE(v_quantidade_atual, 0) - p_quantidade;

  IF v_nova_quantidade < 0 THEN
    RAISE EXCEPTION 'Estoque insuficiente. Disponível: %, Solicitado: %', COALESCE(v_quantidade_atual, 0), p_quantidade;
  END IF;

  UPDATE doses_semen
  SET quantidade = v_nova_quantidade
  WHERE id = p_dose_id;

  RETURN v_nova_quantidade;
END;
$$;
