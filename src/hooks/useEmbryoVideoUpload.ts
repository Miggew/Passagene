/**
 * Hook para upload de vídeos de embriões para Supabase Storage
 *
 * Responsabilidades:
 * 1. Upload do vídeo para bucket embryo-videos
 * 2. Criar registro em acasalamento_embrioes_media
 * 3. Retornar estado de upload (progress, error, mediaId)
 *
 * Detecção de embriões agora é feita server-side pela Edge Function embryo-analyze.
 *
 * Path no storage: embryo-videos/{lote_fiv_id}/{acasalamento_id}/{timestamp}.mp4
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface UploadState {
  uploading: boolean;
  progress: number;
  error: string | null;
  mediaId: string | null;
}

export interface UploadResult {
  mediaId: string;
  arquivoUrl: string;
}

const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'];
const MAX_SIZE_BYTES = 500 * 1024 * 1024; // 500MB

export function useEmbryoVideoUpload() {
  const [state, setState] = useState<UploadState>({
    uploading: false,
    progress: 0,
    error: null,
    mediaId: null,
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
  ): Promise<UploadResult | null> => {
    // Validar
    const validationError = validateFile(file);
    if (validationError) {
      setState(prev => ({ ...prev, error: validationError }));
      return null;
    }

    setState({ uploading: true, progress: 10, error: null, mediaId: null });

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

      if (uploadError) {
        console.error('Storage upload error:', uploadError.message, 'statusCode:', (uploadError as unknown as { statusCode?: string }).statusCode, 'error:', uploadError);
        throw new Error(`Erro no upload: ${uploadError.message}`);
      }
      setState(prev => ({ ...prev, progress: 70 }));

      // Obter URL pública (signed URL 1 ano)
      const { data: urlData } = await supabase.storage
        .from('embryo-videos')
        .createSignedUrl(storagePath, 365 * 24 * 60 * 60);

      const arquivoUrl = urlData?.signedUrl || '';

      setState(prev => ({ ...prev, progress: 80 }));

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
      setState({ uploading: false, progress: 100, error: null, mediaId });

      return { mediaId, arquivoUrl };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido no upload';
      setState({ uploading: false, progress: 0, error: errorMsg, mediaId: null });
      return null;
    }
  }, [validateFile, getVideoDuration]);

  const reset = useCallback(() => {
    setState({ uploading: false, progress: 0, error: null, mediaId: null });
  }, []);

  return {
    ...state,
    upload,
    reset,
  };
}
