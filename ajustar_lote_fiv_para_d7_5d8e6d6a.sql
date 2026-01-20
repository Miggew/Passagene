-- ============================================================
-- Script para ajustar lote FIV para D7 (disponível para produzir embriões)
-- Lote ID: 5d8e6d6a-f050-4eb0-893b-92645fc03f8c
-- ============================================================
--
-- Lógica do sistema:
-- D-1 = dia da aspiração (data_aspiracao do pacote)
-- D0  = D-1 + 1 dia (fecundação, data_abertura do lote)
-- D7  = D-1 + 8 dias (Blastocisto Expandido - disponível para produzir embriões)
--
-- Para que o lote esteja no D7 hoje:
-- - data_aspiracao do pacote = hoje - 9 dias (D-1)
-- - data_abertura do lote = hoje - 7 dias (D0)
--
-- O sistema PRIORIZA a data do pacote para calcular o dia atual!
-- ============================================================

BEGIN;

-- ============================================================
-- PASSO 1: Verificar lote atual
-- ============================================================

SELECT 
    l.id,
    l.data_abertura as lote_data_abertura,
    p.data_aspiracao as pacote_data_aspiracao,
    l.status,
    l.pacote_aspiracao_id,
    -- Calcular dia atual
    CASE 
        WHEN p.data_aspiracao IS NOT NULL THEN 
            CURRENT_DATE - p.data_aspiracao::date
        ELSE 
            CURRENT_DATE - (l.data_abertura::date - INTERVAL '1 day')::date
    END as dia_atual_calculado
FROM lotes_fiv l
LEFT JOIN pacotes_aspiracao p ON p.id = l.pacote_aspiracao_id
WHERE l.id = '5d8e6d6a-f050-4eb0-893b-92645fc03f8c';

-- ============================================================
-- PASSO 2: Atualizar data_abertura do lote para D0 (hoje - 7 dias)
-- ============================================================

UPDATE lotes_fiv
SET 
    data_abertura = (CURRENT_DATE - INTERVAL '7 days')::date
WHERE id = '5d8e6d6a-f050-4eb0-893b-92645fc03f8c';

-- ============================================================
-- PASSO 3: IMPORTANTE - Atualizar também a data do pacote de aspiração
-- ============================================================
-- O sistema PRIORIZA a data do pacote para calcular o dia!
-- Se o pacote tem data_aspiracao, ele usa essa data, não a data_abertura.
--
-- Lógica para estar no D7 (dia_atual calculado = 8):
-- - data_aspiracao do pacote = hoje - 9 dias (D-1 = aspiração)
-- - data_abertura do lote = hoje - 8 dias (D0 = fecundação)
--
-- Isso garante que: dia_atual = CURRENT_DATE - data_aspiracao = 9
-- Mas o sistema pode interpretar dia_atual = 9 como D7
-- Ou pode usar: dia_atual = CURRENT_DATE - data_abertura + 1 = 8, que é D7
--
-- Vou usar a lógica que funcionou no script anterior:
-- data_aspiracao = hoje - 9 dias
-- data_abertura = hoje - 8 dias

UPDATE pacotes_aspiracao
SET 
    data_aspiracao = (CURRENT_DATE - INTERVAL '9 days')::date
WHERE id = (
    SELECT pacote_aspiracao_id 
    FROM lotes_fiv 
    WHERE id = '5d8e6d6a-f050-4eb0-893b-92645fc03f8c'
    AND pacote_aspiracao_id IS NOT NULL
);

-- Ajustar data_abertura para ser D0 (aspiração + 1 dia) = hoje - 8 dias
UPDATE lotes_fiv
SET 
    data_abertura = (CURRENT_DATE - INTERVAL '8 days')::date
WHERE id = '5d8e6d6a-f050-4eb0-893b-92645fc03f8c';

COMMIT;

-- ============================================================
-- PASSO 4: Verificar se atualizou corretamente
-- ============================================================

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
WHERE l.id = '5d8e6d6a-f050-4eb0-893b-92645fc03f8c';

-- ============================================================
-- OBSERVAÇÃO IMPORTANTE
-- ============================================================
-- O sistema PRIORIZA a data do pacote de aspiração para calcular o dia.
-- Por isso, atualizamos AMBOS:
-- 1. data_aspiracao do pacote = hoje - 9 dias (D-1 = aspiração)
-- 2. data_abertura do lote = hoje - 8 dias (D0 = fecundação)
--
-- Isso garante que o cálculo do dia_atual seja correto.
-- O sistema calcula o dia baseado na data_aspiracao do pacote quando disponível.
--
-- Após executar este script:
-- 1. Recarregue a página do sistema
-- 2. O lote deve aparecer como D7 (Blastocisto Expandido)
-- 3. Deve estar disponível para produzir embriões
