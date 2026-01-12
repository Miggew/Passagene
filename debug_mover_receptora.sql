-- ============================================================
-- Debug: Verificar estado antes de mover receptora
-- ============================================================
-- Execute isso ANTES de tentar mover para ver o estado atual
-- ============================================================

-- Substitua 'RECEPTORA_ID_AQUI' pelo ID da receptora que você está tentando mover
-- Exemplo: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

-- 1. Verificar registros no histórico
SELECT 
    id,
    receptora_id,
    fazenda_id,
    data_inicio,
    data_fim,
    created_at,
    updated_at
FROM receptora_fazenda_historico
WHERE receptora_id = 'RECEPTORA_ID_AQUI'  -- SUBSTITUA PELO ID DA RECEPTORA
ORDER BY data_inicio DESC, created_at DESC;

-- 2. Verificar quantos vínculos ativos existem
SELECT 
    receptora_id,
    COUNT(*) as viculos_ativos,
    array_agg(fazenda_id) as fazendas_ativas
FROM receptora_fazenda_historico
WHERE receptora_id = 'RECEPTORA_ID_AQUI'  -- SUBSTITUA PELO ID DA RECEPTORA
  AND data_fim IS NULL
GROUP BY receptora_id;

-- 3. Verificar fazenda atual na tabela receptoras
SELECT 
    id,
    identificacao,
    fazenda_atual_id
FROM receptoras
WHERE id = 'RECEPTORA_ID_AQUI';  -- SUBSTITUA PELO ID DA RECEPTORA
