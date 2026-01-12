-- ============================================================
-- Script para Remover fazenda_atual_id de forma Segura
-- ============================================================
-- ATENÇÃO: Execute este script apenas após verificar que
--          o campo não contém dados importantes e que
--          o histórico de fazendas está funcionando corretamente.
-- ============================================================

BEGIN;

-- ============================================================
-- PASSO 1: Verificar se há dados em fazenda_atual_id
-- ============================================================
DO $$
DECLARE
    v_count INTEGER;
    v_sem_historico INTEGER;
    v_historico_correto INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM receptoras
    WHERE fazenda_atual_id IS NOT NULL;
    
    -- Verificar quantas têm histórico correto
    SELECT COUNT(*) INTO v_historico_correto
    FROM receptoras r
    INNER JOIN receptora_fazenda_historico rfh 
        ON rfh.receptora_id = r.id 
        AND rfh.data_fim IS NULL
        AND rfh.fazenda_id = r.fazenda_atual_id
    WHERE r.fazenda_atual_id IS NOT NULL;
    
    -- Verificar quantas não têm histórico
    SELECT COUNT(*) INTO v_sem_historico
    FROM receptoras r
    WHERE r.fazenda_atual_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 
          FROM receptora_fazenda_historico rfh
          WHERE rfh.receptora_id = r.id
            AND rfh.data_fim IS NULL
      );
    
    IF v_count > 0 THEN
        RAISE NOTICE 'Encontrados % registros com fazenda_atual_id preenchido', v_count;
        RAISE NOTICE '  - Com histórico correto: %', v_historico_correto;
        RAISE NOTICE '  - Sem histórico: %', v_sem_historico;
        
        IF v_sem_historico > 0 THEN
            RAISE EXCEPTION 'Abortando: Existem % receptoras sem histórico ativo. Crie o histórico primeiro usando criar_historico_para_fazenda_atual_id.sql', v_sem_historico;
        ELSE
            RAISE NOTICE 'OK: Todas as receptoras têm histórico correto. Pode prosseguir com segurança.';
        END IF;
    ELSE
        RAISE NOTICE 'OK: Nenhum registro com fazenda_atual_id. Pode prosseguir com segurança.';
    END IF;
END $$;

-- ============================================================
-- PASSO 2: Verificar se histórico de fazendas está funcionando
-- ============================================================
DO $$
DECLARE
    v_receptoras_sem_historico INTEGER;
    v_receptoras_com_historico INTEGER;
BEGIN
    -- Contar receptoras sem histórico ativo
    SELECT COUNT(*) INTO v_receptoras_sem_historico
    FROM receptoras r
    WHERE NOT EXISTS (
        SELECT 1 
        FROM receptora_fazenda_historico rfh
        WHERE rfh.receptora_id = r.id
          AND rfh.data_fim IS NULL
    );
    
    -- Contar receptoras com histórico ativo
    SELECT COUNT(*) INTO v_receptoras_com_historico
    FROM receptora_fazenda_historico
    WHERE data_fim IS NULL;
    
    RAISE NOTICE 'Receptoras sem histórico ativo: %', v_receptoras_sem_historico;
    RAISE NOTICE 'Receptoras com histórico ativo: %', v_receptoras_com_historico;
    
    IF v_receptoras_sem_historico > 0 THEN
        RAISE WARNING 'Existem receptoras sem histórico ativo. Verifique se isso é esperado.';
    END IF;
END $$;

-- ============================================================
-- PASSO 3: Remover constraint de foreign key
-- ============================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'receptoras_fazenda_atual_id_fkey'
    ) THEN
        ALTER TABLE receptoras 
        DROP CONSTRAINT receptoras_fazenda_atual_id_fkey;
        RAISE NOTICE 'Constraint receptoras_fazenda_atual_id_fkey removida com sucesso';
    ELSE
        RAISE NOTICE 'Constraint receptoras_fazenda_atual_id_fkey não encontrada (já foi removida?)';
    END IF;
END $$;

-- ============================================================
-- PASSO 4: Remover índice se existir
-- ============================================================
DROP INDEX IF EXISTS idx_receptoras_fazenda_atual_id;

-- ============================================================
-- PASSO 5: Remover coluna fazenda_atual_id
-- ============================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'receptoras' 
          AND column_name = 'fazenda_atual_id'
    ) THEN
        ALTER TABLE receptoras 
        DROP COLUMN fazenda_atual_id;
        RAISE NOTICE 'Coluna fazenda_atual_id removida com sucesso';
    ELSE
        RAISE NOTICE 'Coluna fazenda_atual_id não encontrada (já foi removida?)';
    END IF;
END $$;

-- ============================================================
-- PASSO 6: Verificar se há referências em views
-- ============================================================
DO $$
DECLARE
    v_view_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_view_count
    FROM information_schema.views
    WHERE table_schema = 'public'
      AND view_definition ILIKE '%fazenda_atual_id%';
    
    IF v_view_count > 0 THEN
        RAISE WARNING 'Existem % views que referenciam fazenda_atual_id. Verifique manualmente:', v_view_count;
        RAISE NOTICE 'Execute: SELECT table_name, view_definition FROM information_schema.views WHERE table_schema = ''public'' AND view_definition ILIKE ''%%fazenda_atual_id%%'';';
    ELSE
        RAISE NOTICE 'OK: Nenhuma view referencia fazenda_atual_id';
    END IF;
END $$;

COMMIT;

-- ============================================================
-- VERIFICAÇÃO FINAL
-- ============================================================
SELECT 
    'VERIFICAÇÃO FINAL' AS status,
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
              AND table_name = 'receptoras' 
              AND column_name = 'fazenda_atual_id'
        ) THEN 'ERRO: Coluna ainda existe'
        ELSE 'OK: Coluna removida com sucesso'
    END AS resultado;

-- ============================================================
-- PRÓXIMOS PASSOS
-- ============================================================
-- 1. Atualizar RPC mover_receptora_fazenda para remover
--    atualizações de fazenda_atual_id
-- 2. Remover referências no código TypeScript
-- 3. Testar movimentação de receptoras entre fazendas
-- ============================================================
