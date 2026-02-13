-- ============================================================
-- Passagene - Fase 1: Automação e Segurança EmbryoScore
-- ============================================================

-- 1. FUNÇÃO PARA AUTO-ENFILEIRAR ANÁLISE
-- Objetivo: Acabar com mídias órfãs (vídeo sem job de análise)
CREATE OR REPLACE FUNCTION public.handle_new_embryo_video()
RETURNS TRIGGER AS $$
BEGIN
  -- Só cria job se for vídeo e se ainda não existir um job para esta mídia
  IF NEW.tipo_media = 'VIDEO' THEN
    IF NOT EXISTS (SELECT 1 FROM public.embryo_analysis_queue WHERE media_id = NEW.id) THEN
      INSERT INTO public.embryo_analysis_queue (media_id, lote_fiv_acasalamento_id, status)
      VALUES (NEW.id, NEW.lote_fiv_acasalamento_id, 'pending');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger na tabela de mídias
DROP TRIGGER IF EXISTS on_embryo_video_created ON public.acasalamento_embrioes_media;
CREATE TRIGGER on_embryo_video_created
  AFTER INSERT ON public.acasalamento_embrioes_media
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_embryo_video();


-- 2. REFORÇO DE SEGURANÇA (RLS)
-- Objetivo: Garantir isolamento multi-tenant (um cliente não vê dados de outro)

-- Habilitar RLS (caso não esteja)
ALTER TABLE public.embryo_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embryo_analysis_queue ENABLE ROW LEVEL SECURITY;

-- Política para embryo_scores (Leitura)
-- Relaciona o score -> embrião -> lote -> fazenda -> cliente_id
DROP POLICY IF EXISTS "embryo_scores_select_policy" ON public.embryo_scores;
CREATE POLICY "embryo_scores_select_policy" ON public.embryo_scores
  FOR SELECT USING (
    is_admin_or_operacional()
    OR EXISTS (
      SELECT 1 FROM public.embrioes e
      JOIN public.lotes_fiv lf ON e.lote_fiv_id = lf.id
      JOIN public.pacotes_aspiracao pa ON lf.pacote_aspiracao_id = pa.id
      JOIN public.fazendas f ON pa.fazenda_id = f.id
      WHERE e.id = embryo_scores.embriao_id
      AND f.cliente_id = get_user_cliente_id()
    )
  );

-- Política para embryo_scores (Update - apenas biólogo/admin)
DROP POLICY IF EXISTS "embryo_scores_update_policy" ON public.embryo_scores;
CREATE POLICY "embryo_scores_update_policy" ON public.embryo_scores
  FOR UPDATE USING (is_admin_or_operacional())
  WITH CHECK (is_admin_or_operacional());

-- Política para embryo_analysis_queue (Leitura)
DROP POLICY IF EXISTS "embryo_analysis_queue_select_policy" ON public.embryo_analysis_queue;
CREATE POLICY "embryo_analysis_queue_select_policy" ON public.embryo_analysis_queue
  FOR SELECT USING (
    is_admin_or_operacional()
    OR EXISTS (
      SELECT 1 FROM public.fazendas f
      JOIN public.pacotes_aspiracao pa ON f.id = pa.fazenda_id
      JOIN public.lotes_fiv lf ON pa.id = lf.pacote_aspiracao_id
      WHERE lf.id = (
        SELECT lote_fiv_id FROM public.lotes_fiv_acasalamentos 
        WHERE id = embryo_analysis_queue.lote_fiv_acasalamento_id
      )
      AND f.cliente_id = get_user_cliente_id()
    )
  );

-- Garantir que Service Role e Admin podem tudo
DROP POLICY IF EXISTS "Admin full access scores" ON public.embryo_scores;
CREATE POLICY "Admin full access scores" ON public.embryo_scores
  FOR ALL TO authenticated USING (is_admin_or_operacional());

DROP POLICY IF EXISTS "Admin full access queue" ON public.embryo_analysis_queue;
CREATE POLICY "Admin full access queue" ON public.embryo_analysis_queue
  FOR ALL TO authenticated USING (is_admin_or_operacional());
