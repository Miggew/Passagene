-- Add progress_message column to embryo_analysis_queue
-- Run this in the Supabase Dashboard SQL editor BEFORE deploying Cloud Run + frontend changes.

ALTER TABLE public.embryo_analysis_queue
  ADD COLUMN IF NOT EXISTS progress_message TEXT;

COMMENT ON COLUMN public.embryo_analysis_queue.progress_message
  IS 'Real-time progress from Cloud Run pipeline (e.g. "Extraindo frames...", "Classificando com IA...")';
