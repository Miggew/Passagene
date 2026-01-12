-- ============================================================
-- Constraint: Brinco Único por Fazenda
-- ============================================================
-- Objetivo: Garantir que não existam receptoras com o mesmo
--           brinco (identificacao) na mesma fazenda
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Criar função para verificar brinco único por fazenda
-- ============================================================
CREATE OR REPLACE FUNCTION verificar_brinco_unico_por_fazenda()
RETURNS TRIGGER AS $$
DECLARE
    v_fazenda_id UUID;
    v_receptora_id UUID;
BEGIN
    -- Obter fazenda atual da receptora (via histórico)
    SELECT fazenda_id INTO v_fazenda_id
    FROM receptora_fazenda_historico
    WHERE receptora_id = NEW.id
      AND data_fim IS NULL
    LIMIT 1;
    
    -- Se não tem fazenda, não há problema (será criado depois)
    IF v_fazenda_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Verificar se existe outra receptora com mesmo brinco na mesma fazenda
    SELECT r.id INTO v_receptora_id
    FROM receptoras r
    INNER JOIN receptora_fazenda_historico rfh 
        ON rfh.receptora_id = r.id
        AND rfh.data_fim IS NULL
    WHERE r.identificacao = NEW.identificacao
      AND r.id != NEW.id
      AND rfh.fazenda_id = v_fazenda_id
    LIMIT 1;
    
    IF v_receptora_id IS NOT NULL THEN
        RAISE EXCEPTION 'Já existe uma receptora com o brinco % na mesma fazenda. Não é possível criar duplicata.', NEW.identificacao;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 2. Criar trigger AFTER INSERT ou UPDATE na tabela receptoras
-- ============================================================
DROP TRIGGER IF EXISTS trigger_verificar_brinco_unico_por_fazenda ON receptoras;

CREATE TRIGGER trigger_verificar_brinco_unico_por_fazenda
AFTER INSERT OR UPDATE OF identificacao ON receptoras
FOR EACH ROW
EXECUTE FUNCTION verificar_brinco_unico_por_fazenda();

-- ============================================================
-- 3. Criar trigger AFTER INSERT no histórico de fazendas
-- ============================================================
-- Quando uma receptora é vinculada a uma fazenda, verificar duplicatas
CREATE OR REPLACE FUNCTION verificar_brinco_unico_ao_vincular_fazenda()
RETURNS TRIGGER AS $$
DECLARE
    v_receptora_id UUID;
    v_identificacao TEXT;
BEGIN
    -- Obter identificação da receptora
    SELECT identificacao INTO v_identificacao
    FROM receptoras
    WHERE id = NEW.receptora_id;
    
    -- Verificar se existe outra receptora com mesmo brinco na mesma fazenda
    SELECT r.id INTO v_receptora_id
    FROM receptoras r
    INNER JOIN receptora_fazenda_historico rfh 
        ON rfh.receptora_id = r.id
        AND rfh.data_fim IS NULL
    WHERE r.identificacao = v_identificacao
      AND r.id != NEW.receptora_id
      AND rfh.fazenda_id = NEW.fazenda_id
    LIMIT 1;
    
    IF v_receptora_id IS NOT NULL THEN
        RAISE EXCEPTION 'Já existe uma receptora com o brinco % na fazenda. Não é possível vincular esta receptora à fazenda.', v_identificacao;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_verificar_brinco_unico_ao_vincular_fazenda ON receptora_fazenda_historico;

CREATE TRIGGER trigger_verificar_brinco_unico_ao_vincular_fazenda
AFTER INSERT ON receptora_fazenda_historico
FOR EACH ROW
WHEN (NEW.data_fim IS NULL) -- Apenas para vínculos ativos
EXECUTE FUNCTION verificar_brinco_unico_ao_vincular_fazenda();

COMMIT;

-- ============================================================
-- VERIFICAÇÃO: Verificar duplicatas existentes
-- ============================================================
SELECT 
    r.identificacao,
    f.nome AS fazenda_nome,
    COUNT(*) AS quantidade_duplicatas,
    STRING_AGG(r.id::TEXT, ', ') AS ids_receptoras
FROM receptoras r
INNER JOIN receptora_fazenda_historico rfh 
    ON rfh.receptora_id = r.id
    AND rfh.data_fim IS NULL
INNER JOIN fazendas f ON f.id = rfh.fazenda_id
GROUP BY r.identificacao, f.id, f.nome
HAVING COUNT(*) > 1
ORDER BY quantidade_duplicatas DESC, r.identificacao;

-- ============================================================
-- NOTA: Se houver duplicatas existentes, será necessário
--       removê-las manualmente antes de aplicar a constraint
-- ============================================================
