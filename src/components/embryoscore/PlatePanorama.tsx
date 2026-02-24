/**
 * PlatePanorama — Canvas interativo do frame da placa com embriões numerados.
 *
 * Estados visuais:
 *   - Pendente (○): borda branca 50% opacidade
 *   - Classificado (✓): preenchido primary-subtle, borda primary
 *   - Selecionado (▶): preenchido primary, borda primary-dark, pulso animado
 *
 * Clicar em um embrião chama onSelect(index).
 */

import { useRef, useEffect, useCallback } from 'react';
import { Map } from 'lucide-react';
import type { DetectedBbox } from '@/lib/types';

type EmbryoStatus = 'pending' | 'classified' | 'active';

interface PlatePanoramaProps {
  plateFrameUrl: string | null | undefined;
  bboxes: DetectedBbox[];
  /** Status de cada embrião (índice corresponde ao bbox) */
  statuses: EmbryoStatus[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

const MARKER_RADIUS = 18;

export function PlatePanorama({
  plateFrameUrl,
  bboxes,
  statuses,
  activeIndex,
  onSelect,
}: PlatePanoramaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const animFrameRef = useRef<number>(0);

  const draw = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img || !img.complete) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Draw plate frame
    ctx.drawImage(img, 0, 0, w, h);

    // Draw each embryo marker
    bboxes.forEach((bbox, i) => {
      const cx = (bbox.x_percent / 100) * w;
      const cy = (bbox.y_percent / 100) * h;
      const status = statuses[i] || 'pending';
      const isActive = i === activeIndex;

      ctx.beginPath();

      if (isActive) {
        // Animated pulse ring
        const pulse = Math.sin(timestamp / 300) * 0.3 + 0.7;
        const pulseRadius = MARKER_RADIUS + 6 * pulse;
        ctx.arc(cx, cy, pulseRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(52, 211, 153, ${0.4 * pulse})`;
        ctx.lineWidth = 2;
        ctx.stroke();

        // solid circle
        ctx.beginPath();
        ctx.arc(cx, cy, MARKER_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = '#34D399'; // --green
        ctx.fill();
        ctx.strokeStyle = '#047857'; // emerald-700
        ctx.lineWidth = 2.5;
        // Organic Glow na borda
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#34D399';
        ctx.stroke();
        ctx.shadowBlur = 0; // reset

        // Number (white, bold)
        ctx.fillStyle = '#022c22';
        ctx.font = 'bold 13px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${i + 1}`, cx, cy);
      } else if (status === 'classified') {
        // Filled with subtle primary
        ctx.arc(cx, cy, MARKER_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(52, 211, 153, 0.25)';
        ctx.fill();
        ctx.strokeStyle = '#34D399';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Checkmark
        ctx.fillStyle = '#34D399';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✓', cx, cy);
      } else {
        // Pending — outlined
        ctx.arc(cx, cy, MARKER_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Number (dim)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '12px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${i + 1}`, cx, cy);
      }
    });

    // Continue animation only if there's an active embryo
    if (activeIndex >= 0) {
      animFrameRef.current = requestAnimationFrame(draw);
    }
  }, [bboxes, statuses, activeIndex]);

  // Load image and start drawing
  useEffect(() => {
    if (!plateFrameUrl) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      const canvas = canvasRef.current;
      if (canvas) {
        // Set canvas size proportional to image (max 800px wide for desktop)
        const aspect = img.height / img.width;
        const w = Math.min(800, img.width);
        canvas.width = w;
        canvas.height = w * aspect;
      }
      animFrameRef.current = requestAnimationFrame(draw);
    };
    img.src = plateFrameUrl;

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [plateFrameUrl, draw]);

  // Restart animation when deps change
  useEffect(() => {
    if (imageRef.current?.complete) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = requestAnimationFrame(draw);
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [draw]);

  // Handle clicks
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    // Find closest embryo within MARKER_RADIUS
    let closestIdx = -1;
    let closestDist = Infinity;

    bboxes.forEach((bbox, i) => {
      const cx = (bbox.x_percent / 100) * canvas.width;
      const cy = (bbox.y_percent / 100) * canvas.height;
      const dist = Math.sqrt((clickX - cx) ** 2 + (clickY - cy) ** 2);
      if (dist < MARKER_RADIUS * 2 && dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    });

    if (closestIdx >= 0) {
      onSelect(closestIdx);
    }
  }, [bboxes, onSelect]);

  if (!plateFrameUrl) {
    return (
      <div className="rounded-xl border border-border bg-card/50 backdrop-blur-sm flex flex-col items-center justify-center h-48 text-xs font-mono uppercase tracking-widest text-muted-foreground gap-2">
        <Map className="w-6 h-6 opacity-20" />
        Frame da placa não disponível
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/50 overflow-hidden bg-black/40">
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        className="w-full cursor-pointer touch-manipulation"
        style={{ display: 'block' }}
      />
      <div className="flex items-center gap-6 px-4 py-2 bg-card/80 backdrop-blur-sm border-t border-border/30">
        <span className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground">
          <span className="inline-block w-2.5 h-2.5 rounded-full border border-white/20" /> Pendente
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-green/25 border border-green" /> Classificado
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-green border-2 border-emerald-700 glow-green shadow-[0_0_8px_rgba(52,211,153,0.3)]" /> Ativo
        </span>
      </div>
    </div>
  );
}
