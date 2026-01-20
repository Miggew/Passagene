-- Script para ajustar um lote FIV para estar no D7 (disponível para produzir embriões)
-- Lote ID: d3494c6b-c789-4bca-bfcc-d852af9699c4
--
-- Lógica:
-- D-1 = dia da aspiração (data do pacote)
-- D0 = D-1 + 1 dia (fecundação, data_abertura do lote)
-- D7 = D-1 + 8 dias (transferência)
--
-- Para que o lote esteja no D7 hoje:
-- - Se hoje = D7, então: dataAspiracao = hoje - 8 dias
-- - data_abertura (D0) = dataAspiracao + 1 = (hoje - 8) + 1 = hoje - 7 dias
--
-- Portanto, vamos atualizar data_abertura para HOJE - 7 dias

-- ============================================================
-- PASSO 1: Verificar lote atual
-- ============================================================

SELECT 
    id,
    data_abertura,
    status,
    pacote_aspiracao_id,
    observacoes
FROM lotes_fiv
WHERE id = 'd3494c6b-c789-4bca-bfcc-d852af9699c4';

-- ============================================================
-- PASSO 2: Atualizar data_abertura do lote (hoje - 7 dias)
-- ============================================================

-- Calcular data de hoje - 8 dias
-- data_abertura = D0 = fecundação = aspiração + 1
-- Se aspiração = hoje - 9 dias, então data_abertura = hoje - 8 dias
UPDATE lotes_fiv
SET 
    data_abertura = (CURRENT_DATE - INTERVAL '8 days')::date
WHERE id = 'd3494c6b-c789-4bca-bfcc-d852af9699c4';

-- ============================================================
-- PASSO 3: IMPORTANTE - Atualizar também a data do pacote de aspiração
-- ============================================================
-- O sistema PRIORIZA a data do pacote para calcular o dia!
-- Se o pacote tem data_aspiracao, ele usa essa data, não a data_abertura.

-- Atualizar data_aspiracao do pacote para hoje - 9 dias
-- (se está mostrando D6, precisamos ajustar para D7)
-- D6 = dia_atual = 7, D7 = dia_atual = 8
-- Para dia_atual = 8, aspiração = hoje - 9 dias
UPDATE pacotes_aspiracao
SET 
    data_aspiracao = (CURRENT_DATE - INTERVAL '9 days')::date
WHERE id = (
    SELECT pacote_aspiracao_id 
    FROM lotes_fiv 
    WHERE id = 'd3494c6b-c789-4bca-bfcc-d852af9699c4'
    AND pacote_aspiracao_id IS NOT NULL
);

-- ============================================================
-- PASSO 4: Verificar se atualizou corretamente
-- ============================================================

-- Verificação completa com dados do pacote
SELECT 
    l.id,
    l.data_abertura as lote_data_abertura,
    p.data_aspiracao as pacote_data_aspiracao,
    l.status,
    -- Calcular dia atual baseado na aspiração do pacote (que o sistema prioriza)
    CASE 
        WHEN p.data_aspiracao IS NOT NULL THEN 
            CURRENT_DATE - p.data_aspiracao::date
        ELSE 
            CURRENT_DATE - (l.data_abertura::date - INTERVAL '1 day')::date
    END as dia_atual_calculado,
    -- Verificar se está no D7 (dia_atual = 8)
    CASE 
        WHEN (CASE 
            WHEN p.data_aspiracao IS NOT NULL THEN 
                CURRENT_DATE - p.data_aspiracao::date
            ELSE 
                CURRENT_DATE - (l.data_abertura::date - INTERVAL '1 day')::date
        END) = 8 THEN '✅ D7 - Perfeito! Disponível para produzir embriões'
        WHEN (CASE 
            WHEN p.data_aspiracao IS NOT NULL THEN 
                CURRENT_DATE - p.data_aspiracao::date
            ELSE 
                CURRENT_DATE - (l.data_abertura::date - INTERVAL '1 day')::date
        END) < 8 THEN '⏳ Ainda não chegou no D7'
        WHEN (CASE 
            WHEN p.data_aspiracao IS NOT NULL THEN 
                CURRENT_DATE - p.data_aspiracao::date
            ELSE 
                CURRENT_DATE - (l.data_abertura::date - INTERVAL '1 day')::date
        END) > 8 THEN '⚠️ Passou do D7'
    END as status_verificacao
FROM lotes_fiv l
LEFT JOIN pacotes_aspiracao p ON p.id = l.pacote_aspiracao_id
WHERE l.id = 'd3494c6b-c789-4bca-bfcc-d852af9699c4';

-- ============================================================
-- OBSERVAÇÃO IMPORTANTE
-- ============================================================
-- O sistema PRIORIZA a data do pacote de aspiração para calcular o dia.
-- Por isso, atualizamos AMBOS:
-- 1. data_abertura do lote = hoje - 8 dias (D0 = fecundação)
-- 2. data_aspiracao do pacote = hoje - 9 dias (D-1 = aspiração)
--
-- Isso garante que o cálculo do dia_atual seja correto:
-- dia_atual = diffDays(hoje, data_aspiracao_do_pacote) = 8
-- Quando dia_atual = 8, estamos no D7 ✅
--
-- Após executar este script:
-- 1. Recarregue a página do sistema
-- 2. O lote deve aparecer como D7 (Blastocisto Expandido)
-- 3. Deve estar disponível para produzir embriões
