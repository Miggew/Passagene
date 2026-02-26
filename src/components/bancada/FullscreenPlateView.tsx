/**
 * FullscreenPlateView — Fullscreen plate frame with SVG overlay markers.
 *
 * Replaces the old split-panel PlateDetail.
 * - fixed inset-0 layout with plate frame filling the screen
 * - SVG overlay with EmbryoMarkerSVG for each embryo
 * - FloatingEmbryoCard popup on marker click
 * - Keyboard: ←/→ nav, 1-7 class select, Enter confirm, Del=Dg
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CLASSES } from '@/components/embryoscore/BiologistClassButtons';
import { EmbryoMarkerSVG } from './EmbryoMarkerSVG';
import { FloatingEmbryoCard } from './FloatingEmbryoCard';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { useEmbryoscoreUrl } from '@/hooks/useStorageUrl';
import { useBancadaPlate } from '@/hooks/useBancadaJobs';
import { useSubmitClassification, useUndoClassification } from '@/hooks/useEmbryoReview';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import type { ClassificacaoEmbriao } from '@/lib/types';

const MARKER_R_PERCENT = 1.8; // radius as % of image width

interface FullscreenPlateViewProps {
  queueId: string;
  onBack: () => void;
}

export function FullscreenPlateView({ queueId, onBack }: FullscreenPlateViewProps) {
  const { data, isLoading } = useBancadaPlate(queueId);
  const { data: plateFrameUrl } = useEmbryoscoreUrl(data?.job?.plate_frame_path);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [selectedClass, setSelectedClass] = useState<ClassificacaoEmbriao | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [imgDims, setImgDims] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const submitMutation = useSubmitClassification();
  const undoMutation = useUndoClassification();

  const embryos = data?.embryos || [];
  const job = data?.job;
  const bboxes = useMemo(() => job?.manual_bboxes || job?.detected_bboxes || [], [job]);
  const detectedCount = (job?.detected_bboxes || []).length;
  const expectedCount = job?.expected_count || embryos.length;
  const hasMismatch = job?.status === 'completed' && detectedCount > 0 && detectedCount < expectedCount;

  // Reset class selection when embryo changes
  useEffect(() => {
    setSelectedClass(null);
  }, [selectedIdx]);

  // Statuses for markers
  const statuses = useMemo(() =>
    embryos.map((emb, i) => {
      if (i === selectedIdx) return 'active' as const;
      if (emb.score?.biologist_classification || emb.classificacao) return 'classified' as const;
      return 'pending' as const;
    }),
    [embryos, selectedIdx],
  );

  const classifiedCount = embryos.filter(e => e.score?.biologist_classification || e.classificacao).length;

  // Navigate to next unclassified
  const goToNextPending = useCallback(() => {
    const startIdx = selectedIdx ?? -1;
    const nextIdx = embryos.findIndex((e, i) => i > startIdx && !e.score?.biologist_classification && !e.classificacao);
    if (nextIdx >= 0) {
      setSelectedIdx(nextIdx);
    } else {
      const wrapIdx = embryos.findIndex((e) => !e.score?.biologist_classification && !e.classificacao);
      if (wrapIdx >= 0) setSelectedIdx(wrapIdx);
    }
  }, [embryos, selectedIdx]);

  // Classification handler
  const handleClassify = useCallback((cls: ClassificacaoEmbriao) => {
    if (selectedIdx === null) return;
    const emb = embryos[selectedIdx];
    if (!emb) return;

    const score = emb.score;
    if (score?.id) {
      submitMutation.mutate({
        scoreId: score.id,
        embriaoId: emb.id,
        classification: cls,
        queueId,
      }, {
        onSuccess: () => {
          supabase.from('embrioes').update({
            classificacao: cls,
            data_classificacao: new Date().toISOString(),
          }).eq('id', emb.id).then(() => {
            queryClient.invalidateQueries({ queryKey: ['bancada-plate', queueId] });
          });
          toast({ title: `Classificado como ${cls}` });
          goToNextPending();
        },
      });
    } else {
      supabase.from('embrioes').update({
        classificacao: cls,
        data_classificacao: new Date().toISOString(),
      }).eq('id', emb.id).then(({ error }) => {
        if (error) {
          toast({ title: 'Erro ao classificar', variant: 'destructive' });
        } else {
          toast({ title: `Classificado como ${cls}` });
          queryClient.invalidateQueries({ queryKey: ['bancada-plate', queueId] });
          goToNextPending();
        }
      });
    }
  }, [embryos, selectedIdx, queueId, submitMutation, goToNextPending, toast, queryClient]);

  // Undo handler
  const handleUndo = useCallback(() => {
    if (selectedIdx === null) return;
    const emb = embryos[selectedIdx];
    if (!emb?.score?.id) return;
    undoMutation.mutate({
      scoreId: emb.score.id,
      embriaoId: emb.id,
      queueId,
    }, {
      onSuccess: () => {
        supabase.from('embrioes').update({
          classificacao: null,
          data_classificacao: null,
        }).eq('id', emb.id).then(() => {
          queryClient.invalidateQueries({ queryKey: ['bancada-plate', queueId] });
        });
      },
    });
  }, [embryos, selectedIdx, queueId, undoMutation, queryClient]);

  // Marker click → select + toggle popup
  const handleMarkerClick = useCallback((idx: number) => {
    if (selectedIdx === idx && showPopup) {
      setShowPopup(false);
    } else {
      setSelectedIdx(idx);
      setShowPopup(true);
    }
  }, [selectedIdx, showPopup]);

  // Get anchor screen position for the floating card
  const getMarkerScreenPos = useCallback((idx: number): { x: number; y: number } => {
    const img = imgRef.current;
    if (!img || !bboxes[idx]) return { x: 0, y: 0 };

    const rect = img.getBoundingClientRect();
    const bbox = bboxes[idx];
    return {
      x: rect.left + (bbox.x_percent / 100) * rect.width,
      y: rect.top + (bbox.y_percent / 100) * rect.height,
    };
  }, [bboxes]);

  // Keyboard hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const currentEmb = selectedIdx !== null ? embryos[selectedIdx] : null;
      const isConfirmed = !!(currentEmb?.score?.biologist_classification);

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          if (showPopup) {
            setShowPopup(false);
          } else {
            onBack();
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          setSelectedIdx(prev => {
            const next = Math.min(embryos.length - 1, (prev ?? -1) + 1);
            setShowPopup(true);
            return next;
          });
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setSelectedIdx(prev => {
            const next = Math.max(0, (prev ?? 1) - 1);
            setShowPopup(true);
            return next;
          });
          break;
        case '1': case '2': case '3': case '4': case '5': case '6': case '7':
          if (isConfirmed) break;
          e.preventDefault();
          setSelectedClass(CLASSES[parseInt(e.key) - 1].value);
          if (!showPopup) setShowPopup(true);
          break;
        case 'Delete':
        case 'Backspace':
          if (isConfirmed) break;
          e.preventDefault();
          setSelectedClass('Dg');
          if (!showPopup) setShowPopup(true);
          break;
        case 'Enter':
          if (!selectedClass || isConfirmed) break;
          e.preventDefault();
          handleClassify(selectedClass);
          setSelectedClass(null);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [embryos, selectedIdx, selectedClass, showPopup, handleClassify, onBack]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Job não encontrado</p>
      </div>
    );
  }

  const currentEmb = selectedIdx !== null ? embryos[selectedIdx] : null;
  const markerAnchor = selectedIdx !== null ? getMarkerScreenPos(selectedIdx) : null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col" ref={containerRef}>
      {/* Top bar overlay */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-white/80 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>

        <div className="flex items-center gap-3">
          {/* Detection mismatch */}
          {hasMismatch && (
            <button
              onClick={() => navigate(`/bancada/rapida/${queueId}`)}
              className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              {detectedCount}/{expectedCount} detectados
            </button>
          )}

          {/* Progress */}
          <div className="flex items-center gap-2 text-sm text-white/80">
            <span>{classifiedCount}/{embryos.length}</span>
            <div className="w-20 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400 rounded-full transition-all"
                style={{ width: `${embryos.length > 0 ? (classifiedCount / embryos.length) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Hotkey hints */}
          <div className="hidden md:flex items-center gap-2 text-[10px] text-white/40">
            <kbd className="px-1 py-0.5 rounded bg-white/10">←→</kbd>
            <span>nav</span>
            <kbd className="px-1 py-0.5 rounded bg-white/10">1-7</kbd>
            <span>classe</span>
            <kbd className="px-1 py-0.5 rounded bg-white/10">Enter</kbd>
            <span>confirmar</span>
          </div>
        </div>
      </div>

      {/* Plate frame + SVG overlay */}
      {plateFrameUrl ? (
        <div className="flex-1 flex items-center justify-center relative overflow-hidden">
          {/* Image */}
          <img
            ref={imgRef}
            src={plateFrameUrl}
            alt="Placa de embriões"
            className="max-w-full max-h-full object-contain"
            onLoad={(e) => {
              const img = e.currentTarget;
              setImgDims({ w: img.naturalWidth, h: img.naturalHeight });
            }}
          />

          {/* SVG overlay — positioned exactly over the image */}
          {imgDims.w > 0 && bboxes.length > 0 && (
            <svg
              className="absolute pointer-events-none"
              viewBox={`0 0 ${imgDims.w} ${imgDims.h}`}
              style={{
                width: imgRef.current?.clientWidth || '100%',
                height: imgRef.current?.clientHeight || '100%',
                left: imgRef.current ? imgRef.current.offsetLeft : 0,
                top: imgRef.current ? imgRef.current.offsetTop : 0,
              }}
            >
              {bboxes.map((bbox, i) => {
                const cx = (bbox.x_percent / 100) * imgDims.w;
                const cy = (bbox.y_percent / 100) * imgDims.h;
                const r = (MARKER_R_PERCENT / 100) * imgDims.w;

                return (
                  <g key={i} data-marker="true" style={{ pointerEvents: 'auto' }}>
                    <EmbryoMarkerSVG
                      cx={cx}
                      cy={cy}
                      r={r}
                      index={i}
                      status={statuses[i] || 'pending'}
                      onClick={() => handleMarkerClick(i)}
                    />
                  </g>
                );
              })}
            </svg>
          )}

          {/* No bboxes fallback */}
          {bboxes.length === 0 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-card/90 backdrop-blur-md border border-border/60 rounded-xl px-4 py-3 shadow-lg">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-sm text-foreground">Nenhum embrião detectado</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/bancada/rapida/${queueId}`)}
              >
                Classificação Rápida
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          {job.status === 'processing' ? (
            <div className="flex flex-col items-center gap-3 text-white/60">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="text-sm">Processando...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <span className="text-sm text-white/60">Aguardando processamento</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/bancada/rapida/${queueId}`)}
              >
                Classificação Rápida
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Floating embryo card */}
      {showPopup && currentEmb && markerAnchor && (
        <FloatingEmbryoCard
          anchorX={markerAnchor.x}
          anchorY={markerAnchor.y}
          embryoLabel={currentEmb.identificacao || `#${(selectedIdx ?? 0) + 1}`}
          score={currentEmb.score || null}
          classificacao={currentEmb.classificacao}
          onClassify={handleClassify}
          onUndo={handleUndo}
          canUndo={!!currentEmb.score?.biologist_classification}
          isLoading={submitMutation.isPending || undoMutation.isPending}
          selectedClass={selectedClass}
          onSelectClass={setSelectedClass}
          onClose={() => setShowPopup(false)}
        />
      )}
    </div>
  );
}
