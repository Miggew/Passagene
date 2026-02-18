/**
 * useQuickClassify — Hook for the touch-to-classify flow.
 *
 * 1. Fetches queue job → media → signed URL
 * 2. Extracts 1 frame from video via Canvas
 * 3. Manages markers (position, radius, classification)
 * 4. Saves manual_bboxes + classificacao + dispatches Edge Function
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { ClassificacaoEmbriao } from '@/lib/types';

export interface Marker {
  x_percent: number;
  y_percent: number;
  radius_percent: number;
  classification: ClassificacaoEmbriao | null;
}

interface EmbryoRecord {
  id: string;
  identificacao?: string;
}

async function extractFrameFromVideo(videoUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'metadata';
    video.muted = true;

    const cleanup = () => {
      video.onloadeddata = null;
      video.onseeked = null;
      video.onerror = null;
    };

    video.onloadeddata = () => {
      video.currentTime = Math.min(0.5, video.duration / 2);
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d')!.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        cleanup();
        video.src = '';
        resolve(dataUrl);
      } catch (e) {
        cleanup();
        reject(new Error('Falha ao extrair frame do vídeo'));
      }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('Falha ao carregar vídeo'));
    };

    video.src = videoUrl;
  });
}

export function useQuickClassify(queueId: string) {
  const [embrioes, setEmbrioes] = useState<EmbryoRecord[]>([]);
  const [frameDataUrl, setFrameDataUrl] = useState<string | null>(null);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [isFrameLoading, setIsFrameLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const jobDataRef = useRef<{ media_id: string; lote_fiv_acasalamento_id: string } | null>(null);

  // Fetch job data + extract frame
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        setIsFrameLoading(true);
        setError(null);

        // 1. Fetch queue job
        const { data: job, error: jobErr } = await supabase
          .from('embryo_analysis_queue')
          .select('media_id, lote_fiv_acasalamento_id')
          .eq('id', queueId)
          .single();
        if (jobErr || !job) throw new Error('Job não encontrado');
        if (cancelled) return;

        jobDataRef.current = job;

        // 2. Fetch media path
        const { data: media, error: mediaErr } = await supabase
          .from('acasalamento_embrioes_media')
          .select('arquivo_path')
          .eq('id', job.media_id)
          .single();
        if (mediaErr || !media) throw new Error('Mídia não encontrada');
        if (cancelled) return;

        // 3. Fetch embryos for this queue
        const { data: embryoData } = await supabase
          .from('embrioes')
          .select('id, identificacao')
          .eq('queue_id', queueId)
          .order('id');
        if (cancelled) return;
        setEmbrioes(embryoData || []);

        // 4. Get signed URL
        const { data: signed, error: signErr } = await supabase.storage
          .from('embryo-videos')
          .createSignedUrl(media.arquivo_path, 3600);
        if (signErr || !signed?.signedUrl) throw new Error('Falha ao gerar URL assinada');
        if (cancelled) return;

        // 5. Extract frame
        const frame = await extractFrameFromVideo(signed.signedUrl);
        if (cancelled) return;
        setFrameDataUrl(frame);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Erro desconhecido');
        }
      } finally {
        if (!cancelled) setIsFrameLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
  }, [queueId]);

  const addMarker = useCallback((pos: { x_percent: number; y_percent: number; radius_percent: number }) => {
    setMarkers((prev) => [...prev, { ...pos, classification: null }]);
  }, []);

  const updateMarkerRadius = useCallback((index: number, radius: number) => {
    setMarkers((prev) => prev.map((m, i) => (i === index ? { ...m, radius_percent: radius } : m)));
  }, []);

  const updateMarkerPosition = useCallback((index: number, x_percent: number, y_percent: number) => {
    setMarkers((prev) => prev.map((m, i) => (i === index ? { ...m, x_percent, y_percent } : m)));
  }, []);

  const classifyMarker = useCallback((index: number, cls: ClassificacaoEmbriao) => {
    setMarkers((prev) => prev.map((m, i) => (i === index ? { ...m, classification: cls } : m)));
  }, []);

  const undoLast = useCallback(() => {
    setMarkers((prev) => prev.slice(0, -1));
  }, []);

  const saveAndFinish = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      // 1. Save manual_bboxes to queue
      const bboxes = markers.map((m, i) => ({
        x_percent: m.x_percent,
        y_percent: m.y_percent,
        width_percent: m.radius_percent * 2,
        height_percent: m.radius_percent * 2,
        radius_px: 0,
        classification: m.classification || null,
        touch_order: i,
      }));

      const { error: queueErr } = await supabase
        .from('embryo_analysis_queue')
        .update({ manual_bboxes: bboxes })
        .eq('id', queueId);
      if (queueErr) console.error('saveAndFinish step 1 (manual_bboxes):', queueErr);

      // 2. Save classifications to embryos
      for (let i = 0; i < markers.length; i++) {
        const m = markers[i];
        const embriaoId = embrioes[i]?.id;
        if (embriaoId && m.classification) {
          const { error: embErr } = await supabase
            .from('embrioes')
            .update({
              classificacao: m.classification,
              data_classificacao: new Date().toISOString(),
            })
            .eq('id', embriaoId);
          if (embErr) console.error(`saveAndFinish step 2 (embriao ${i}):`, embErr);
        }
      }

      // 3. Dispatch Edge Function
      console.log('saveAndFinish step 4: dispatching Edge Function for', queueId);
      const { error: fnErr } = await supabase.functions.invoke('embryo-analyze', {
        body: { queue_id: queueId },
      });
      if (fnErr) console.error('saveAndFinish step 4 (Edge Function):', fnErr);
      else console.log('saveAndFinish: Edge Function dispatched OK');
    } catch (e) {
      console.error('saveAndFinish unexpected error:', e);
      throw e;
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, markers, embrioes, queueId]);

  const classified = markers.filter((m) => m.classification !== null).length;

  return {
    embrioes,
    frameDataUrl,
    markers,
    isFrameLoading,
    isSaving,
    error,
    addMarker,
    updateMarkerRadius,
    updateMarkerPosition,
    classifyMarker,
    undoLast,
    saveAndFinish,
    progress: {
      marked: markers.length,
      classified,
      total: embrioes.length,
    },
  };
}
