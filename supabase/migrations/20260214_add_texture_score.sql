-- ============================================================
-- Passagene - Adição de Texture Score para Filtro de Bolhas
-- ============================================================

ALTER TABLE public.embryo_scores 
  ADD COLUMN IF NOT EXISTS texture_score REAL;

COMMENT ON COLUMN public.embryo_scores.texture_score IS 'Intensidade de textura/granularidade detectada pelo OpenCV. Útil para diferenciar embriões de bolhas.';
