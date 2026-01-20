-- Script completo para verificar e ajustar lote FIV para D7
-- Lote ID: d3494c6b-c789-4bca-bfcc-d852af9699c4

-- ============================================================
-- PASSO 1: Verificar lote atual e pacote relacionado
-- ============================================================

SELECT 
    l.id,
    l.data_abertura,
    l.status,
    l.pacote_aspiracao_id,
    p.data_aspiracao as pacote_data_aspiracao,
    -- Calcular dias desde abertura
    CURRENT_DATE - l.data_abertura::date as dias_desde_abertura,
    -- Calcular dias desde aspiração (se houver pacote)
    CASE 
        WHEN p.data_aspiracao IS NOT NULL THEN CURRENT_DATE - p.data_aspiracao::date
        ELSE CURRENT_DATE - (l.data_abertura::date - INTERVAL '1 day')::date
    END as dias_desde_aspiracao
FROM lotes_fiv l
LEFT JOIN pacotes_aspiracao p ON p.id = l.pacote_aspiracao_id
WHERE l.id = 'd3494c6b-c789-4bca-bfcc-d852af9699c4';

-- ============================================================
-- PASSO 2: Entender a lógica do sistema
-- ============================================================
-- O sistema calcula o dia assim:
-- 1. Busca data_aspiracao do pacote (se existir)
-- 2. Se não existir, calcula: dataAspiracao = data_abertura - 1 dia
-- 3. diaAtual = diffDays(hoje, dataAspiracao)
-- 4. Quando diaAtual = 8, estamos no D7

-- Para estar no D7 hoje:
-- diaAtual = 8 = diffDays(hoje, dataAspiracao)
-- Isso significa: dataAspiracao = hoje - 8 dias
-- E: data_abertura (D0) = dataAspiracao + 1 = hoje - 7 dias

-- ============================================================
-- PASSO 3: Atualizar data_abertura do lote
-- ============================================================

-- Atualizar para 7 dias atrás (isso faz data_abertura ser D0 = hoje - 7)
UPDATE lotes_fiv
SET 
    data_abertura = (CURRENT_DATE - INTERVAL '7 days')::date
WHERE id = 'd3494c6b-c789-4bca-bfcc-d852af9699c4';

-- ============================================================
-- PASSO 4: Também atualizar data_aspiracao do pacote (se existir)
-- ============================================================
-- IMPORTANTE: O sistema prioriza a data do pacote, então precisamos
-- atualizar o pacote também para garantir que o cálculo esteja correto

-- Buscar pacote relacionado
DO $$
DECLARE
    pacote_id_var UUID;
BEGIN
    -- Buscar ID do pacote
    SELECT pacote_aspiracao_id INTO pacote_id_var
    FROM lotes_fiv
    WHERE id = 'd3494c6b-c789-4bca-bfcc-d852af9699c4';
    
    -- Se encontrou pacote, atualizar data_aspiracao para hoje - 8 dias
    IF pacote_id_var IS NOT NULL THEN
        UPDATE pacotes_aspiracao
        SET data_aspiracao = (CURRENT_DATE - INTERVAL '8 days')::date
        WHERE id = pacote_id_var;
        
        RAISE NOTICE 'Pacote atualizado: %', pacote_id_var;
    ELSE
        RAISE NOTICE 'Lote não possui pacote_aspiracao_id vinculado.';
    END IF;
END $$;

-- ============================================================
-- PASSO 5: Verificar resultado final
-- ============================================================

SELECT 
    l.id,
    l.data_abertura as lote_data_abertura,
    p.data_aspiracao as pacote_data_aspiracao,
    l.status,
    -- Calcular dia atual baseado na aspiração do pacote (ou estimada)
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
        END) = 8 THEN '✅ D7 - Perfeito!'
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
-- RESUMO
-- ============================================================
-- Se o sistema não está mostrando D7 após executar este script:
-- 1. Recarregue a página do sistema
-- 2. Verifique se o lote está ABERTO (status = 'ABERTO')
-- 3. Verifique se há acasalamentos no lote (se não houver, pode não aparecer)
-- 4. Execute o PASSO 5 novamente para verificar o cálculo
