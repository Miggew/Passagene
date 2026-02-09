/**
 * Hook para upload de vídeos de embriões para Supabase Storage
 *
 * Responsabilidades:
 * 1. Upload do vídeo para bucket embryo-videos
 * 2. Criar registro em acasalamento_embrioes_media
 * 3. Detectar círculos (embriões) via OpenCV.js HoughCircles
 * 4. Retornar estado de upload (progress, error, mediaId, bboxes)
 *
 * Path no storage: embryo-videos/{lote_fiv_id}/{acasalamento_id}/{timestamp}.mp4
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { detectEmbryoCircles, isOpenCVAvailable, loadOpenCV } from '@/lib/embryoscore/detectCircles';
import type { DetectedBbox } from '@/lib/types';

interface UploadState {
  uploading: boolean;
  progress: number;
  error: string | null;
  mediaId: string | null;
  detecting: boolean;
  detectedBboxes: DetectedBbox[] | null;
  detectionConfidence: 'high' | 'medium' | 'low' | null;
}

export interface UploadResult {
  mediaId: string;
  arquivoUrl: string;
  detectedBboxes: DetectedBbox[] | null;
  detectionConfidence: 'high' | 'medium' | 'low' | null;
  cropPaths: string[] | null;
  /** Canvas com o frame usado para detecção (para preview) */
  frameCanvas: HTMLCanvasElement | null;
}

const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'];
const MAX_SIZE_BYTES = 500 * 1024 * 1024; // 500MB

export function useEmbryoVideoUpload() {
  const [state, setState] = useState<UploadState>({
    uploading: false,
    progress: 0,
    error: null,
    mediaId: null,
    detecting: false,
    detectedBboxes: null,
    detectionConfidence: null,
  });

  const validateFile = useCallback((file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `Formato não suportado: ${file.type}. Use MP4, MOV ou WebM.`;
    }
    if (file.size > MAX_SIZE_BYTES) {
      return `Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(0)}MB). Máximo: 500MB.`;
    }
    return null;
  }, []);

  const getVideoDuration = useCallback((file: File): Promise<number> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        resolve(Math.round(video.duration));
      };
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        resolve(0);
      };
      video.src = URL.createObjectURL(file);
    });
  }, []);

  const upload = useCallback(async (
    file: File,
    loteFivId: string,
    acasalamentoId: string,
    expectedCount?: number,
  ): Promise<UploadResult | null> => {
    // Validar
    const validationError = validateFile(file);
    if (validationError) {
      setState(prev => ({ ...prev, error: validationError }));
      return null;
    }

    setState({
      uploading: true, progress: 10, error: null, mediaId: null,
      detecting: false, detectedBboxes: null, detectionConfidence: null,
    });

    try {
      // Obter duração do vídeo
      const duracao = await getVideoDuration(file);
      setState(prev => ({ ...prev, progress: 20 }));

      // Upload para Storage
      const timestamp = Date.now();
      const ext = file.name.split('.').pop() || 'mp4';
      const storagePath = `${loteFivId}/${acasalamentoId}/${timestamp}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('embryo-videos')
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) throw new Error(`Erro no upload: ${uploadError.message}`);
      setState(prev => ({ ...prev, progress: 70 }));

      // ── Detecção de círculos via OpenCV.js (não-bloqueante) ──
      let detectedBboxes: DetectedBbox[] | null = null;
      let detectionConfidence: 'high' | 'medium' | 'low' | null = null;
      let cropPaths: string[] | null = null;
      let frameCanvas: HTMLCanvasElement | null = null;

      // Tentar carregar OpenCV sob demanda se não estiver disponível
      if (!isOpenCVAvailable()) {
        try { await loadOpenCV(15_000); } catch { /* não-bloqueante */ }
      }

      if (isOpenCVAvailable()) {
        try {
          setState(prev => ({ ...prev, detecting: true, progress: 72 }));
          // Detecção guiada pela contagem esperada (NMS + clustering)
          const detection = await detectEmbryoCircles(file, 20, expectedCount);
          detectedBboxes = detection.bboxes;
          detectionConfidence = detection.confidence;
          frameCanvas = detection.frameCanvas;
          console.log(
            `[EmbryoScore] Detecção OpenCV: ${detection.totalCirclesFound} círculos encontrados,` +
            ` ${detection.bboxes.length} retornados, frame ${detection.frameWidth}x${detection.frameHeight}`
          );

          // Upload dos crops JPEG para Storage (paralelo)
          if (detection.cropBlobs.length > 0) {
            setState(prev => ({ ...prev, progress: 75 }));
            const cropTimestamp = Date.now();
            const uploadedPaths = await Promise.all(
              detection.cropBlobs.map(async (blob, i) => {
                const cropPath = `${loteFivId}/${acasalamentoId}/crops/${cropTimestamp}_${i}.jpg`;
                const { error: cropErr } = await supabase.storage
                  .from('embryo-videos')
                  .upload(cropPath, blob, { contentType: 'image/jpeg', upsert: false });
                if (cropErr) {
                  console.warn(`[EmbryoScore] Crop ${i} upload falhou:`, cropErr.message);
                  return null;
                }
                return cropPath;
              })
            );
            // Só retorna paths se todos foram uploaded com sucesso
            const validPaths = uploadedPaths.filter((p): p is string => p !== null);
            if (validPaths.length === detection.cropBlobs.length) {
              cropPaths = validPaths;
              console.log(`[EmbryoScore] ${validPaths.length} crops uploaded`);
            } else {
              console.warn(`[EmbryoScore] Apenas ${validPaths.length}/${detection.cropBlobs.length} crops uploaded`);
              cropPaths = validPaths.length > 0 ? validPaths : null;
            }
          }
        } catch (detectionErr) {
          // Detecção falhou — não bloqueia upload
          console.warn('[EmbryoScore] Detecção de círculos falhou (não-bloqueante):', detectionErr);
        } finally {
          setState(prev => ({ ...prev, detecting: false }));
        }
      } else {
        console.info('[EmbryoScore] OpenCV.js não disponível — detecção de círculos ignorada');
      }

      setState(prev => ({ ...prev, progress: 80 }));

      // Obter URL pública (signed URL 1 ano)
      const { data: urlData } = await supabase.storage
        .from('embryo-videos')
        .createSignedUrl(storagePath, 365 * 24 * 60 * 60);

      const arquivoUrl = urlData?.signedUrl || '';

      // Criar registro na tabela acasalamento_embrioes_media
      const { data: mediaData, error: mediaError } = await supabase
        .from('acasalamento_embrioes_media')
        .insert({
          lote_fiv_acasalamento_id: acasalamentoId,
          tipo_media: 'VIDEO',
          arquivo_url: arquivoUrl,
          arquivo_path: storagePath,
          arquivo_nome: file.name,
          arquivo_tamanho: file.size,
          mime_type: file.type,
          duracao_segundos: duracao || null,
        })
        .select('id')
        .single();

      if (mediaError) {
        console.error('EmbryoVideoUpload: insert falhou:', mediaError.code, mediaError.message, mediaError.details, mediaError.hint);
        throw new Error(`Erro ao salvar registro: ${mediaError.message}`);
      }

      if (!mediaData?.id) {
        throw new Error('Registro de mídia não retornou ID — verifique as policies RLS da tabela acasalamento_embrioes_media.');
      }

      // Verificar que o registro foi realmente persistido
      const { data: checkData, error: checkError } = await supabase
        .from('acasalamento_embrioes_media')
        .select('id')
        .eq('id', mediaData.id)
        .maybeSingle();

      if (checkError || !checkData) {
        console.error('EmbryoVideoUpload: registro não encontrado após insert!', checkError);
        throw new Error('O registro de mídia foi criado mas não pôde ser lido. Verifique as policies RLS.');
      }

      const mediaId = mediaData.id;
      setState({
        uploading: false, progress: 100, error: null, mediaId,
        detecting: false, detectedBboxes, detectionConfidence,
      });

      return { mediaId, arquivoUrl, detectedBboxes, detectionConfidence, cropPaths, frameCanvas };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido no upload';
      setState({
        uploading: false, progress: 0, error: errorMsg, mediaId: null,
        detecting: false, detectedBboxes: null, detectionConfidence: null,
      });
      return null;
    }
  }, [validateFile, getVideoDuration]);

  const reset = useCallback(() => {
    setState({
      uploading: false, progress: 0, error: null, mediaId: null,
      detecting: false, detectedBboxes: null, detectionConfidence: null,
    });
  }, []);

  return {
    ...state,
    upload,
    reset,
  };
}
