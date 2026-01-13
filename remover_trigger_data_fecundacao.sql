-- ============================================================
-- REMOVER TRIGGER QUE CALCULA data_fecundacao BASEADO EM aspiracao_id
-- ============================================================
-- Este trigger está causando erro porque tenta usar aspiracao_id
-- que agora é NULL na nova estrutura (usamos pacote_aspiracao_id)
-- ============================================================

-- 1. Listar todos os triggers relacionados a lotes_fiv
DO $$
DECLARE
    trigger_record RECORD;
BEGIN
    FOR trigger_record IN
        SELECT trigger_name
        FROM information_schema.triggers
        WHERE event_object_table = 'lotes_fiv'
          AND (
            action_statement ILIKE '%data_fecundacao%'
            OR action_statement ILIKE '%aspiracao_id%'
            OR trigger_name ILIKE '%data_fecundacao%'
            OR trigger_name ILIKE '%aspiracao%'
          )
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON lotes_fiv CASCADE', trigger_record.trigger_name);
        RAISE NOTICE 'Trigger % removido.', trigger_record.trigger_name;
    END LOOP;
END $$;

-- 2. Tentar remover triggers comuns (caso o loop acima não encontre)
DROP TRIGGER IF EXISTS calcular_data_fecundacao ON lotes_fiv CASCADE;
DROP TRIGGER IF EXISTS trigger_calcular_data_fecundacao ON lotes_fiv CASCADE;
DROP TRIGGER IF EXISTS trg_lotes_fiv_data_fecundacao ON lotes_fiv CASCADE;

-- 3. Verificar se há funções relacionadas que precisam ser removidas
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN
        SELECT routine_name
        FROM information_schema.routines
        WHERE routine_schema = 'public'
          AND routine_type = 'FUNCTION'
          AND (
            routine_definition ILIKE '%Aspiracao%não encontrada%'
            OR routine_definition ILIKE '%calcular data_fecundacao%'
            OR routine_definition ILIKE '%aspiracao_id%data_fecundacao%'
          )
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %I CASCADE', func_record.routine_name);
        RAISE NOTICE 'Função % removida.', func_record.routine_name;
    END LOOP;
END $$;

-- 4. Verificação final
SELECT 'Verificação concluída. Triggers restantes em lotes_fiv:' AS mensagem;
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'lotes_fiv'
ORDER BY trigger_name;
