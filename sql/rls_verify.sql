-- ============================================================
-- Verificação das Políticas RLS - PassaGene
-- Execute este script para verificar se tudo foi configurado
-- ============================================================

-- 1. Listar todas as tabelas com RLS habilitado
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = true
ORDER BY tablename;

-- 2. Listar todas as políticas criadas
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;

-- 3. Verificar as funções auxiliares
SELECT
  proname as function_name,
  prosrc as function_body
FROM pg_proc
WHERE proname IN ('get_user_cliente_id', 'is_admin_or_operacional', 'is_cliente');

-- 4. Contar políticas por tabela
SELECT
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- ============================================================
-- TESTE MANUAL (execute como usuário específico)
-- ============================================================

-- Para testar, você pode usar estas queries:

-- Verificar tipo do usuário atual
-- SELECT * FROM user_profiles WHERE id = auth.uid();

-- Testar se as funções auxiliares funcionam
-- SELECT get_user_cliente_id();
-- SELECT is_admin_or_operacional();
-- SELECT is_cliente();

-- Testar acesso a fazendas (deve filtrar para clientes)
-- SELECT COUNT(*) FROM fazendas;

-- Testar acesso a doadoras (deve filtrar para clientes)
-- SELECT COUNT(*) FROM doadoras;
