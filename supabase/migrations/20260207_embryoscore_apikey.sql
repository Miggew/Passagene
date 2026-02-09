-- ============================================================
-- Migration: Tabela de segredos para EmbryoScore
--
-- Cria tabela separada para armazenar API keys (GEMINI_API_KEY)
-- com RLS restrito: apenas admins podem ler e modificar.
-- A Edge Function usa service_role (bypassa RLS).
-- ============================================================

-- 1. Criar tabela de segredos
CREATE TABLE IF NOT EXISTS public.embryo_score_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_name text NOT NULL UNIQUE,
  key_value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- 2. Habilitar RLS
ALTER TABLE public.embryo_score_secrets ENABLE ROW LEVEL SECURITY;

-- 3. Remover policies anteriores (idempotente)
DROP POLICY IF EXISTS "Only admins can read secrets" ON public.embryo_score_secrets;
DROP POLICY IF EXISTS "Only admins can modify secrets" ON public.embryo_score_secrets;

-- 4. Apenas admin pode LER (Edge Function usa service_role, não precisa de SELECT público)
CREATE POLICY "Only admins can read secrets" ON public.embryo_score_secrets
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND user_type = 'admin')
  );

-- 5. Apenas admin pode MODIFICAR (INSERT, UPDATE, DELETE)
CREATE POLICY "Only admins can modify secrets" ON public.embryo_score_secrets
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND user_type = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND user_type = 'admin')
  );
