-- ============================================================
-- Migration: Prompts editáveis para EmbryoScore
--
-- Adiciona colunas calibration_prompt e analysis_prompt à
-- embryo_score_config, permitindo edição via painel admin.
-- Também restringe escrita na config apenas para admins.
-- ============================================================

-- 1. Adicionar colunas de prompt (NULL = usar fallback hardcoded)
ALTER TABLE public.embryo_score_config
  ADD COLUMN IF NOT EXISTS calibration_prompt text,
  ADD COLUMN IF NOT EXISTS analysis_prompt text;

-- 2. Remover policies anteriores (idempotente)
DROP POLICY IF EXISTS "Authenticated users can manage config" ON public.embryo_score_config;
DROP POLICY IF EXISTS "Anyone can read config" ON public.embryo_score_config;
DROP POLICY IF EXISTS "Only admins can modify config" ON public.embryo_score_config;

-- 3. Leitura: qualquer autenticado (Edge Function usa service_role, mas frontend precisa ler)
CREATE POLICY "Anyone can read config" ON public.embryo_score_config
  FOR SELECT TO authenticated USING (true);

-- 4. Escrita (INSERT, UPDATE, DELETE): apenas admin
CREATE POLICY "Only admins can modify config" ON public.embryo_score_config
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND user_type = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND user_type = 'admin')
  );
