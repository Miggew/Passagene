-- Migration: Implementar estados das receptoras
-- Este script adiciona os campos necessários e preenche os dados existentes

-- 1. Adicionar campo status_reprodutivo se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'receptoras' 
        AND column_name = 'status_reprodutivo'
    ) THEN
        ALTER TABLE receptoras 
        ADD COLUMN status_reprodutivo VARCHAR(50);
        
        COMMENT ON COLUMN receptoras.status_reprodutivo IS 
        'Estado reprodutivo da receptora: VAZIA, EM_SINCRONIZACAO, SINCRONIZADA, SERVIDA, PRENHE, PRENHE_RETOQUE, PRENHE_FEMEA, PRENHE_MACHO, PRENHE_SEM_SEXO';
    END IF;
END $$;

-- 2. Adicionar campo data_provavel_parto se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'receptoras' 
        AND column_name = 'data_provavel_parto'
    ) THEN
        ALTER TABLE receptoras 
        ADD COLUMN data_provavel_parto DATE;
        
        COMMENT ON COLUMN receptoras.data_provavel_parto IS 
        'Data provável de parto calculada como d0 do embrião + 290 dias';
    END IF;
END $$;

-- 3. Preencher status_reprodutivo baseado na lógica atual
-- Prioridade: Sexagem > DG > TE > Protocolo > VAZIA

-- 3.1. Atualizar receptoras com sexagem (mais recente)
UPDATE receptoras r
SET status_reprodutivo = CASE
    WHEN dg.sexagem = 'FEMEA' THEN 'PRENHE_FEMEA'
    WHEN dg.sexagem = 'MACHO' THEN 'PRENHE_MACHO'
    WHEN dg.sexagem = 'PRENHE' THEN 'PRENHE_SEM_SEXO'
    ELSE 'PRENHE'
END,
data_provavel_parto = (
    SELECT (l.data_abertura + INTERVAL '290 days')::DATE
    FROM transferencias_embrioes te
    JOIN embrioes e ON e.id = te.embriao_id
    JOIN lotes_fiv l ON l.id = e.lote_fiv_id
    WHERE te.receptora_id = r.id
      AND te.data_te = dg.data_te
      AND te.status_te = 'REALIZADA'
    LIMIT 1
)
FROM (
    SELECT DISTINCT ON (receptora_id)
        receptora_id,
        data_te,
        sexagem,
        resultado
    FROM diagnosticos_gestacao
    WHERE tipo_diagnostico = 'SEXAGEM'
      AND resultado = 'PRENHE'
      AND sexagem IS NOT NULL
    ORDER BY receptora_id, data_diagnostico DESC
) dg
WHERE r.id = dg.receptora_id;

-- 3.2. Atualizar receptoras com DG PRENHE (sem sexagem ainda)
UPDATE receptoras r
SET status_reprodutivo = CASE
    WHEN dg.resultado = 'PRENHE' THEN 'PRENHE'
    WHEN dg.resultado = 'RETOQUE' THEN 'PRENHE_RETOQUE'
    WHEN dg.resultado = 'VAZIA' THEN 'VAZIA'
    ELSE status_reprodutivo
END,
data_provavel_parto = CASE
    WHEN dg.resultado IN ('PRENHE', 'RETOQUE') THEN (
        SELECT (l.data_abertura + INTERVAL '290 days')::DATE
        FROM transferencias_embrioes te
        JOIN embrioes e ON e.id = te.embriao_id
        JOIN lotes_fiv l ON l.id = e.lote_fiv_id
        WHERE te.receptora_id = r.id
          AND te.data_te = dg.data_te
          AND te.status_te = 'REALIZADA'
        LIMIT 1
    )
    ELSE data_provavel_parto
END
FROM (
    SELECT DISTINCT ON (receptora_id)
        receptora_id,
        data_te,
        resultado
    FROM diagnosticos_gestacao
    WHERE tipo_diagnostico = 'DG'
      AND resultado IN ('PRENHE', 'RETOQUE', 'VAZIA')
    ORDER BY receptora_id, data_diagnostico DESC
) dg
WHERE r.id = dg.receptora_id
  AND r.status_reprodutivo IS NULL; -- Apenas se ainda não foi atualizado pela sexagem

-- 3.3. Atualizar receptoras com TE realizada (SERVIDA)
UPDATE receptoras r
SET status_reprodutivo = 'SERVIDA'
FROM (
    SELECT DISTINCT ON (receptora_id)
        receptora_id
    FROM transferencias_embrioes
    WHERE status_te = 'REALIZADA'
    ORDER BY receptora_id, data_te DESC
) te
WHERE r.id = te.receptora_id
  AND r.status_reprodutivo IS NULL; -- Apenas se ainda não foi atualizado por DG/sexagem

-- 3.4. Atualizar receptoras em protocolos (SINCRONIZADA ou EM_SINCRONIZACAO)
UPDATE receptoras r
SET status_reprodutivo = CASE
    WHEN pr.status = 'APTA' AND p.status != 'PASSO2_FECHADO' THEN 'SINCRONIZADA'
    WHEN pr.status = 'INICIADA' AND p.status != 'PASSO2_FECHADO' THEN 'EM_SINCRONIZACAO'
    WHEN pr.status = 'APTA' AND p.status = 'PASSO2_FECHADO' THEN 'SINCRONIZADA'
    ELSE status_reprodutivo
END
FROM protocolo_receptoras pr
JOIN protocolos_sincronizacao p ON p.id = pr.protocolo_id
WHERE r.id = pr.receptora_id
  AND r.status_reprodutivo IS NULL; -- Apenas se ainda não foi atualizado

-- 3.5. Definir todas as receptoras restantes como VAZIA
UPDATE receptoras
SET status_reprodutivo = 'VAZIA'
WHERE status_reprodutivo IS NULL;

-- 4. Criar índice para melhorar performance
CREATE INDEX IF NOT EXISTS idx_receptoras_status_reprodutivo 
ON receptoras(status_reprodutivo);

CREATE INDEX IF NOT EXISTS idx_receptoras_data_provavel_parto 
ON receptoras(data_provavel_parto);

-- 5. Verificar resultados
SELECT 
    status_reprodutivo,
    COUNT(*) as quantidade
FROM receptoras
GROUP BY status_reprodutivo
ORDER BY quantidade DESC;
