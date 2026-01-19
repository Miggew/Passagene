-- ============================================================================
-- Script para recalcular TODAS as datas de parto usando 275 dias (em vez de 290)
-- ============================================================================
-- Este script atualiza data_provavel_parto para todas as receptoras prenhes
-- baseado no D0 do embrião (data_abertura do lote FIV) + 275 dias

-- 1. Atualizar receptoras com sexagem (prioridade mais alta)
UPDATE receptoras r
SET data_provavel_parto = (
    SELECT (l.data_abertura + INTERVAL '275 days')::DATE
    FROM transferencias_embrioes te
    JOIN embrioes e ON e.id = te.embriao_id
    JOIN lotes_fiv l ON l.id = e.lote_fiv_id
    WHERE te.receptora_id = r.id
      AND te.status_te = 'REALIZADA'
    ORDER BY te.data_te DESC
    LIMIT 1
)
FROM (
    SELECT DISTINCT ON (receptora_id)
        receptora_id,
        data_te
    FROM diagnosticos_gestacao
    WHERE tipo_diagnostico = 'SEXAGEM'
      AND resultado = 'PRENHE'
      AND sexagem IS NOT NULL
    ORDER BY receptora_id, data_diagnostico DESC
) dg
WHERE r.id = dg.receptora_id
  AND r.status_reprodutivo IN ('PRENHE_FEMEA', 'PRENHE_MACHO', 'PRENHE_SEM_SEXO', 'PRENHE_2_SEXOS', 'PRENHE', 'PRENHE_RETOQUE');

-- 2. Atualizar receptoras com DG PRENHE (sem sexagem ainda)
UPDATE receptoras r
SET data_provavel_parto = (
    SELECT (l.data_abertura + INTERVAL '275 days')::DATE
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
        data_te
    FROM diagnosticos_gestacao
    WHERE tipo_diagnostico = 'DG'
      AND resultado IN ('PRENHE', 'RETOQUE')
    ORDER BY receptora_id, data_diagnostico DESC
) dg
WHERE r.id = dg.receptora_id
  AND r.status_reprodutivo IN ('PRENHE', 'PRENHE_RETOQUE')
  AND r.data_provavel_parto IS NULL; -- Apenas se ainda não foi atualizado pela sexagem

-- 3. Verificar resultados
SELECT 
    status_reprodutivo,
    COUNT(*) as total,
    COUNT(data_provavel_parto) as com_data_parto,
    COUNT(*) - COUNT(data_provavel_parto) as sem_data_parto
FROM receptoras
WHERE status_reprodutivo IN ('PRENHE', 'PRENHE_RETOQUE', 'PRENHE_FEMEA', 'PRENHE_MACHO', 'PRENHE_SEM_SEXO', 'PRENHE_2_SEXOS')
GROUP BY status_reprodutivo
ORDER BY status_reprodutivo;

-- 4. Mostrar algumas datas de exemplo para verificação
SELECT 
    r.identificacao,
    r.status_reprodutivo,
    r.data_provavel_parto,
    l.data_abertura as d0_embriao,
    (r.data_provavel_parto - l.data_abertura) as dias_calculados
FROM receptoras r
JOIN transferencias_embrioes te ON te.receptora_id = r.id AND te.status_te = 'REALIZADA'
JOIN embrioes e ON e.id = te.embriao_id
JOIN lotes_fiv l ON l.id = e.lote_fiv_id
WHERE r.status_reprodutivo IN ('PRENHE', 'PRENHE_RETOQUE', 'PRENHE_FEMEA', 'PRENHE_MACHO', 'PRENHE_SEM_SEXO', 'PRENHE_2_SEXOS')
  AND r.data_provavel_parto IS NOT NULL
ORDER BY r.data_provavel_parto DESC
LIMIT 10;
