-- ============================================
-- EmbryoScore Sprint 5: Feedback do biólogo
-- ============================================

-- Adicionar campos de feedback do biólogo na tabela embryo_scores
ALTER TABLE public.embryo_scores
  ADD COLUMN IF NOT EXISTS biologo_concorda boolean,
  ADD COLUMN IF NOT EXISTS biologo_nota text;

-- ============================================
-- Fix: RLS policies que causam 409 Conflict
-- ============================================

-- A policy original da embryo_analysis_queue usava FOR ALL com USING(true)
-- mas sem WITH CHECK(true), causando 409 no INSERT.
-- Dropar e recriar com WITH CHECK explícito.
DROP POLICY IF EXISTS "Authenticated users can manage queue" ON public.embryo_analysis_queue;
CREATE POLICY "Authenticated users can manage queue" ON public.embryo_analysis_queue
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- A tabela embrioes precisa permitir UPDATE do campo acasalamento_media_id
-- pelo role authenticated. Criar policy se não existir.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'embrioes' AND policyname = 'Authenticated users can update embrioes'
  ) THEN
    CREATE POLICY "Authenticated users can update embrioes" ON public.embrioes
      FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END
$$;

-- Garantir que embryo_scores permite UPDATE pelo authenticated (para feedback do biólogo)
DROP POLICY IF EXISTS "Authenticated users can update scores" ON public.embryo_scores;
CREATE POLICY "Authenticated users can update scores" ON public.embryo_scores
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Garantir que authenticated pode INSERT em embryo_scores (para service_role fallback)
DROP POLICY IF EXISTS "Authenticated users can insert scores" ON public.embryo_scores;
CREATE POLICY "Authenticated users can insert scores" ON public.embryo_scores
  FOR INSERT TO authenticated WITH CHECK (true);

-- Fix: acasalamento_embrioes_media — recriar policies com FOR ALL para cobrir todos os casos
DROP POLICY IF EXISTS "Authenticated users can read media" ON public.acasalamento_embrioes_media;
DROP POLICY IF EXISTS "Authenticated users can insert media" ON public.acasalamento_embrioes_media;
CREATE POLICY "Authenticated users full access media" ON public.acasalamento_embrioes_media
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Fix: embryo_analysis_queue — recriar com WITH CHECK explícito
DROP POLICY IF EXISTS "Authenticated users can manage queue" ON public.embryo_analysis_queue;
CREATE POLICY "Authenticated users can manage queue" ON public.embryo_analysis_queue
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Fix: embryo_scores — adicionar INSERT e UPDATE para authenticated
DROP POLICY IF EXISTS "Authenticated users can insert scores" ON public.embryo_scores;
CREATE POLICY "Authenticated users can insert scores" ON public.embryo_scores
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update scores" ON public.embryo_scores;
CREATE POLICY "Authenticated users can update scores" ON public.embryo_scores
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Fix: embryo_score_config — admin precisa INSERT/UPDATE para salvar configs
DROP POLICY IF EXISTS "Authenticated users can manage config" ON public.embryo_score_config;
CREATE POLICY "Authenticated users can manage config" ON public.embryo_score_config
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
