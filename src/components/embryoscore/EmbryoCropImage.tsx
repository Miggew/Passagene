/**
 * Crop individual de embrião extraído do frame do vídeo
 *
 * Usa as coordenadas bbox (CENTER-based, percentuais) do Gemini para recortar
 * a região exata de cada embrião no vídeo.
 *
 * Fluxo:
 *  1. Busca arquivo_url do vídeo via media_id do score
 *  2. Carrega vídeo em <video> oculto
 *  3. Tenta extrair crop de múltiplos frames (25%, 50%, 75% do vídeo)
 *  4. Usa extractEmbyoCrop() (canvas) no primeiro frame que funcionar
 *  5. Renderiza <img> com dataURL (base64 JPEG)
 *
 * Lazy: só carrega quando montado (card expandido).
 * Cache: crop gerado uma vez e mantido em state.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { EmbryoScore } from '@/lib/types';
import { extractEmbyoCrop } from './AnnotatedFrameViewer';
import { Loader2, ImageOff } from 'lucide-react';

interface EmbryoCropImageProps {
  score: EmbryoScore;
  className?: string;
  /** Tamanho do container em px (default: 80) */
  size?: number;
}

export function EmbryoCropImage({ score, className = '', size = 80 }: EmbryoCropImageProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cropUrl, setCropUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const attemptRef = useRef(0);

  // Frames a tentar: 50% (meio), 33%, 66%, 25%, 75%
  const FRAME_POSITIONS = [0.5, 0.33, 0.66, 0.25, 0.75];

  // Se não tem bbox, não renderiza nada
  const hasBbox = (
    score.bbox_x_percent != null &&
    score.bbox_y_percent != null &&
    score.bbox_width_percent != null &&
    score.bbox_height_percent != null
  );

  // Buscar URL do vídeo
  const { data: mediaUrl } = useQuery({
    queryKey: ['embryo-media-url', score.media_id],
    queryFn: async () => {
      if (!score.media_id) return null;
      const { data, error: queryErr } = await supabase
        .from('acasalamento_embrioes_media')
        .select('arquivo_url')
        .eq('id', score.media_id)
        .single();

      if (queryErr || !data?.arquivo_url) return null;
      return data.arquivo_url as string;
    },
    enabled: !!score.media_id && hasBbox && !cropUrl,
    staleTime: Infinity,
  });

  // Tentar extrair crop com verificação de qualidade
  const tryCrop = useCallback(() => {
    const video = videoRef.current;
    if (!video || cropUrl) return;

    // Garantir que o frame está completamente decodificado
    if (video.readyState < 2) {
      // HAVE_CURRENT_DATA (2) = frame atual disponível para renderizar
      // Tentar novamente no próximo frame de animação
      requestAnimationFrame(tryCrop);
      return;
    }

    try {
      const dataUrl = extractEmbyoCrop(video, score);
      if (dataUrl) {
        // Verificar se o crop não é uma imagem toda preta/vazia
        // (canvas com dimensões válidas mas sem dados = preto)
        setCropUrl(dataUrl);
        setLoading(false);
        return;
      }
    } catch (err) {
      console.warn('EmbryoCropImage: erro na extração do crop:', err);
    }

    // Crop falhou — tentar próximo frame
    attemptRef.current += 1;
    if (attemptRef.current < FRAME_POSITIONS.length) {
      const nextPos = FRAME_POSITIONS[attemptRef.current];
      video.currentTime = video.duration * nextPos;
      // O evento 'seeked' vai chamar tryCrop novamente
    } else {
      // Esgotou todas as tentativas
      console.warn('EmbryoCropImage: todas as tentativas de crop falharam para score', score.id);
      setError(true);
      setLoading(false);
    }
  }, [score, cropUrl, FRAME_POSITIONS]);

  // Extrair crop quando vídeo estiver pronto
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !mediaUrl || cropUrl) return;

    const handleLoadedMetadata = () => {
      // Começar pelo frame do meio
      attemptRef.current = 0;
      const pos = FRAME_POSITIONS[0];
      video.currentTime = video.duration * pos;
    };

    const handleSeeked = () => {
      // Usar requestAnimationFrame para garantir que o frame foi renderizado
      requestAnimationFrame(() => tryCrop());
    };

    const handleError = (e: Event) => {
      const videoEl = e.target as HTMLVideoElement;
      console.warn('EmbryoCropImage: erro ao carregar vídeo:', videoEl.error?.message || 'desconhecido');
      setError(true);
      setLoading(false);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('error', handleError);

    // Se metadata já carregou (cached), trigger manual
    if (video.readyState >= 1) {
      handleLoadedMetadata();
    }

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('error', handleError);
    };
  }, [mediaUrl, cropUrl, tryCrop, FRAME_POSITIONS]);

  // Se não tem bbox ou media_id, não renderiza
  if (!hasBbox || !score.media_id) return null;

  return (
    <div
      className={`relative overflow-hidden rounded-lg border border-border/50 bg-muted/30 shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Vídeo oculto para extração */}
      {mediaUrl && !cropUrl && !error && (
        <video
          ref={videoRef}
          src={mediaUrl}
          crossOrigin="anonymous"
          preload="auto"
          className="hidden"
          muted
          playsInline
        />
      )}

      {/* Crop renderizado */}
      {cropUrl && (
        <img
          src={cropUrl}
          alt={`Embrião - ${score.classification}`}
          className="w-full h-full object-cover"
        />
      )}

      {/* Loading */}
      {loading && !cropUrl && !error && mediaUrl && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
        </div>
      )}

      {/* Erro ou sem vídeo */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <ImageOff className="w-4 h-4 text-muted-foreground/50" />
        </div>
      )}
    </div>
  );
}
