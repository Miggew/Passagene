/**
 * Crop anotado do embrião alvo com bounding box.
 *
 * Recorta a região ao redor do embrião e desenha apenas o bbox dele
 * com label de score. Sem bboxes de outros embriões.
 *
 * Resultado: imagem quase-quadrada ~200px que cabe ao lado do reasoning.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { EmbryoScore } from '@/lib/types';
import { getScoreColor } from './EmbryoScoreBadge';
import { Loader2, ImageOff } from 'lucide-react';

interface EmbryoHighlightFrameProps {
  /** Score do embrião atual */
  score: EmbryoScore;
  /** @deprecated Não utilizado — apenas o embrião alvo é desenhado */
  allScores?: EmbryoScore[];
  className?: string;
}

const DOT_TO_HEX: Record<string, string> = {
  'bg-emerald-500': '#10b981',
  'bg-green-500': '#22c55e',
  'bg-amber-500': '#f59e0b',
  'bg-orange-500': '#f97316',
  'bg-red-500': '#ef4444',
};

function getHexColor(embryoScore: number): string {
  const colors = getScoreColor(embryoScore);
  return DOT_TO_HEX[colors.dot] || '#22c55e';
}

export function EmbryoHighlightFrame({ score, className = '' }: EmbryoHighlightFrameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const attemptRef = useRef(0);

  const FRAME_POSITIONS = [0.5, 0.33, 0.66, 0.25, 0.75];

  const hasBbox = (
    score.bbox_x_percent != null &&
    score.bbox_y_percent != null &&
    score.bbox_width_percent != null &&
    score.bbox_height_percent != null
  );

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
    enabled: !!score.media_id && hasBbox && !frameUrl,
    staleTime: Infinity,
  });

  // Desenhar crop ao redor do embrião com bbox anotada
  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || frameUrl) return;

    if (video.readyState < 2) {
      requestAnimationFrame(drawFrame);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (vw === 0 || vh === 0) return;

    // ── Região de crop ao redor do embrião ──
    const centerX = (score.bbox_x_percent! / 100) * vw;
    const centerY = (score.bbox_y_percent! / 100) * vh;
    const bboxW = (score.bbox_width_percent! / 100) * vw;
    const bboxH = (score.bbox_height_percent! / 100) * vh;

    // Margem: 100% da bbox em cada lado
    const cropSize = Math.max(bboxW, bboxH) * 3;

    let cropLeft = centerX - cropSize / 2;
    let cropTop = centerY - cropSize / 2;
    let cropRight = centerX + cropSize / 2;
    let cropBottom = centerY + cropSize / 2;

    // Clampar nas bordas
    if (cropLeft < 0) { cropRight -= cropLeft; cropLeft = 0; }
    if (cropTop < 0) { cropBottom -= cropTop; cropTop = 0; }
    if (cropRight > vw) { cropLeft -= (cropRight - vw); cropRight = vw; }
    if (cropBottom > vh) { cropTop -= (cropBottom - vh); cropBottom = vh; }
    cropLeft = Math.max(0, cropLeft);
    cropTop = Math.max(0, cropTop);
    cropRight = Math.min(vw, cropRight);
    cropBottom = Math.min(vh, cropBottom);

    const cropW = cropRight - cropLeft;
    const cropH = cropBottom - cropTop;
    if (cropW < 20 || cropH < 20) return;

    // Saída: 400px para boa resolução
    const outputSize = Math.min(400, Math.max(cropW, cropH));
    const scaleX = outputSize / cropW;
    const scaleY = outputSize / cropH;

    canvas.width = Math.round(cropW * scaleX);
    canvas.height = Math.round(cropH * scaleY);

    // 1. Desenhar crop
    ctx.drawImage(video, cropLeft, cropTop, cropW, cropH, 0, 0, canvas.width, canvas.height);

    // 2. Overlay sutil
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 3. Bbox do embrião alvo
    const x = (centerX - bboxW / 2 - cropLeft) * scaleX;
    const y = (centerY - bboxH / 2 - cropTop) * scaleY;
    const w = bboxW * scaleX;
    const h = bboxH * scaleY;

    const hexColor = getHexColor(score.embryo_score);
    const fontSize = Math.max(11, Math.round(canvas.width / 25));
    const labelH = fontSize + 6;

    ctx.save();

    // Glow + borda
    ctx.shadowColor = hexColor;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = hexColor;
    ctx.lineWidth = 2.5;

    const radius = Math.min(4, w * 0.03, h * 0.03);
    roundRect(ctx, x, y, w, h, radius);
    ctx.stroke();

    // Label com score
    ctx.shadowBlur = 0;
    const label = `${Math.round(score.embryo_score)}`;
    ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`;
    const textMetrics = ctx.measureText(label);
    const labelW = textMetrics.width + 8;
    const labelY = Math.max(labelH, y - 2);

    ctx.fillStyle = hexColor;
    roundRect(ctx, x, labelY - labelH, labelW, labelH, 3);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, x + 4, labelY - 4);

    ctx.restore();

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setFrameUrl(dataUrl);
    setLoading(false);
  }, [score, frameUrl]);

  const tryNextFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || frameUrl) return;

    attemptRef.current += 1;
    if (attemptRef.current < FRAME_POSITIONS.length) {
      video.currentTime = video.duration * FRAME_POSITIONS[attemptRef.current];
    } else {
      setError(true);
      setLoading(false);
    }
  }, [frameUrl, FRAME_POSITIONS]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !mediaUrl || frameUrl) return;

    const handleLoadedMetadata = () => {
      attemptRef.current = 0;
      video.currentTime = video.duration * FRAME_POSITIONS[0];
    };

    const handleSeeked = () => {
      requestAnimationFrame(() => {
        try {
          drawFrame();
        } catch {
          tryNextFrame();
        }
      });
    };

    const handleError = () => {
      setError(true);
      setLoading(false);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('error', handleError);

    if (video.readyState >= 1) {
      handleLoadedMetadata();
    }

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('error', handleError);
    };
  }, [mediaUrl, frameUrl, drawFrame, tryNextFrame, FRAME_POSITIONS]);

  if (!hasBbox || !score.media_id) return null;

  return (
    <div className={`relative overflow-hidden rounded-lg border border-border/50 bg-muted/30 shrink-0 ${className}`}
      style={{ width: 200, height: 200 }}
    >
      {mediaUrl && !frameUrl && !error && (
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

      <canvas ref={canvasRef} className="hidden" />

      {frameUrl && (
        <img
          src={frameUrl}
          alt={`Embrião — ${score.classification} (Score ${Math.round(score.embryo_score)})`}
          className="w-full h-full object-cover"
        />
      )}

      {loading && !frameUrl && !error && mediaUrl && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <ImageOff className="w-4 h-4 text-muted-foreground/40" />
        </div>
      )}
    </div>
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
