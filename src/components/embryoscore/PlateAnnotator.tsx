/**
 * PlateAnnotator — Fullscreen touch-to-classify for mobile microscope workflow.
 *
 * Displays a video frame in fullscreen landscape with pinch-to-zoom. Biologist
 * taps embryos to mark them, classifies via floating popup, and saves.
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { Undo2, Save, Loader2, Check, AlertTriangle, Clock, ArrowRight, ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useQuickClassify } from '@/hooks/useQuickClassify';
import { useJobStatus, formatElapsed } from '@/hooks/useJobStatus';
import { CLASSES } from '@/components/embryoscore/BiologistClassButtons';
import type { ClassificacaoEmbriao } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

const RADIUS_SIZES = [4, 6, 8];
const DEFAULT_RADIUS_IDX = 0;

const CLASS_COLORS: Record<string, string> = {
  BE: '#22c55e', BN: '#3b82f6', BX: '#f59e0b',
  BL: '#8b5cf6', BI: '#ec4899', Mo: '#06b6d4', Dg: '#ef4444',
};

// ─── Pre-warm Cloud Run (free — pings /health to eliminate cold start) ───

const PIPELINE_URL = 'https://embryoscore-pipeline-63493118456.us-central1.run.app';

function usePrewarm() {
  useEffect(() => {
    fetch(`${PIPELINE_URL}/health`, { mode: 'no-cors' }).catch(() => {});
  }, []);
}

// ─── Fullscreen + landscape lock ─────────────────────────

function useFullscreenLandscape() {
  const [isPortrait, setIsPortrait] = useState(false);
  const [dismissedHint, setDismissedHint] = useState(false);

  useEffect(() => {
    const el = document.documentElement;
    el.requestFullscreen?.().catch(() => {});
    (screen.orientation as any)?.lock?.('landscape').catch(() => {});

    const check = () => setIsPortrait(window.innerHeight > window.innerWidth);
    check();
    window.addEventListener('resize', check);

    return () => {
      document.exitFullscreen?.().catch(() => {});
      (screen.orientation as any)?.unlock?.();
      window.removeEventListener('resize', check);
    };
  }, []);

  return { isPortrait, dismissedHint, setDismissedHint };
}

// ─── Gemini Results (fetched when job completes) ─────────

interface GeminiResult {
  embriao_id: string;
  identificacao: string | null;
  classificacao: string | null;
  gemini_classification: string | null;
  gemini_reasoning: string | null;
  biologist_classification: string | null;
}

function useGeminiResults(queueId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['gemini-results', queueId],
    enabled,
    queryFn: async (): Promise<GeminiResult[]> => {
      const { data: embryos } = await supabase
        .from('embrioes')
        .select('id, identificacao, classificacao')
        .eq('queue_id', queueId)
        .order('id');
      if (!embryos?.length) return [];

      const ids = embryos.map((e) => e.id);
      const { data: scores } = await supabase
        .from('embryo_scores')
        .select('embriao_id, gemini_classification, gemini_reasoning, biologist_classification')
        .in('embriao_id', ids)
        .eq('is_current', true);

      const scoreMap = new Map((scores || []).map((s) => [s.embriao_id, s]));

      return embryos.map((e) => ({
        embriao_id: e.id,
        identificacao: e.identificacao,
        classificacao: e.classificacao,
        gemini_classification: scoreMap.get(e.id)?.gemini_classification || null,
        gemini_reasoning: scoreMap.get(e.id)?.gemini_reasoning || null,
        biologist_classification: scoreMap.get(e.id)?.biologist_classification || null,
      }));
    },
  });
}

// ─── Status Panel (after save) ───────────────────────────

function JobStatusPanel({ queueId }: { queueId: string }) {
  const navigate = useNavigate();
  const { data: job, isLoading } = useJobStatus(queueId);
  const [elapsed, setElapsed] = useState(0);
  const status = job?.status || 'pending';

  const { data: results } = useGeminiResults(queueId, status === 'completed');

  useEffect(() => {
    if (!job?.started_at) return;
    if (job.status === 'completed' || job.status === 'failed') return;

    const start = new Date(job.started_at).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [job?.started_at, job?.status]);

  const finalElapsed = job?.started_at && job?.completed_at
    ? Math.floor((new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000)
    : null;

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] gap-6 p-6">
      <div className="w-full max-w-md rounded-xl border border-border glass-panel shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          {status === 'completed' ? (
            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
              <Check className="w-5 h-5 text-green-500" />
            </div>
          ) : status === 'failed' ? (
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
          ) : status === 'processing' ? (
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
              <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
          <div>
            <p className="font-medium text-foreground">
              {status === 'completed' ? 'Análise concluída'
                : status === 'failed' ? 'Análise falhou'
                : status === 'processing' ? 'Analisando...'
                : 'Aguardando início...'}
            </p>
            <p className="text-sm text-muted-foreground">
              {status === 'completed' && finalElapsed !== null
                ? `Concluído em ${formatElapsed(finalElapsed)}`
                : status === 'processing'
                  ? `Tempo: ${formatElapsed(elapsed)}`
                  : status === 'failed'
                    ? 'Verifique os logs no Supabase'
                    : 'Cloud Run vai iniciar em breve'}
            </p>
          </div>
        </div>

        {status === 'processing' && (
          <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
        )}

        {status === 'completed' && results && results.length > 0 && (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">#</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Rápida</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Gemini</th>
                  <th className="text-center px-3 py-2 font-medium text-muted-foreground text-xs w-8"></th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => {
                  const rapida = r.classificacao || '\u2014';
                  const gemini = r.gemini_classification || '\u2014';
                  const match = r.classificacao && r.gemini_classification
                    ? r.classificacao === r.gemini_classification
                    : null;
                  return (
                    <tr key={r.embriao_id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2 font-mono font-bold">{rapida}</td>
                      <td className="px-3 py-2 font-mono font-bold">{gemini}</td>
                      <td className="px-3 py-2 text-center">
                        {match === true && <Check className="w-3.5 h-3.5 text-green-500 inline" />}
                        {match === false && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 inline" />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            onClick={() => navigate('/bancada')}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-medium text-sm transition-colors"
          >
            {status === 'completed' ? 'Detalhes na Bancada' : 'Ver na Bancada'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isLoading && (
        <p className="text-xs text-muted-foreground">Conectando...</p>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────

interface PlateAnnotatorProps {
  queueId: string;
}

interface PopupPos {
  markerIdx: number;
  top: number;
  left: number;
}

export default function PlateAnnotator({ queueId }: PlateAnnotatorProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    frameDataUrl, markers, isFrameLoading, isSaving, error,
    addMarker, updateMarkerRadius, updateMarkerPosition, classifyMarker, undoLast,
    saveAndFinish, progress,
  } = useQuickClassify(queueId);

  usePrewarm();
  const { isPortrait, dismissedHint, setDismissedHint } = useFullscreenLandscape();

  const [popupPos, setPopupPos] = useState<PopupPos | null>(null);
  const [saved, setSaved] = useState(false);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [imgDims, setImgDims] = useState<{ w: number; h: number } | null>(null);

  const pointerDownRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragActiveRef = useRef(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const transformRef = useRef<any>(null);

  const LONG_PRESS_MS = 300;

  // Close popup on window resize (orientation change, keyboard, etc.)
  useEffect(() => {
    const handleResize = () => setPopupPos(null);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  /** Convert screen coords to image percent coords */
  const screenToPercent = useCallback((clientX: number, clientY: number) => {
    const img = imgRef.current;
    if (!img) return null;
    const rect = img.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100)),
    };
  }, []);

  /** Calculate popup screen position from marker percent coords */
  const calcPopupPosition = useCallback((x_percent: number, y_percent: number): { top: number; left: number } | null => {
    const img = imgRef.current;
    if (!img) return null;
    const rect = img.getBoundingClientRect();
    const screenX = rect.left + (x_percent / 100) * rect.width;
    const screenY = rect.top + (y_percent / 100) * rect.height;

    const popupW = 210;
    const popupH = 112;
    const gap = 16;

    const top = Math.max(8, Math.min(window.innerHeight - popupH - 8,
      screenY > window.innerHeight / 2
        ? screenY - popupH - gap
        : screenY + gap,
    ));

    let left = screenX - popupW / 2;
    left = Math.max(8, Math.min(window.innerWidth - popupW - 8, left));

    return { top, left };
  }, []);

  /** Find marker index at given percent position */
  const hitTestMarker = useCallback((x_pct: number, y_pct: number) => {
    return markers.findIndex((m) => {
      const dist = Math.hypot(m.x_percent - x_pct, m.y_percent - y_pct);
      return dist < m.radius_percent * 1.5;
    });
  }, [markers]);

  const handleTap = useCallback((x_percent: number, y_percent: number) => {
    const hitIdx = hitTestMarker(x_percent, y_percent);

    if (hitIdx >= 0) {
      const marker = markers[hitIdx];
      // Cycle radius only for small standard-size markers
      const curIdx = RADIUS_SIZES.indexOf(marker.radius_percent);
      if (curIdx >= 0) {
        const nextIdx = (curIdx + 1) % RADIUS_SIZES.length;
        updateMarkerRadius(hitIdx, RADIUS_SIZES[nextIdx]);
      }
      // Show popup if unclassified
      if (!marker.classification) {
        const pos = calcPopupPosition(marker.x_percent, marker.y_percent);
        if (pos) setPopupPos({ markerIdx: hitIdx, ...pos });
      } else {
        setPopupPos(null);
      }
    } else {
      // New marker — use average existing radius (correction mode) or default
      const avgRadius = markers.length > 0
        ? markers.reduce((sum, m) => sum + m.radius_percent, 0) / markers.length
        : RADIUS_SIZES[DEFAULT_RADIUS_IDX];
      addMarker({
        x_percent,
        y_percent,
        radius_percent: Math.round(avgRadius * 10) / 10,
      });
      navigator.vibrate?.(15);
      const pos = calcPopupPosition(x_percent, y_percent);
      if (pos) setPopupPos({ markerIdx: markers.length, ...pos });
    }
  }, [markers, hitTestMarker, addMarker, updateMarkerRadius, calcPopupPosition]);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    pointerDownRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
    dragActiveRef.current = false;
    clearLongPress();

    const pos = screenToPercent(e.clientX, e.clientY);
    if (!pos) return;
    const hitIdx = hitTestMarker(pos.x, pos.y);
    if (hitIdx >= 0) {
      longPressTimerRef.current = setTimeout(() => {
        dragActiveRef.current = true;
        setDraggingIdx(hitIdx);
        setPopupPos(null);
        navigator.vibrate?.(30);
        if (transformRef.current) {
          transformRef.current.setTransformState(
            transformRef.current.instance.transformState.scale,
            transformRef.current.instance.transformState.positionX,
            transformRef.current.instance.transformState.positionY,
          );
        }
      }, LONG_PRESS_MS);
    }
  }, [screenToPercent, hitTestMarker, clearLongPress]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (pointerDownRef.current && !dragActiveRef.current) {
      const dx = e.clientX - pointerDownRef.current.x;
      const dy = e.clientY - pointerDownRef.current.y;
      if (Math.hypot(dx, dy) > 8) {
        clearLongPress();
      }
    }

    if (dragActiveRef.current && draggingIdx !== null) {
      const pos = screenToPercent(e.clientX, e.clientY);
      if (pos) updateMarkerPosition(draggingIdx, pos.x, pos.y);
    }
  }, [draggingIdx, screenToPercent, updateMarkerPosition, clearLongPress]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    clearLongPress();

    if (dragActiveRef.current) {
      dragActiveRef.current = false;
      setDraggingIdx(null);
      pointerDownRef.current = null;
      return;
    }

    if (!pointerDownRef.current) return;
    const dx = e.clientX - pointerDownRef.current.x;
    const dy = e.clientY - pointerDownRef.current.y;
    const dist = Math.hypot(dx, dy);
    pointerDownRef.current = null;

    if (dist > 10) return;

    const pos = screenToPercent(e.clientX, e.clientY);
    if (pos) handleTap(pos.x, pos.y);
  }, [handleTap, screenToPercent, clearLongPress]);

  const handleClassify = useCallback((cls: ClassificacaoEmbriao) => {
    if (popupPos === null) return;
    classifyMarker(popupPos.markerIdx, cls);
    setPopupPos(null);
    navigator.vibrate?.(15);
  }, [popupPos, classifyMarker]);

  const handleUndo = useCallback(() => {
    undoLast();
    setPopupPos(null);
  }, [undoLast]);

  const handleSave = useCallback(async () => {
    try {
      await saveAndFinish();
      document.exitFullscreen?.().catch(() => {});
      (screen.orientation as any)?.unlock?.();
      setSaved(true);
    } catch (e) {
      toast({
        title: 'Erro ao salvar',
        description: e instanceof Error ? e.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  }, [saveAndFinish, toast]);

  // ─── Render ────────────────────────────────────────────

  if (saved) {
    return <JobStatusPanel queueId={queueId} />;
  }

  if (isFrameLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center gap-4">
        <LoadingSpinner />
        <p className="text-sm text-white/60">Extraindo frame do vídeo...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-sm text-red-400 text-center">{error}</p>
        <button
          onClick={() => navigate('/bancada')}
          className="px-4 py-2 rounded-lg bg-white/10 text-sm text-white"
        >
          Voltar para Bancada
        </button>
      </div>
    );
  }

  if (!frameDataUrl) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-sm text-white/60">Nenhum frame disponível</p>
      </div>
    );
  }

  // SVG coordinate helpers (natural image dimensions)
  const w = imgDims?.w ?? 100;
  const h = imgDims?.h ?? 100;
  const s = Math.min(w, h) / 100; // scale factor for proportional units

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Image area — fills entire screen */}
      <div className="w-full h-full relative">
        <TransformWrapper
          ref={transformRef}
          initialScale={1}
          minScale={0.5}
          maxScale={4}
          panning={{ velocityDisabled: true, disabled: draggingIdx !== null }}
          doubleClick={{ disabled: true }}
        >
          <TransformComponent
            wrapperStyle={{ width: '100%', height: '100%' }}
            contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <div
              className="relative inline-block"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              style={{ touchAction: 'none' }}
            >
              <img
                ref={imgRef}
                src={frameDataUrl}
                alt="Frame da placa"
                className="max-w-full max-h-full object-contain"
                draggable={false}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  setImgDims({ w: img.naturalWidth, h: img.naturalHeight });
                }}
              />
              {/* SVG overlay — viewBox uses natural image dimensions for perfect circles */}
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox={`0 0 ${w} ${h}`}
              >
                {markers.map((m, i) => {
                  const isDragging = i === draggingIdx;
                  const isSelected = i === popupPos?.markerIdx;
                  const isClassified = m.classification !== null;
                  const color = isDragging
                    ? '#f97316'
                    : isClassified
                      ? CLASS_COLORS[m.classification!] || '#22c55e'
                      : isSelected
                        ? '#3b82f6'
                        : '#9ca3af';
                  const fillOpacity = isDragging ? 0.25 : isClassified ? 0.2 : isSelected ? 0.15 : 0.1;
                  const cx = (m.x_percent / 100) * w;
                  const cy = (m.y_percent / 100) * h;
                  const r = (isDragging ? m.radius_percent * 1.15 : m.radius_percent) * s;

                  return (
                    <g key={i}>
                      <circle
                        cx={cx}
                        cy={cy}
                        r={r}
                        fill={color}
                        fillOpacity={fillOpacity}
                        stroke={color}
                        strokeWidth={(isDragging ? 0.6 : 0.4) * s}
                        strokeDasharray={isDragging ? `${s} ${0.5 * s}` : 'none'}
                        style={{ transition: isDragging ? 'none' : 'all 150ms ease' }}
                      />
                      <text
                        x={cx}
                        y={cy}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="white"
                        fontSize={m.radius_percent * 0.8 * s}
                        fontWeight="bold"
                        style={{ textShadow: '0 0 2px rgba(0,0,0,0.8)' }}
                      >
                        {isClassified ? m.classification : i + 1}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </TransformComponent>
        </TransformWrapper>

        {/* Header overlay */}
        <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-3 h-10 bg-black/40 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                document.exitFullscreen?.().catch(() => {});
                (screen.orientation as any)?.unlock?.();
                navigate('/bancada');
              }}
              className="p-1.5 -ml-1.5 text-white/80 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-medium text-white">
              {markers.length > 0
                ? `Classificar (${progress.classified}/${markers.length})`
                : 'Toque nos embriões'}
            </span>
          </div>
          {markers.length > 0 && (
            <button
              onClick={handleUndo}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-sm text-white/70 hover:text-white"
            >
              <Undo2 className="w-4 h-4" />
              Desf.
            </button>
          )}
        </div>

        {/* Footer overlay — Save button */}
        {markers.length > 0 && (
          <div className="absolute bottom-0 inset-x-0 z-10 p-3 bg-black/40 backdrop-blur-sm">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-medium text-sm transition-colors disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isSaving ? 'Salvando...' : progress.classified > 0
                ? `Salvar e Analisar (${progress.classified})`
                : `Salvar marcações e Analisar (${markers.length})`}
            </button>
          </div>
        )}

        {/* Classification popup */}
        {popupPos && (
          <>
            {/* Backdrop — closes popup on tap */}
            <div
              className="absolute inset-0 z-20"
              onPointerDown={() => setPopupPos(null)}
            />
            {/* Popup */}
            <div
              className="absolute z-30 rounded-xl bg-black/80 backdrop-blur-md border border-white/20 p-2"
              style={{ top: popupPos.top, left: popupPos.left, width: 210 }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="grid grid-cols-4 gap-1.5">
                {CLASSES.map((cls) => (
                  <button
                    key={cls.value}
                    onClick={() => handleClassify(cls.value)}
                    className="flex items-center justify-center rounded-lg h-11 font-mono text-sm font-bold text-white transition-colors active:scale-95"
                    style={{
                      backgroundColor: CLASS_COLORS[cls.value] + '25',
                      borderWidth: 1.5,
                      borderColor: CLASS_COLORS[cls.value] + '60',
                    }}
                  >
                    {cls.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Portrait hint (iOS fallback — no Fullscreen API) */}
        {isPortrait && !dismissedHint && (
          <div
            className="absolute inset-0 z-40 bg-black/80 flex flex-col items-center justify-center text-white gap-3"
            onClick={() => setDismissedHint(true)}
          >
            <span className="text-5xl">&#8635;</span>
            <p className="text-lg font-medium">Gire o celular</p>
            <p className="text-sm text-white/50">Toque para continuar</p>
          </div>
        )}
      </div>
    </div>
  );
}
