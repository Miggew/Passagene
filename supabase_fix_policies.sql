-- ===========================================
-- SCRIPT PARA CORRIGIR POLICIES DO USER_PROFILES
-- Execute este script no SQL Editor do Supabase
-- ===========================================

-- 1. Primeiro, vamos ver o estado atual das policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'user_profiles';

-- 2. Remover policies existentes (se houver problemas)
-- DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
-- DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
-- DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
-- DROP POLICY IF EXISTS "Admins can update all profiles" ON user_profiles;

-- 3. Habilitar RLS na tabela (se ainda não estiver)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 4. Criar policy para SELECT - usuários autenticados podem ver todos os perfis
-- (necessário para admins gerenciarem usuários)
CREATE POLICY "Authenticated users can view profiles"
ON user_profiles
FOR SELECT
TO authenticated
USING (true);

-- 5. Criar policy para INSERT - usuários autenticados podem criar perfis
CREATE POLICY "Authenticated users can insert profiles"
ON user_profiles
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 6. Criar policy para UPDATE - usuários podem atualizar seu próprio perfil
-- ou admins podem atualizar qualquer perfil
CREATE POLICY "Users can update own profile or admin can update any"
ON user_profiles
FOR UPDATE
TO authenticated
USING (
  id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND user_type = 'admin'
  )
)
WITH CHECK (
  id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND user_type = 'admin'
  )
);

-- 7. Criar policy para DELETE - apenas admins
CREATE POLICY "Only admins can delete profiles"
ON user_profiles
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND user_type = 'admin'
  )
);

-- ===========================================
-- VERIFICAR SE AS POLICIES FORAM CRIADAS
-- ===========================================
SELECT
  policyname,
  cmd,
  permissive
FROM pg_policies
WHERE tablename = 'user_profiles';
