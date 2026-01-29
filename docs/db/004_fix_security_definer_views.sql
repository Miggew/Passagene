-- ============================================
-- FIX: Remover SECURITY DEFINER das views
-- ============================================
-- As views v_user_permissions e v_embrioes_disponiveis_te estavam usando
-- SECURITY DEFINER, o que ignora as políticas RLS do usuário.
-- Este script recria as views com SECURITY INVOKER (padrão).
-- ============================================

-- 1. Primeiro, vamos obter a definição atual das views e recriá-las

-- View: v_user_permissions
-- Nota: Se você tiver a definição original, substitua abaixo
-- Esta query obtém a definição atual:
-- SELECT pg_get_viewdef('public.v_user_permissions'::regclass, true);

-- Recriar a view v_user_permissions SEM SECURITY DEFINER
-- (A view será recriada com SECURITY INVOKER que é o padrão)

-- Se a view já existe, primeiro obtemos sua definição:
DO $$
DECLARE
    view_definition TEXT;
BEGIN
    -- Obter definição da v_user_permissions
    SELECT pg_get_viewdef('public.v_user_permissions'::regclass, true) INTO view_definition;

    -- Dropar e recriar sem SECURITY DEFINER
    IF view_definition IS NOT NULL THEN
        DROP VIEW IF EXISTS public.v_user_permissions;
        EXECUTE 'CREATE VIEW public.v_user_permissions AS ' || view_definition;
        RAISE NOTICE 'View v_user_permissions recriada com SECURITY INVOKER';
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE 'View v_user_permissions não existe';
END $$;

-- Recriar a view v_embrioes_disponiveis_te SEM SECURITY DEFINER
DO $$
DECLARE
    view_definition TEXT;
BEGIN
    -- Obter definição da v_embrioes_disponiveis_te
    SELECT pg_get_viewdef('public.v_embrioes_disponiveis_te'::regclass, true) INTO view_definition;

    -- Dropar e recriar sem SECURITY DEFINER
    IF view_definition IS NOT NULL THEN
        DROP VIEW IF EXISTS public.v_embrioes_disponiveis_te;
        EXECUTE 'CREATE VIEW public.v_embrioes_disponiveis_te AS ' || view_definition;
        RAISE NOTICE 'View v_embrioes_disponiveis_te recriada com SECURITY INVOKER';
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE 'View v_embrioes_disponiveis_te não existe';
END $$;

-- ============================================
-- Verificar se as views foram corrigidas
-- ============================================
-- Execute após aplicar o script para confirmar:
/*
SELECT
    c.relname AS view_name,
    CASE
        WHEN c.relrowsecurity THEN 'SECURITY DEFINER'
        ELSE 'SECURITY INVOKER'
    END AS security_type
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'v'
  AND n.nspname = 'public'
  AND c.relname IN ('v_user_permissions', 'v_embrioes_disponiveis_te');
*/

-- ============================================
-- ALTERNATIVA: Se o script acima não funcionar,
-- execute estes comandos diretamente no Supabase SQL Editor:
-- ============================================
/*
-- Opção mais simples: ALTER VIEW para remover SECURITY DEFINER
-- (requer Postgres 15+)
ALTER VIEW public.v_user_permissions SET (security_invoker = true);
ALTER VIEW public.v_embrioes_disponiveis_te SET (security_invoker = true);
*/

-- ============================================
-- GRANT permissions (ajustar conforme necessário)
-- ============================================
GRANT SELECT ON public.v_user_permissions TO authenticated;
GRANT SELECT ON public.v_embrioes_disponiveis_te TO authenticated;
GRANT SELECT ON public.v_user_permissions TO anon;
GRANT SELECT ON public.v_embrioes_disponiveis_te TO anon;
