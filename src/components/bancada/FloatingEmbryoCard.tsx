/**
 * FloatingEmbryoCard — Popup flutuante posicionado ao lado do marker clicado.
 *
 * Conteúdo: thumbnails, badges cinéticos, IA Combinada, KNN top-2,
 * Gemini (classe + estágio + reasoning 2 linhas), botões de classificação.
 *
 * Posicionamento: lado oposto ao marker (se marker está na metade esquerda,
 * card aparece à direita, e vice-versa). Verticalmente centralizado no marker
 * com clamp ao viewport.
 */

import { useEffect, useRef, useState, useCallback, useLayoutEffect } from 'react';
import { Eye, Activity, Brain, ZoomIn, X } from 'lucide-react';
import type { ClassificacaoEmbriao } from '@/lib/types';
import type { BancadaPlateScore } from '@/hooks/useBancadaJobs';
import { useEmbryoscoreUrl } from '@/hooks/useStorageUrl';
import { BiologistClassButtons } from '@/components/embryoscore/BiologistClassButtons';
import { EmbryoImageLightbox } from './EmbryoImageLightbox';
import { getKineticDiagnosis, getLabelClasses } from '@/lib/embryoscore/kinetic-labels';

const CARD_W = 380;
const GAP = 20; // gap between marker and card edge
const MARGIN = 8; // minimum distance from viewport edges

const CLASS_COLORS: Record<string, string> = {
  BE: 'text-emerald-600 dark:text-emerald-400',
  BN: 'text-green-600 dark:text-green-400',
  BX: 'text-amber-600 dark:text-amber-400',
  BL: 'text-blue-600 dark:text-blue-400',
  BI: 'text-sky-600 dark:text-sky-400',
  Mo: 'text-purple-600 dark:text-purple-400',
  Dg: 'text-red-600 dark:text-red-400',
};

const STAGE_LABELS: Record<number, string> = {
  3: 'Mórula Inicial', 4: 'Mórula', 5: 'Blasto Inicial',
  6: 'Blastocisto', 7: 'Blasto Expandido', 8: 'Blasto Eclodido', 9: 'Blasto Eclodido Exp.',
};

const SOURCE_LABELS: Record<string, string> = {
  knn: 'KNN',
  knn_mlp_agree: 'KNN + Classificador',
  knn_mlp_disagree: 'KNN vs Classificador',
  mlp_only: 'Classificador',
  insufficient: 'Manual',
};

interface FloatingEmbryoCardProps {
  anchorX: number;
  anchorY: number;
  embryoLabel: string;
  score: BancadaPlateScore | null;
  classificacao?: string;
  onClassify: (cls: ClassificacaoEmbriao) => void;
  onUndo?: () => void;
  canUndo?: boolean;
  isLoading?: boolean;
  selectedClass: ClassificacaoEmbriao | null;
  onSelectClass: (cls: ClassificacaoEmbriao | null) => void;
  onClose: () => void;
}

export function FloatingEmbryoCard({
  anchorX,
  anchorY,
  embryoLabel,
  score,
  onClassify,
  onUndo,
  canUndo,
  isLoading,
  selectedClass,
  onSelectClass,
  onClose,
}: FloatingEmbryoCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: -9999, top: -9999 });

  const { data: cropUrl } = useEmbryoscoreUrl(score?.crop_image_path);
  const { data: motionUrl } = useEmbryoscoreUrl(score?.motion_map_path);
  const [lightboxTab, setLightboxTab] = useState<'crop' | 'motion' | null>(null);

  const calcPosition = useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Cap measured height to max available viewport space
    const rawH = cardRef.current?.offsetHeight || 400;
    const cardH = Math.min(rawH, vh - MARGIN * 2);

    // Horizontal: place on the opposite side of the marker
    const markerOnLeft = anchorX < vw / 2;
    let left: number;
    if (markerOnLeft) {
      left = anchorX + GAP;
      if (left + CARD_W > vw - MARGIN) {
        left = anchorX - CARD_W - GAP;
      }
    } else {
      left = anchorX - CARD_W - GAP;
      if (left < MARGIN) {
        left = anchorX + GAP;
      }
    }
    left = Math.max(MARGIN, Math.min(vw - CARD_W - MARGIN, left));

    // Vertical: center on marker, clamp to viewport
    let top = anchorY - cardH / 2;
    top = Math.max(MARGIN, Math.min(vh - cardH - MARGIN, top));

    setPos({ left, top });
  }, [anchorX, anchorY]);

  // Recalculate after the card content renders (so offsetHeight is real)
  useLayoutEffect(() => {
    calcPosition();
  }, [calcPosition]);

  // Also recalculate on resize
  useEffect(() => {
    window.addEventListener('resize', calcPosition);
    return () => window.removeEventListener('resize', calcPosition);
  }, [calcPosition]);

  // ResizeObserver: recalc when card content changes (e.g. images load)
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => calcPosition());
    ro.observe(el);
    return () => ro.disconnect();
  }, [calcPosition]);

  // Click outside → close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        const target = e.target as SVGElement;
        if (target.closest?.('g[data-marker]')) return;
        onClose();
      }
    };
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', handler);
    }, 50);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousedown', handler);
    };
  }, [onClose]);

  const votes = score?.knn_votes || {};
  const totalVotes = Object.values(votes).reduce((sum, v) => sum + v, 0);
  const topVotes = Object.entries(votes).sort((a, b) => b[1] - a[1]).slice(0, 2);

  return (
    <div
      ref={cardRef}
      className="fixed z-[60] rounded-xl border border-border bg-card/95 backdrop-blur-md shadow-2xl flex flex-col"
      style={{
        width: CARD_W,
        maxHeight: 'calc(100vh - 16px)',
        left: pos.left,
        top: pos.top,
        transition: 'left 150ms ease, top 150ms ease',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border/50 shrink-0 rounded-t-xl">
        <span className="text-sm font-semibold text-foreground">Embrião {embryoLabel}</span>
        <button
          onClick={onClose}
          className="p-0.5 rounded hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 space-y-3 overflow-y-auto flex-1 min-h-0 scrollbar-thin" onWheel={(e) => e.stopPropagation()}>
        {/* Thumbnails — clickable to open lightbox with zoom */}
        <div className="grid grid-cols-2 gap-2">
          <CompactTile label="Frame" url={cropUrl} icon={Eye} onClick={() => setLightboxTab('crop')} />
          <CompactTile label="Cinético" url={motionUrl} icon={Activity} onClick={() => setLightboxTab('motion')} />
        </div>

        {/* Kinetic badges */}
        {score?.kinetic_intensity != null && (() => {
          const diag = getKineticDiagnosis(score);
          return (
            <div className="flex flex-wrap gap-1.5">
              {(['Atividade', 'Distribuição', 'Estabilidade'] as const).map((label, i) => {
                const d = [diag.activity, diag.distribution, diag.stability][i];
                return (
                  <div key={label} className="flex items-center gap-1 text-[10px]">
                    <span className="text-muted-foreground">{label}:</span>
                    <span className={`px-1 py-0.5 rounded text-[9px] font-medium border ${getLabelClasses(d.color)}`}>
                      {d.label}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Combined IA */}
        {score?.combined_classification && (
          <div className="flex items-center gap-2">
            <Brain className="w-3.5 h-3.5 text-primary/60 shrink-0" />
            <span className={`font-mono text-lg font-bold ${CLASS_COLORS[score.combined_classification] || 'text-foreground'}`}>
              {score.combined_classification}
            </span>
            {score.combined_confidence != null && (
              <span className={`text-xs font-mono font-bold ${score.combined_confidence >= 80 ? 'text-green-500' : 'text-amber-500'}`}>
                {score.combined_confidence}%
              </span>
            )}
            <span className="text-[10px] text-muted-foreground ml-auto">
              {SOURCE_LABELS[score.combined_source || 'insufficient'] || 'Manual'}
            </span>
          </div>
        )}

        {/* KNN top-2 */}
        {topVotes.length > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">KNN:</span>
            {topVotes.map(([cls, count]) => (
              <span key={cls} className="font-mono font-bold">
                {cls} <span className="text-muted-foreground font-normal">
                  {totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0}%
                </span>
              </span>
            ))}
          </div>
        )}

        {/* Gemini IA */}
        {score?.gemini_classification && (
          <div className="pt-2 border-t border-border/30 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Eye className="w-3 h-3 text-primary/60 shrink-0" />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Gemini</span>
              <span className={`font-mono text-sm font-bold ${CLASS_COLORS[score.gemini_classification] || 'text-foreground'}`}>
                {score.gemini_classification}
              </span>
              {score.stage_code != null && (
                <span className="text-[10px] bg-muted/50 px-1.5 py-0.5 rounded">
                  {STAGE_LABELS[score.stage_code] || `Est. ${score.stage_code}`}
                </span>
              )}
              {score.quality_grade != null && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                  score.quality_grade <= 2 ? 'bg-green-500/10 text-green-600' :
                  score.quality_grade === 3 ? 'bg-amber-500/10 text-amber-600' :
                  'bg-red-500/10 text-red-600'
                }`}>
                  Grau {score.quality_grade}
                </span>
              )}
              {score.ai_confidence != null && (
                <span className={`text-[10px] font-mono font-bold ml-auto ${score.ai_confidence >= 0.8 ? 'text-green-500' : 'text-amber-500'}`}>
                  {Math.round(score.ai_confidence * 100)}%
                </span>
              )}
            </div>
            {score.gemini_reasoning && (
              <p className="text-[11px] text-muted-foreground leading-snug">
                {score.gemini_reasoning}
              </p>
            )}
          </div>
        )}

        {/* Classification buttons */}
        <div className="pt-2 border-t border-border/30">
          <BiologistClassButtons
            aiSuggestion={score?.combined_classification}
            currentClassification={score?.biologist_classification}
            onClassify={onClassify}
            onUndo={onUndo}
            canUndo={canUndo}
            isLoading={isLoading}
            selected={selectedClass}
            onSelect={onSelectClass}
          />
        </div>
      </div>

      {/* Image lightbox with zoom/pan */}
      <EmbryoImageLightbox
        open={lightboxTab !== null}
        onClose={() => setLightboxTab(null)}
        cropUrl={cropUrl}
        motionUrl={motionUrl}
        initialTab={lightboxTab || 'crop'}
        label={`Embrião ${embryoLabel}`}
      />
    </div>
  );
}

function CompactTile({
  label,
  url,
  icon: Icon,
  onClick,
}: {
  label: string;
  url: string | null | undefined;
  icon: React.ElementType;
  onClick?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
        <Icon className="w-2.5 h-2.5" /> {label}
      </span>
      {url ? (
        <div className="relative group cursor-pointer" onClick={onClick}>
          <img
            src={url}
            alt={label}
            className="w-full aspect-square rounded-lg border border-border object-cover group-hover:ring-2 group-hover:ring-primary/30 transition-all"
            loading="lazy"
          />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-lg">
            <ZoomIn className="w-5 h-5 text-white drop-shadow" />
          </div>
        </div>
      ) : (
        <div className="w-full aspect-square rounded-lg border border-border bg-muted/30 flex items-center justify-center">
          <Icon className="w-5 h-5 text-muted-foreground/30" />
        </div>
      )}
    </div>
  );
}
