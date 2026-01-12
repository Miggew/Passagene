-- ============================================================
-- Script para Criar Histórico para Receptoras com fazenda_atual_id
-- ============================================================
-- Objetivo: Criar registros em receptora_fazenda_historico
--           para receptoras que têm fazenda_atual_id mas não têm histórico
-- ============================================================
-- ATENÇÃO: Execute apenas se a query 3 do script anterior
--          retornou receptoras sem histórico
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Verificar quantas receptoras precisam de histórico
-- ============================================================
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM receptoras r
    WHERE r.fazenda_atual_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 
          FROM receptora_fazenda_historico rfh
          WHERE rfh.receptora_id = r.id
            AND rfh.data_fim IS NULL
      );
    
    IF v_count = 0 THEN
        RAISE NOTICE 'Nenhuma receptora precisa de histórico. Todas já têm histórico ativo.';
    ELSE
        RAISE NOTICE 'Serão criados % registros de histórico', v_count;
    END IF;
END $$;

-- ============================================================
-- 2. Criar histórico para receptoras sem histórico
-- ============================================================
-- Usa a data de criação da receptora ou CURRENT_DATE como data_inicio
INSERT INTO receptora_fazenda_historico (
    receptora_id,
    fazenda_id,
    data_inicio,
    observacoes,
    created_at
)
SELECT 
    r.id AS receptora_id,
    r.fazenda_atual_id AS fazenda_id,
    COALESCE(
        DATE(r.created_at),  -- Se receptora tem created_at, usa essa data
        CURRENT_DATE         -- Senão, usa data atual
    ) AS data_inicio,
    'Histórico criado automaticamente ao migrar de fazenda_atual_id' AS observacoes,
    NOW() AS created_at
FROM receptoras r
WHERE r.fazenda_atual_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 
      FROM receptora_fazenda_historico rfh
      WHERE rfh.receptora_id = r.id
        AND rfh.data_fim IS NULL
  );

-- ============================================================
-- 3. Verificar resultado
-- ============================================================
DO $$
DECLARE
    v_criados INTEGER;
    v_restantes INTEGER;
BEGIN
    -- Contar quantos foram criados
    SELECT COUNT(*) INTO v_criados
    FROM receptora_fazenda_historico
    WHERE observacoes = 'Histórico criado automaticamente ao migrar de fazenda_atual_id';
    
    -- Contar quantos ainda faltam
    SELECT COUNT(*) INTO v_restantes
    FROM receptoras r
    WHERE r.fazenda_atual_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 
          FROM receptora_fazenda_historico rfh
          WHERE rfh.receptora_id = r.id
            AND rfh.data_fim IS NULL
      );
    
    RAISE NOTICE 'Históricos criados: %', v_criados;
    RAISE NOTICE 'Receptoras ainda sem histórico: %', v_restantes;
    
    IF v_restantes > 0 THEN
        RAISE WARNING 'Ainda existem receptoras sem histórico. Verifique manualmente.';
    ELSE
        RAISE NOTICE 'SUCESSO: Todas as receptoras agora têm histórico ativo.';
    END IF;
END $$;

COMMIT;

-- ============================================================
-- 4. Verificação final
-- ============================================================
SELECT 
    'VERIFICAÇÃO FINAL' AS status,
    COUNT(*) AS receptoras_com_fazenda_atual_id,
    COUNT(CASE WHEN rfh.fazenda_id IS NOT NULL THEN 1 END) AS receptoras_com_historico,
    COUNT(CASE WHEN rfh.fazenda_id IS NULL THEN 1 END) AS receptoras_sem_historico
FROM receptoras r
LEFT JOIN receptora_fazenda_historico rfh 
    ON rfh.receptora_id = r.id 
    AND rfh.data_fim IS NULL
WHERE r.fazenda_atual_id IS NOT NULL;

-- ============================================================
-- PRÓXIMOS PASSOS:
-- ============================================================
-- 1. Se todas as receptoras agora têm histórico:
--    - Execute: remover_fazenda_atual_id.sql
--
-- 2. Se ainda houver receptoras sem histórico:
--    - Verifique manualmente essas receptoras
--    - Crie histórico manualmente se necessário
-- ============================================================
