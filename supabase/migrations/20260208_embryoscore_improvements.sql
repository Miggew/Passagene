-- Migração: EmbryoScore improvements
-- Adiciona is_current e analysis_version para soft-delete e histórico de análises

ALTER TABLE public.embryo_scores
  ADD COLUMN IF NOT EXISTS is_current boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS analysis_version integer DEFAULT 1;

-- Index para buscar scores atuais de forma eficiente
CREATE INDEX IF NOT EXISTS idx_embryo_scores_current
  ON public.embryo_scores(embriao_id, is_current)
  WHERE is_current = true;

-- Marcar todos os scores existentes como current (migração de dados)
UPDATE public.embryo_scores SET is_current = true WHERE is_current IS NULL;
UPDATE public.embryo_scores SET analysis_version = 1 WHERE analysis_version IS NULL;
