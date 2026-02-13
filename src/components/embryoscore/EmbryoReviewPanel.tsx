/**
 * EmbryoReviewPanel — Painel principal de revisão do biólogo.
 *
 * Layout:
 *   1. PlatePanorama (frame da placa interativo)
 *   2. Card do embrião ativo (3 imagens + votação KNN + botões classificação)
 *   3. Progresso "12/15 classificados"
 *   4. DispatchSummary quando todos classificados
 */

import { useState, useMemo, useCallback } from 'react';
import type { ClassificacaoEmbriao, EmbryoScore, DetectedBbox } from '@/lib/types';
import { useReviewData, useSubmitClassification, useUndoClassification, useAtlasStats } from '@/hooks/useEmbryoReview';
import { useEmbryoscoreUrl } from '@/hooks/useStorageUrl';
import { PlatePanorama } from './PlatePanorama';
import { EmbryoMinimap } from './EmbryoMinimap';
import { BiologistClassButtons } from './BiologistClassButtons';
import { DispatchSummary } from './DispatchSummary';
import { Eye, Activity, Map, ChevronLeft, ChevronRight } from 'lucide-react';

const SOURCE_LABELS: Record<string, { icon: string; text: string; color: string }> = {
  knn: { icon: '🤖', text: 'KNN', color: 'text-primary' },
  knn_mlp_agree: { icon: '🤖', text: 'KNN + Classificador concordam', color: 'text-primary' },
  knn_mlp_disagree: { icon: '⚠️', text: 'KNN vs Classificador divergem', color: 'text-amber-500' },
  mlp_only: { icon: '💡', text: 'Sugestão do classificador', color: 'text-blue-500' },
  insufficient: { icon: '🔍', text: 'Classifique manualmente', color: 'text-muted-foreground' },
};

interface EmbryoReviewPanelProps {
  queueId: string;
}

export function EmbryoReviewPanel({ queueId }: EmbryoReviewPanelProps) {
  const { data: reviewData, isLoading } = useReviewData(queueId);
  const submitMutation = useSubmitClassification();
  const undoMutation = useUndoClassification();
  const { data: atlasStats } = useAtlasStats();

  const [activeIdx, setActiveIdx] = useState(0);

  // Plate frame signed URL
  const { data: plateFrameUrl } = useEmbryoscoreUrl(reviewData?.plateFramePath);

  const embrioes = reviewData?.embrioes || [];
  const bboxes = (reviewData?.queue?.detected_bboxes || []) as DetectedBbox[];

  // Compute statuses for PlatePanorama
  const statuses = useMemo(() =>
    embrioes.map((e, i) => {
      if (i === activeIdx) return 'active' as const;
      if (e.score?.biologist_classification) return 'classified' as const;
      return 'pending' as const;
    }),
    [embrioes, activeIdx],
  );

  // Count classified
  const classifiedCount = embrioes.filter(e => e.score?.biologist_classification).length;
  const totalCount = embrioes.length;
  const allClassified = totalCount > 0 && classifiedCount === totalCount;

  // Current embryo
  const current = embrioes[activeIdx];
  const score = current?.score;

  // Navigate to next pending
  const goToNextPending = useCallback(() => {
    const nextIdx = embrioes.findIndex((e, i) => i > activeIdx && !e.score?.biologist_classification);
    if (nextIdx >= 0) {
      setActiveIdx(nextIdx);
    } else {
      // Wrap around
      const wrapIdx = embrioes.findIndex((e) => !e.score?.biologist_classification);
      if (wrapIdx >= 0) setActiveIdx(wrapIdx);
    }
  }, [embrioes, activeIdx]);

  // Handlers
  const handleClassify = useCallback((classification: ClassificacaoEmbriao) => {
    if (!current || !score) return;
    submitMutation.mutate({
      scoreId: score.id,
      embriaoId: current.id,
      classification,
      queueId,
    }, {
      onSuccess: () => goToNextPending(),
    });
  }, [current, score, queueId, submitMutation, goToNextPending]);

  const handleUndo = useCallback(() => {
    if (!current || !score) return;
    undoMutation.mutate({
      scoreId: score.id,
      embriaoId: current.id,
      queueId,
    });
  }, [current, score, queueId, undoMutation]);

  // Check if undo is allowed (within 5 min)
  const canUndo = useMemo(() => {
    if (!score?.biologist_classification || !score?.created_at) return false;
    return true; // The hook checks the 5-min window server-side
  }, [score]);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 animate-pulse">
        <div className="h-6 bg-muted rounded w-48 mb-4" />
        <div className="h-40 bg-muted rounded-lg mb-4" />
        <div className="h-32 bg-muted rounded-lg" />
      </div>
    );
  }

  if (!reviewData || embrioes.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
        Nenhum embrião para revisar.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with progress */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <div className="w-1 h-5 rounded-full bg-primary/50" />
          Revisão
        </h2>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{classifiedCount}/{totalCount}</span>
          <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${totalCount > 0 ? (classifiedCount / totalCount) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Plate Panorama */}
      <PlatePanorama
        plateFrameUrl={plateFrameUrl}
        bboxes={bboxes}
        statuses={statuses}
        activeIndex={activeIdx}
        onSelect={setActiveIdx}
      />

      {/* Current embryo card */}
      {current && score && (
        <EmbryoDetailCard
          embryoLabel={current.identificacao || `#${activeIdx + 1}`}
          score={score}
          bboxes={bboxes}
          currentIndex={activeIdx}
          plateFrameUrl={plateFrameUrl}
          onClassify={handleClassify}
          onUndo={handleUndo}
          canUndo={canUndo}
          isMutating={submitMutation.isPending || undoMutation.isPending}
          onPrev={() => setActiveIdx(Math.max(0, activeIdx - 1))}
          onNext={() => setActiveIdx(Math.min(embrioes.length - 1, activeIdx + 1))}
          hasPrev={activeIdx > 0}
          hasNext={activeIdx < embrioes.length - 1}
        />
      )}

      {/* Dispatch summary when all classified */}
      {allClassified && (
        <DispatchSummary
          scores={embrioes.map(e => e.score!).filter(Boolean)}
          atlasTotal={atlasStats?.total || 0}
          atlasBovineReal={atlasStats?.bovine_real || 0}
          onConfirmDispatch={() => { /* Will be wired to actual dispatch logic */ }}
        />
      )}
    </div>
  );
}

// ─── EmbryoDetailCard (internal) ───

interface EmbryoDetailCardProps {
  embryoLabel: string;
  score: EmbryoScore;
  bboxes: DetectedBbox[];
  currentIndex: number;
  plateFrameUrl: string | null | undefined;
  onClassify: (cls: ClassificacaoEmbriao) => void;
  onUndo: () => void;
  canUndo: boolean;
  isMutating: boolean;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

function EmbryoDetailCard({
  embryoLabel,
  score,
  bboxes,
  currentIndex,
  plateFrameUrl,
  onClassify,
  onUndo,
  canUndo,
  isMutating,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: EmbryoDetailCardProps) {
  // Signed URLs for images
  const { data: cropUrl } = useEmbryoscoreUrl(score.crop_image_path);
  const { data: motionUrl } = useEmbryoscoreUrl(score.motion_map_path);

  const source = score.combined_source || 'insufficient';
  const sourceInfo = SOURCE_LABELS[source] || SOURCE_LABELS.insufficient;

  // Build vote bars from knn_votes
  const votes = score.knn_votes || {};
  const totalVotes = Object.values(votes).reduce((sum, v) => sum + v, 0);
  const sortedVotes = Object.entries(votes).sort((a, b) => b[1] - a[1]);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Card header — navigation */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-muted/80 via-muted/60 to-muted/80 border-b border-border">
        <button
          onClick={onPrev}
          disabled={!hasPrev}
          className="p-1 rounded-md hover:bg-muted disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-foreground">
          Embrião {embryoLabel}
        </span>
        <button
          onClick={onNext}
          disabled={!hasNext}
          className="p-1 rounded-md hover:bg-muted disabled:opacity-30 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* 3 images row */}
        <div className="grid grid-cols-3 gap-3">
          <ImageTile label="Melhor frame" url={cropUrl} icon={Eye} />
          <ImageTile label="Mapa cinético" url={motionUrl} icon={Activity} />
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Map className="w-3 h-3" /> Minimapa
            </span>
            <EmbryoMinimap
              plateFrameUrl={plateFrameUrl}
              bboxes={bboxes}
              currentIndex={currentIndex}
            />
          </div>
        </div>

        {/* Source indicator */}
        <div className={`flex items-center gap-2 text-sm ${sourceInfo.color}`}>
          <span>{sourceInfo.icon}</span>
          {score.combined_classification && (
            <span className="font-mono text-2xl font-bold text-primary">
              {score.combined_classification}
            </span>
          )}
          {score.combined_confidence != null && (
            <span className="text-xs text-muted-foreground">
              ({score.combined_confidence}%)
            </span>
          )}
          <span className="text-xs">{sourceInfo.text}</span>
          {source === 'knn_mlp_agree' && (
            <span className="text-xs text-primary">✓</span>
          )}
        </div>

        {/* MLP disagree indicator */}
        {source === 'knn_mlp_disagree' && score.mlp_classification && (
          <div className="flex items-center gap-2 text-sm text-amber-500">
            <span>💡</span>
            <span className="font-mono font-bold">{score.mlp_classification}</span>
            {score.mlp_confidence != null && (
              <span className="text-xs text-muted-foreground">({score.mlp_confidence}%)</span>
            )}
          </div>
        )}

        {/* KNN vote bars */}
        {sortedVotes.length > 0 && (
          <div className="space-y-1.5">
            {sortedVotes.map(([cls, count]) => {
              const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
              return (
                <div key={cls} className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold w-6 text-foreground">{cls}</span>
                  <div className="flex-1 h-5 bg-muted rounded-sm overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-sm transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground w-10 text-right">{pct}%</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Insufficient data note */}
        {source === 'insufficient' && (
          <div className="text-xs text-muted-foreground italic px-2">
            Atlas em construção ({score.knn_real_bovine_count || 0} referências reais).
            Classifique manualmente para treinar o sistema.
          </div>
        )}

        {/* MLP-only note */}
        {source === 'mlp_only' && (
          <div className="text-xs text-muted-foreground italic px-2">
            {score.knn_real_bovine_count || 0} referências reais no atlas — classifique manualmente para melhorar.
          </div>
        )}

        {/* Kinetic metrics */}
        {score.kinetic_intensity != null && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 px-2 text-[11px] text-muted-foreground">
            <span>Intensidade: <b className="text-foreground">{(score.kinetic_intensity * 100).toFixed(0)}%</b></span>
            {score.kinetic_harmony != null && (
              <span>Harmonia: <b className="text-foreground">{(score.kinetic_harmony * 100).toFixed(0)}%</b></span>
            )}
            {score.kinetic_symmetry != null && (
              <span>Simetria: <b className="text-foreground">{(score.kinetic_symmetry * 100).toFixed(0)}%</b></span>
            )}
            {score.kinetic_stability != null && (
              <span>Estabilidade: <b className="text-foreground">{(score.kinetic_stability * 100).toFixed(0)}%</b></span>
            )}
          </div>
        )}

        {/* Classification buttons */}
        <BiologistClassButtons
          aiSuggestion={score.combined_classification}
          currentClassification={score.biologist_classification}
          onClassify={onClassify}
          onUndo={onUndo}
          canUndo={canUndo}
          isLoading={isMutating}
        />
      </div>
    </div>
  );
}

// ─── ImageTile (internal) ───

function ImageTile({
  label,
  url,
  icon: Icon,
}: {
  label: string;
  url: string | null | undefined;
  icon: React.ElementType;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
        <Icon className="w-3 h-3" /> {label}
      </span>
      {url ? (
        <img
          src={url}
          alt={label}
          className="w-full aspect-square rounded-lg border border-border object-cover"
        />
      ) : (
        <div className="w-full aspect-square rounded-lg border border-border bg-muted/30 flex items-center justify-center">
          <Icon className="w-6 h-6 text-muted-foreground/30" />
        </div>
      )}
    </div>
  );
}
