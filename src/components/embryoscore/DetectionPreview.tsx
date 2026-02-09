/**
 * Preview de detecção de embriões antes de enviar para análise.
 * Mobile-first: fullscreen sheet em mobile, dialog em desktop.
 *
 * Funcionalidades:
 * - Visualiza bboxes detectadas sobre o frame do vídeo
 * - Permite REMOVER bboxes incorretas (botão X)
 * - Permite ADICIONAR bboxes manualmente (toque/clique no canvas)
 * - Mostra comparação detectado vs esperado
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Check, RotateCcw, Circle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DetectedBbox } from '@/lib/types';

interface DetectionPreviewProps {
  /** Canvas com o frame do vídeo */
  frameCanvas: HTMLCanvasElement;
  /** Bboxes detectadas pelo OpenCV */
  bboxes: DetectedBbox[];
  /** Contagem esperada de embriões (do banco) */
  expectedCount?: number;
  /** Callback quando o usuário confirma */
  onConfirm: (confirmedBboxes: DetectedBbox[]) => void;
  /** Callback quando o usuário cancela */
  onCancel: () => void;
  /** Callback para redetectar */
  onRedetect?: () => void;
}

const CONFIDENCE_COLORS = {
  high: { stroke: '#22c55e', bg: 'bg-green-500/15', text: 'text-green-600 dark:text-green-400' },
  medium: { stroke: '#eab308', bg: 'bg-yellow-500/15', text: 'text-yellow-600 dark:text-yellow-400' },
  low: { stroke: '#ef4444', bg: 'bg-red-500/15', text: 'text-red-600 dark:text-red-400' },
  manual: { stroke: '#3b82f6', bg: 'bg-blue-500/15', text: 'text-blue-600 dark:text-blue-400' },
};

export function DetectionPreview({
  frameCanvas,
  bboxes: initialBboxes,
  expectedCount,
  onConfirm,
  onCancel,
  onRedetect,
}: DetectionPreviewProps) {
  const [bboxes, setBboxes] = useState(initialBboxes);
  const [addMode, setAddMode] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scaleRef = useRef(1);

  const removeBbox = (index: number) => {
    setBboxes(prev => prev.filter((_, i) => i !== index));
  };

  // Adicionar bbox manualmente via clique no canvas
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!addMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Converter de coordenadas do canvas (escalado) para percentuais do frame original
    const xPercent = (clickX / canvas.width) * 100;
    const yPercent = (clickY / canvas.height) * 100;

    // Calcular raio: usar mediana dos bboxes existentes, ou 8% do frame se nenhuma
    let radiusPx: number;
    if (bboxes.length > 0) {
      const radii = bboxes.map(b => b.radius_px).sort((a, b) => a - b);
      radiusPx = radii[Math.floor(radii.length / 2)];
    } else {
      radiusPx = Math.min(frameCanvas.width, frameCanvas.height) * 0.08;
    }

    const diameter = radiusPx * 2;
    const widthPercent = (diameter / frameCanvas.width) * 100;
    const heightPercent = (diameter / frameCanvas.height) * 100;

    const newBbox: DetectedBbox = {
      x_percent: xPercent,
      y_percent: yPercent,
      width_percent: widthPercent,
      height_percent: heightPercent,
      radius_px: radiusPx,
      per_bbox_confidence: 'medium',
      detection_count: 0, // 0 = manual
    };

    setBboxes(prev => [...prev, newBbox]);
    setAddMode(false);
  }, [addMode, bboxes, frameCanvas]);

  // Draw annotated frame
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const fw = frameCanvas.width;
    const fh = frameCanvas.height;

    // Scale to fit container
    const maxW = Math.min(window.innerWidth - 32, 800);
    const scale = maxW / fw;
    scaleRef.current = scale;
    canvas.width = fw * scale;
    canvas.height = fh * scale;

    ctx.drawImage(frameCanvas, 0, 0, canvas.width, canvas.height);

    // Draw bboxes
    bboxes.forEach((bbox, i) => {
      const cx = (bbox.x_percent / 100) * canvas.width;
      const cy = (bbox.y_percent / 100) * canvas.height;
      const w = (bbox.width_percent / 100) * canvas.width;
      const h = (bbox.height_percent / 100) * canvas.height;

      const isManual = bbox.detection_count === 0;
      const confidence = isManual ? 'manual' : 'medium';
      const color = CONFIDENCE_COLORS[confidence as keyof typeof CONFIDENCE_COLORS]?.stroke || '#eab308';

      // Desenhar retângulo ao redor do embrião
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);

      // Number label com fundo
      const label = `${i + 1}`;
      ctx.font = `bold ${Math.max(14, canvas.width * 0.025)}px sans-serif`;
      const textMetrics = ctx.measureText(label);
      const textW = textMetrics.width + 8;
      const textH = Math.max(16, canvas.width * 0.03) + 4;
      const labelX = cx - w / 2;
      const labelY = cy - h / 2 - textH - 2;

      ctx.fillStyle = color;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.roundRect(labelX, labelY, textW, textH, 4);
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, labelX + 4, labelY + textH - 5);
    });

    // Cursor crosshair no modo adicionar
    canvas.style.cursor = addMode ? 'crosshair' : 'default';
  }, [bboxes, frameCanvas, addMode]);

  const countDiff = expectedCount != null ? bboxes.length - expectedCount : null;
  const needsMore = expectedCount != null && bboxes.length < expectedCount;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-sm font-semibold">Preview da Detecção</h2>
            <p className="text-xs text-muted-foreground">
              {bboxes.length} embrião(ões) detectado(s)
              {expectedCount != null && (
                <span className={countDiff !== 0 ? ' text-amber-500 font-medium' : ' text-green-500 font-medium'}>
                  {' '}(esperado: {expectedCount})
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {onRedetect && (
            <button
              onClick={onRedetect}
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-muted"
              title="Redetectar"
            >
              <RotateCcw className="w-5 h-5 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto p-4 flex flex-col items-center justify-center gap-3">
        {addMode && (
          <div className="px-4 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-xs font-medium animate-pulse">
            Toque no embrião para adicionar bbox
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="rounded-lg shadow-lg max-w-full max-h-[55vh]"
          onClick={handleCanvasClick}
        />
      </div>

      {/* Bbox list + add button */}
      <div className="px-4 pb-2">
        <div className="flex flex-wrap gap-2 items-center">
          {bboxes.map((bbox, i) => {
            const isManual = bbox.detection_count === 0;
            const confidence = isManual ? 'manual' : 'medium';
            const colors = CONFIDENCE_COLORS[confidence as keyof typeof CONFIDENCE_COLORS] || CONFIDENCE_COLORS.medium;
            return (
              <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border ${colors.bg}`}>
                <Circle className={`w-3 h-3 ${colors.text}`} />
                <span className="text-xs font-medium">#{i + 1}</span>
                {isManual && (
                  <span className="text-[10px] text-blue-500 font-medium">manual</span>
                )}
                <button
                  onClick={() => removeBbox(i)}
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-500/20"
                  title="Remover"
                >
                  <X className="w-3.5 h-3.5 text-red-500" />
                </button>
              </div>
            );
          })}

          {/* Botão de adicionar bbox manual */}
          <button
            onClick={() => setAddMode(!addMode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed transition-colors ${
              addMode
                ? 'border-blue-500 bg-blue-500/15 text-blue-600 dark:text-blue-400'
                : 'border-muted-foreground/30 hover:border-primary/50 hover:bg-primary/5 text-muted-foreground'
            }`}
            title="Adicionar embrião manualmente"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Adicionar</span>
          </button>
        </div>
        {needsMore && (
          <p className="text-[10px] text-amber-500 mt-1.5">
            Faltam {expectedCount! - bboxes.length} embrião(ões). Use o botão "Adicionar" para marcar manualmente.
          </p>
        )}
      </div>

      {/* Footer actions */}
      <div className="px-4 py-3 border-t border-border bg-card flex gap-3">
        <Button
          variant="outline"
          className="flex-1 h-12"
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button
          className="flex-1 h-12 bg-primary hover:bg-primary/90"
          onClick={() => onConfirm(bboxes)}
          disabled={bboxes.length === 0}
        >
          <Check className="w-4 h-4 mr-2" />
          Confirmar ({bboxes.length})
        </Button>
      </div>
    </div>
  );
}
