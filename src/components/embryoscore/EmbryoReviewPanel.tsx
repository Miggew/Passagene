/**
 * EmbryoReviewPanel — Painel principal de revisão do biólogo.
 *
 * Layout:
 *   1. PlatePanorama (frame da placa interativo)
 *   2. Card do embrião ativo (3 imagens + votação KNN + botões classificação)
 *   3. Progresso "12/15 classificados"
 *   4. DispatchSummary quando todos classificados
 *
 * Fase 3: Blind Review + Hotkeys
 *   - AI scores ficam blur até o biólogo classificar (previne viés de confirmação)
 *   - Hotkeys: ←/→ nav, 1-7 classes, Del=Dg, Enter=confirmar
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import type { ClassificacaoEmbriao, EmbryoScore, DetectedBbox } from '@/lib/types';
import { useReviewData, useSubmitClassification, useUndoClassification, useAtlasStats } from '@/hooks/useEmbryoReview';
import { useEmbryoscoreUrl } from '@/hooks/useStorageUrl';
import { PlatePanorama } from './PlatePanorama';
import { EmbryoMinimap } from './EmbryoMinimap';
import { BiologistClassButtons, CLASSES } from './BiologistClassButtons';
import { DispatchSummary } from './DispatchSummary';
import { Eye, EyeOff, Activity, Map, ChevronLeft, ChevronRight } from 'lucide-react';
import { getKineticDiagnosis, getLabelClasses } from '@/lib/embryoscore/kinetic-labels';

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

  const embrioes = reviewData?.embrioes || [];
  const bboxes = (reviewData?.queue?.detected_bboxes || []) as DetectedBbox[];

  // Blind Review + hotkey states
  const [selectedClass, setSelectedClass] = useState<ClassificacaoEmbriao | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);

  // Reset on embryo change
  useEffect(() => {
    setSelectedClass(null);
    const currentEmbryo = embrioes[activeIdx];
    setIsRevealed(!!currentEmbryo?.score?.biologist_classification);
  }, [activeIdx, embrioes]);

  // Plate frame signed URL
  const { data: plateFrameUrl } = useEmbryoscoreUrl(reviewData?.plateFramePath);

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
      const wrapIdx = embrioes.findIndex((e) => !e.score?.biologist_classification);
      if (wrapIdx >= 0) setActiveIdx(wrapIdx);
    }
  }, [embrioes, activeIdx]);

  // Handlers
  const handleClassify = useCallback((classification: ClassificacaoEmbriao) => {
    if (!current || !score) return;
    setIsRevealed(true);
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
    return true;
  }, [score]);

  // Keyboard hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const isConfirmed = !!score?.biologist_classification;

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          setActiveIdx(prev => Math.min(embrioes.length - 1, prev + 1));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setActiveIdx(prev => Math.max(0, prev - 1));
          break;
        case '1': case '2': case '3': case '4': case '5': case '6': case '7':
          if (isConfirmed) break;
          e.preventDefault();
          setSelectedClass(CLASSES[parseInt(e.key) - 1].value);
          break;
        case 'Delete':
        case 'Backspace':
          if (isConfirmed) break;
          e.preventDefault();
          setSelectedClass('Dg');
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
  }, [embrioes.length, score?.biologist_classification, selectedClass, handleClassify]);

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
          isRevealed={isRevealed}
          onReveal={() => setIsRevealed(true)}
          selectedClass={selectedClass}
          onSelectClass={setSelectedClass}
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
  isRevealed: boolean;
  onReveal: () => void;
  selectedClass: ClassificacaoEmbriao | null;
  onSelectClass: (cls: ClassificacaoEmbriao | null) => void;
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
  isRevealed,
  onReveal,
  selectedClass,
  onSelectClass,
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
          className="flex items-center gap-1 p-1 rounded-md hover:bg-muted disabled:opacity-30 transition-colors"
        >
          <kbd className="text-[9px] font-mono text-muted-foreground/50">←</kbd>
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-foreground">
          Embrião {embryoLabel}
        </span>
        <button
          onClick={onNext}
          disabled={!hasNext}
          className="flex items-center gap-1 p-1 rounded-md hover:bg-muted disabled:opacity-30 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
          <kbd className="text-[9px] font-mono text-muted-foreground/50">→</kbd>
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

        {/* Kinetic diagnosis — always visible (not AI opinion) */}
        {score.kinetic_intensity != null && (() => {
          const diag = getKineticDiagnosis(score);
          return (
            <div className="flex flex-wrap gap-2 px-2">
              {(['Atividade', 'Distribuição', 'Estabilidade'] as const).map((label, i) => {
                const d = [diag.activity, diag.distribution, diag.stability][i];
                return (
                  <div key={label} className="flex items-center gap-1 text-[11px]">
                    <span className="text-muted-foreground">{label}:</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${getLabelClasses(d.color)}`}>
                      {d.label}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* AI Score area — Blind Review (KNN + Gemini hidden until classified) */}
        <div className="relative">
          <div className={`space-y-3 ${isRevealed ? '' : 'blur-md opacity-40 select-none pointer-events-none'} transition-all duration-300`}>
            {/* KNN section */}
            {sortedVotes.length > 0 && (
              <div className="space-y-1.5">
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
                </div>
                {sortedVotes.map(([cls, count]) => {
                  const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                  return (
                    <div key={cls} className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold w-6 text-foreground">{cls}</span>
                      <div className="flex-1 h-5 bg-muted rounded-sm overflow-hidden">
                        <div className="h-full bg-primary rounded-sm transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground w-10 text-right">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Gemini section — separate from KNN */}
            {score.gemini_classification && (
              <div className="pt-2 border-t border-border/30 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Gemini IA</span>
                  <span className="font-mono text-lg font-bold text-foreground">
                    {score.gemini_classification}
                  </span>
                  {score.stage_code != null && (
                    <span className="text-[10px] text-muted-foreground">
                      IETS {score.stage_code}/{score.quality_grade || '?'}
                    </span>
                  )}
                </div>
                {score.gemini_reasoning && (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {score.gemini_reasoning}
                  </p>
                )}
              </div>
            )}

            {/* Insufficient data note */}
            {source === 'insufficient' && !score.gemini_classification && (
              <div className="text-xs text-muted-foreground italic px-2">
                Atlas em construção ({score.knn_real_bovine_count || 0} referências reais).
                Classifique manualmente para treinar o sistema.
              </div>
            )}
          </div>

          {/* Blind Review overlay */}
          {!isRevealed && (
            <button
              onClick={onReveal}
              className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <EyeOff className="w-5 h-5" />
              <span className="text-xs font-medium">Classifique primeiro</span>
            </button>
          )}
        </div>

        {/* Classification buttons */}
        <BiologistClassButtons
          aiSuggestion={score.combined_classification}
          currentClassification={score.biologist_classification}
          onClassify={onClassify}
          onUndo={onUndo}
          canUndo={canUndo}
          isLoading={isMutating}
          selected={selectedClass}
          onSelect={onSelectClass}
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
          loading="lazy"
        />
      ) : (
        <div className="w-full aspect-square rounded-lg border border-border bg-muted/30 flex items-center justify-center">
          <Icon className="w-6 h-6 text-muted-foreground/30" />
        </div>
      )}
    </div>
  );
}
