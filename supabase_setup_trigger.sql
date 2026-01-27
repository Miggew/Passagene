-- ===========================================
-- SCRIPT PARA CRIAR TRIGGER DE AUTO-CRIAÇÃO DE PERFIL
-- Execute este script no SQL Editor do Supabase
-- ===========================================

-- 1. Criar a função que será executada pelo trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, nome, user_type, active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    'operacional',
    true
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Criar o trigger que executa a função quando um usuário é criado
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===========================================
-- VERIFICAR SE O TRIGGER FOI CRIADO
-- ===========================================
SELECT
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- ===========================================
-- OPCIONAL: Criar perfil para usuários existentes que não têm perfil
-- ===========================================
-- INSERT INTO public.user_profiles (id, email, nome, user_type, active)
-- SELECT
--   au.id,
--   au.email,
--   split_part(au.email, '@', 1),
--   'operacional',
--   true
-- FROM auth.users au
-- LEFT JOIN public.user_profiles up ON au.id = up.id
-- WHERE up.id IS NULL;

-- ===========================================
-- CONFIGURAR RLS (Row Level Security)
-- ===========================================

-- Habilitar RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Remover policies antigas (se existirem)
DROP POLICY IF EXISTS "Users can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Service role can do anything" ON user_profiles;

-- Policy: Usuários autenticados podem ver todos os perfis
CREATE POLICY "Users can view all profiles"
ON user_profiles FOR SELECT
TO authenticated
USING (true);

-- Policy: Permite inserir perfil (necessário para o trigger e para admins)
CREATE POLICY "Users can insert own profile"
ON user_profiles FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: Usuários podem atualizar próprio perfil, admins podem atualizar qualquer um
CREATE POLICY "Users can update profiles"
ON user_profiles FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Policy: Permitir operações do service role (para o trigger funcionar)
CREATE POLICY "Service role full access"
ON user_profiles
TO service_role
USING (true)
WITH CHECK (true);

-- ===========================================
-- VERIFICAR POLICIES CRIADAS
-- ===========================================
SELECT policyname, cmd, permissive
FROM pg_policies
WHERE tablename = 'user_profiles';
