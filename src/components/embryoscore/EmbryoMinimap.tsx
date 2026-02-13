/**
 * EmbryoMinimap — Canvas 120×90 read-only com marcador verde no embrião atual.
 * Mostra o frame completo da placa em miniatura com posições dos embriões.
 */

import { useRef, useEffect } from 'react';
import type { DetectedBbox } from '@/lib/types';

interface EmbryoMinimapProps {
  plateFrameUrl: string | null | undefined;
  bboxes: DetectedBbox[];
  currentIndex: number;
}

export function EmbryoMinimap({ plateFrameUrl, bboxes, currentIndex }: EmbryoMinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !plateFrameUrl) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      canvas.width = 120;
      canvas.height = 90;
      ctx.drawImage(img, 0, 0, 120, 90);

      bboxes.forEach((bbox, i) => {
        const x = (bbox.x_percent / 100) * 120;
        const y = (bbox.y_percent / 100) * 90;
        ctx.beginPath();

        if (i === currentIndex) {
          ctx.arc(x, y, 7, 0, Math.PI * 2);
          ctx.fillStyle = '#2ECC71';
          ctx.fill();
          ctx.strokeStyle = '#1E8449';
          ctx.lineWidth = 2;
        } else {
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255,255,255,0.4)';
          ctx.lineWidth = 1;
        }
        ctx.stroke();
      });
    };
    img.src = plateFrameUrl;
  }, [plateFrameUrl, bboxes, currentIndex]);

  if (!plateFrameUrl) return null;

  return (
    <canvas
      ref={canvasRef}
      className="rounded-lg border border-border"
      style={{ width: 120, height: 90 }}
    />
  );
}
