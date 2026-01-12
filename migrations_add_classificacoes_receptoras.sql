-- ============================================================
-- Migration: Adicionar Classificações de Receptoras no Protocolo
-- ============================================================
-- Objetivo: Adicionar campos ciclando_classificacao e qualidade_semaforo
--           na tabela protocolo_receptoras para classificar receptoras
--           durante o ciclo do protocolo (apenas no Passo 1).
-- ============================================================

BEGIN;

-- 1. Adicionar coluna ciclando_classificacao
--    Valores permitidos: 'N', 'CL' ou NULL (opcional)
ALTER TABLE protocolo_receptoras
ADD COLUMN IF NOT EXISTS ciclando_classificacao TEXT NULL;

-- Adicionar constraint CHECK para validar valores (se não existir)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_ciclando_classificacao'
    ) THEN
        ALTER TABLE protocolo_receptoras
        ADD CONSTRAINT chk_ciclando_classificacao 
        CHECK (ciclando_classificacao IN ('N', 'CL') OR ciclando_classificacao IS NULL);
    END IF;
END $$;

-- 2. Adicionar coluna qualidade_semaforo
--    Valores permitidos: 1, 2, 3 ou NULL (opcional)
--    Usar SMALLINT para economia de espaço
ALTER TABLE protocolo_receptoras
ADD COLUMN IF NOT EXISTS qualidade_semaforo SMALLINT NULL;

-- Adicionar constraint CHECK para validar valores (se não existir)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chk_qualidade_semaforo'
    ) THEN
        ALTER TABLE protocolo_receptoras
        ADD CONSTRAINT chk_qualidade_semaforo
        CHECK ((qualidade_semaforo >= 1 AND qualidade_semaforo <= 3) OR qualidade_semaforo IS NULL);
    END IF;
END $$;

-- IMPORTANTE: NÃO adicionar DEFAULT - campos devem ser NULL por padrão
-- para que só sejam preenchidos explicitamente no Passo 1.

-- 3. Criar VIEW para facilitar consulta de receptoras com protocolo ativo
--    Retorna a receptora com seu protocolo ativo mais recente e as classificações
--    IMPORTANTE: Drop view se existir (pode ter estrutura diferente)
--    Usar CASCADE para remover dependências se houver
DROP VIEW IF EXISTS vw_receptoras_protocolo_ativo CASCADE;

CREATE VIEW vw_receptoras_protocolo_ativo AS
SELECT DISTINCT ON (r.id)
    r.id AS receptora_id,
    r.identificacao AS receptora_brinco,
    r.nome AS receptora_nome,
    pr.protocolo_id AS protocolo_id_ativo,
    p.status AS protocolo_status,
    p.data_inicio AS protocolo_data_inicio,
    pr.ciclando_classificacao,
    pr.qualidade_semaforo,
    pr.status AS receptora_status_no_protocolo,
    pr.data_inclusao AS data_inclusao_protocolo
FROM receptoras r
INNER JOIN protocolo_receptoras pr ON pr.receptora_id = r.id
INNER JOIN protocolos_sincronizacao p ON p.id = pr.protocolo_id
WHERE 
    -- Apenas protocolos ativos (não fechados definitivamente)
    p.status != 'PASSO2_FECHADO'
ORDER BY 
    r.id,
    p.data_inicio DESC,
    pr.data_inclusao DESC;

-- Comentários para documentação
DO $$
BEGIN
    COMMENT ON COLUMN protocolo_receptoras.ciclando_classificacao IS 'Classificação de ciclagem: N ou CL. Definida apenas no Passo 1. Opcional (pode ser NULL).';
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

DO $$
BEGIN
    COMMENT ON COLUMN protocolo_receptoras.qualidade_semaforo IS 'Classificação de qualidade (semáforo): 1=vermelho, 2=amarelo, 3=verde. Definida apenas no Passo 1. Opcional (pode ser NULL).';
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

DO $$
BEGIN
    COMMENT ON VIEW vw_receptoras_protocolo_ativo IS 'View que retorna receptoras com seu protocolo ativo mais recente, incluindo classificações. Útil para consultas rápidas no frontend.';
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

COMMIT;

-- ============================================================
-- VERIFICAÇÃO (Execute após aplicar a migration)
-- ============================================================
-- Verificar estrutura da tabela:
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'protocolo_receptoras'
-- AND column_name IN ('ciclando_classificacao', 'qualidade_semaforo');

-- Verificar constraints:
-- SELECT constraint_name, check_clause
-- FROM information_schema.check_constraints
-- WHERE constraint_name IN ('chk_ciclando_classificacao', 'chk_qualidade_semaforo');

-- Testar view:
-- SELECT * FROM vw_receptoras_protocolo_ativo LIMIT 10;
