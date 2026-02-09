/**
 * Visualizador de frame anotado com bounding boxes
 *
 * Extrai um frame central do vídeo e desenha bounding boxes
 * usando coordenadas percentuais dos scores do Gemini.
 *
 * Usa <video> + <canvas> nativo (sem OpenCV).
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type { EmbryoScore } from '@/lib/types';
import { getScoreColor } from './EmbryoScoreBadge';
import { Play, Loader2 } from 'lucide-react';

interface AnnotatedFrameViewerProps {
  videoUrl: string;
  scores: EmbryoScore[];
  className?: string;
}

export function AnnotatedFrameViewer({ videoUrl, scores, className = '' }: AnnotatedFrameViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [frameReady, setFrameReady] = useState(false);

  const drawAnnotations = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Ajustar canvas ao tamanho do vídeo
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Desenhar frame do vídeo
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Desenhar bounding boxes para cada score
    scores.forEach((score, index) => {
      if (
        score.bbox_x_percent == null ||
        score.bbox_y_percent == null ||
        score.bbox_width_percent == null ||
        score.bbox_height_percent == null
      ) return;

      const x = (score.bbox_x_percent / 100) * canvas.width - ((score.bbox_width_percent / 100) * canvas.width) / 2;
      const y = (score.bbox_y_percent / 100) * canvas.height - ((score.bbox_height_percent / 100) * canvas.height) / 2;
      const w = (score.bbox_width_percent / 100) * canvas.width;
      const h = (score.bbox_height_percent / 100) * canvas.height;

      // Cor baseada no score
      const scoreColors = getScoreColor(score.embryo_score);
      const colorMap: Record<string, string> = {
        'bg-emerald-500': '#10b981',
        'bg-green-500': '#22c55e',
        'bg-amber-500': '#f59e0b',
        'bg-orange-500': '#f97316',
        'bg-red-500': '#ef4444',
      };
      const strokeColor = colorMap[scoreColors.dot] || '#22c55e';

      // Desenhar retângulo
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, w, h);

      // Label do score
      const label = `#${index + 1}  ${Math.round(score.embryo_score)}`;
      ctx.font = 'bold 14px system-ui, sans-serif';
      const textMetrics = ctx.measureText(label);
      const textH = 20;
      const textY = Math.max(textH, y - 4);

      // Fundo do label
      ctx.fillStyle = strokeColor;
      ctx.fillRect(x, textY - textH, textMetrics.width + 10, textH + 2);

      // Texto do label
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, x + 5, textY - 4);
    });

    setFrameReady(true);
    setLoading(false);
  }, [scores]);

  const extractFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    // Ir para o meio do vídeo
    video.currentTime = video.duration / 2;
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      extractFrame();
    };

    const handleSeeked = () => {
      drawAnnotations();
    };

    const handleError = () => {
      setError(true);
      setLoading(false);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('error', handleError);
    };
  }, [extractFrame, drawAnnotations]);

  if (error) {
    return (
      <div className={`flex items-center justify-center h-40 bg-muted/30 rounded-lg border border-border/50 ${className}`}>
        <span className="text-xs text-muted-foreground">Erro ao carregar vídeo</span>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-lg border border-border/50 ${className}`}>
      {/* Vídeo oculto — usado apenas para extrair frame */}
      <video
        ref={videoRef}
        src={videoUrl}
        crossOrigin="anonymous"
        preload="metadata"
        className="hidden"
        muted
      />

      {/* Canvas com frame anotado */}
      <canvas
        ref={canvasRef}
        className={`w-full h-auto ${frameReady ? '' : 'hidden'}`}
      />

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-40 bg-muted/30">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
            <span className="text-xs text-muted-foreground">Extraindo frame...</span>
          </div>
        </div>
      )}

      {/* Overlay com contagem */}
      {frameReady && scores.length > 0 && (
        <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/60 backdrop-blur-sm">
          <Play className="w-3 h-3 text-white/80" />
          <span className="text-[10px] text-white font-medium">
            {scores.length} embrião(ões) detectado(s)
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Gera crop individual de um embrião a partir do frame do vídeo.
 *
 * Coordenadas bbox são CENTER-based (percentuais 0-100):
 *   bbox_x_percent = centro X do embrião (% da largura do frame)
 *   bbox_y_percent = centro Y do embrião (% da altura do frame)
 *   bbox_width_percent = largura total do bbox (% da largura do frame)
 *   bbox_height_percent = altura total do bbox (% da altura do frame)
 *
 * Adiciona padding de 20% ao redor e clampa nas bordas do frame.
 */
export function extractEmbyoCrop(
  videoElement: HTMLVideoElement,
  score: EmbryoScore,
): string | null {
  if (
    score.bbox_x_percent == null ||
    score.bbox_y_percent == null ||
    score.bbox_width_percent == null ||
    score.bbox_height_percent == null
  ) return null;

  // Verificar que o vídeo tem dimensões válidas
  const vw = videoElement.videoWidth;
  const vh = videoElement.videoHeight;
  if (vw === 0 || vh === 0) return null;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Converter center-based percentuais para pixels (top-left origin)
  const centerX = (score.bbox_x_percent / 100) * vw;
  const centerY = (score.bbox_y_percent / 100) * vh;
  const bboxW = (score.bbox_width_percent / 100) * vw;
  const bboxH = (score.bbox_height_percent / 100) * vh;

  // Bbox sem padding (top-left)
  const rawLeft = centerX - bboxW / 2;
  const rawTop = centerY - bboxH / 2;

  // Adicionar padding de 20% em cada lado
  const padding = 0.2;
  const padX = bboxW * padding;
  const padY = bboxH * padding;

  // Calcular região desejada com padding
  const desiredLeft = rawLeft - padX;
  const desiredTop = rawTop - padY;
  const desiredRight = rawLeft + bboxW + padX;
  const desiredBottom = rawTop + bboxH + padY;

  // Clampar às bordas do frame
  const clampedLeft = Math.max(0, desiredLeft);
  const clampedTop = Math.max(0, desiredTop);
  const clampedRight = Math.min(vw, desiredRight);
  const clampedBottom = Math.min(vh, desiredBottom);

  // Dimensões finais
  const cropW = clampedRight - clampedLeft;
  const cropH = clampedBottom - clampedTop;

  // Verificar que o crop tem tamanho válido
  if (cropW < 10 || cropH < 10) return null;

  canvas.width = cropW;
  canvas.height = cropH;
  ctx.drawImage(videoElement, clampedLeft, clampedTop, cropW, cropH, 0, 0, cropW, cropH);

  return canvas.toDataURL('image/jpeg', 0.92);
}
