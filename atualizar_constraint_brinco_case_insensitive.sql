-- ============================================================
-- Atualizar constraint para garantir brinco único case-insensitive
-- ============================================================
-- Problema: A constraint atual permite "RBUC1" e "rbuc1" como diferentes
-- Solução: Criar constraint usando UPPER() para comparação case-insensitive
-- ============================================================

-- 1. Remover constraint antiga se existir
DO $$ 
BEGIN
    -- Remover trigger antigo se existir
    DROP TRIGGER IF EXISTS trg_validar_brinco_unico_por_fazenda ON receptoras;
    DROP FUNCTION IF EXISTS validar_brinco_unico_por_fazenda() CASCADE;
    
    -- Remover constraint unique se existir (se foi criada como constraint de tabela)
    ALTER TABLE receptoras DROP CONSTRAINT IF EXISTS receptoras_identificacao_fazenda_key;
END $$;

-- 2. Criar função de validação case-insensitive
CREATE OR REPLACE FUNCTION validar_brinco_unico_por_fazenda()
RETURNS TRIGGER
AS $$
DECLARE
    v_receptora_id UUID;
    v_fazenda_id UUID;
BEGIN
    -- Obter fazenda atual da receptora usando view (fonte de verdade)
    SELECT fazenda_id_atual INTO v_fazenda_id
    FROM vw_receptoras_fazenda_atual
    WHERE receptora_id = NEW.id
    LIMIT 1;
    
    -- Se não encontrou fazenda, não há problema (receptora nova sem vínculo ainda)
    IF v_fazenda_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Verificar se existe outra receptora com mesmo brinco (case-insensitive) na mesma fazenda
    SELECT r.id INTO v_receptora_id
    FROM receptoras r
    INNER JOIN vw_receptoras_fazenda_atual vw 
        ON vw.receptora_id = r.id
    WHERE UPPER(TRIM(r.identificacao)) = UPPER(TRIM(NEW.identificacao))
      AND r.id != NEW.id
      AND vw.fazenda_id_atual = v_fazenda_id
    LIMIT 1;
    
    IF v_receptora_id IS NOT NULL THEN
        RAISE EXCEPTION 'Já existe uma receptora com o brinco "%" na mesma fazenda. Não é possível criar duplicata (mesmo com maiúsculas/minúsculas diferentes).', NEW.identificacao;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Criar trigger para validação antes de INSERT ou UPDATE
CREATE TRIGGER trg_validar_brinco_unico_por_fazenda
    BEFORE INSERT OR UPDATE OF identificacao ON receptoras
    FOR EACH ROW
    EXECUTE FUNCTION validar_brinco_unico_por_fazenda();

-- 4. Comentário explicativo
COMMENT ON FUNCTION validar_brinco_unico_por_fazenda() IS 'Valida que não existe outra receptora com o mesmo brinco (case-insensitive) na mesma fazenda. Usa UPPER() para comparação e vw_receptoras_fazenda_atual como fonte de verdade para fazenda atual.';
