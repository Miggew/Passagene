-- ============================================
-- Adicionar coluna queue_id na tabela embrioes
-- Para vincular embriões ao job de análise IA
-- ============================================

ALTER TABLE public.embrioes
  ADD COLUMN IF NOT EXISTS queue_id uuid REFERENCES public.embryo_analysis_queue(id);

-- Índice para busca rápida pela Edge Function
CREATE INDEX IF NOT EXISTS idx_embrioes_queue_id ON public.embrioes(queue_id) WHERE queue_id IS NOT NULL;
