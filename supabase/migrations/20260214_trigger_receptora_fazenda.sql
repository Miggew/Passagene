-- 1. Garante que a coluna física existe
ALTER TABLE receptoras ADD COLUMN IF NOT EXISTS fazenda_atual_id UUID REFERENCES fazendas(id);

-- 2. Cria a função do Trigger
CREATE OR REPLACE FUNCTION trg_update_receptora_fazenda_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_receptora_id UUID;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        v_receptora_id := OLD.receptora_id;
    ELSE
        v_receptora_id := NEW.receptora_id;
    END IF;

    UPDATE receptoras
    SET fazenda_atual_id = (
        SELECT fazenda_id
        FROM receptora_fazenda_historico
        WHERE receptora_id = v_receptora_id
        ORDER BY data_inicio DESC, created_at DESC
        LIMIT 1
    )
    WHERE id = v_receptora_id;

    RETURN NULL;
END;
$$;

-- 3. Associa o Trigger ao histórico
DROP TRIGGER IF EXISTS trg_update_receptora_fazenda ON receptora_fazenda_historico;
CREATE TRIGGER trg_update_receptora_fazenda
AFTER INSERT OR UPDATE OR DELETE ON receptora_fazenda_historico
FOR EACH ROW EXECUTE FUNCTION trg_update_receptora_fazenda_fn();

-- 4. Backfill (Atualiza os dados legados imediatamente)
UPDATE receptoras r
SET fazenda_atual_id = (
    SELECT fazenda_id
    FROM receptora_fazenda_historico h
    WHERE h.receptora_id = r.id
    ORDER BY data_inicio DESC, created_at DESC
    LIMIT 1
);
