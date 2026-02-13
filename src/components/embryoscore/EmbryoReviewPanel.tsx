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
import { useReviewData, useSubmitClassification, useUndoClassification, useAtlasStats, useDispatchLote } from '@/hooks/useEmbryoReview';
import { useEmbryoscoreUrl } from '@/hooks/useStorageUrl';
import { useNavigate } from 'react-router-dom';
import { PlatePanorama } from './PlatePanorama';
import { EmbryoMinimap } from './EmbryoMinimap';
import { BiologistClassButtons } from './BiologistClassButtons';
import { DispatchSummary } from './DispatchSummary';
import { Button, Card, Badge } from '@/components/ui/mobile-atoms'; // DS v4
import { Eye, Activity, Map, ChevronLeft, ChevronRight, BrainCircuit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const SOURCE_LABELS: Record<string, { icon: React.ReactNode; text: string; color: string }> = {
  knn: { icon: <BrainCircuit className="w-3.5 h-3.5" />, text: 'Consenso Atlas', color: 'text-primary' },
  knn_mlp_agree: { icon: <BrainCircuit className="w-3.5 h-3.5" />, text: 'KNN + Classificador concordam', color: 'text-primary' },
  knn_mlp_disagree: { icon: <BrainCircuit className="w-3.5 h-3.5" />, text: 'KNN vs Classificador divergem', color: 'text-amber-500' },
  mlp_only: { icon: <BrainCircuit className="w-3.5 h-3.5" />, text: 'Sugestão do classificador', color: 'text-blue-500' },
  insufficient: { icon: <BrainCircuit className="w-3.5 h-3.5" />, text: 'Classifique manualmente', color: 'text-muted-foreground' },
};

interface EmbryoReviewPanelProps {
  queueId: string;
}

export function EmbryoReviewPanel({ queueId }: EmbryoReviewPanelProps) {
  const { data: reviewData, isLoading } = useReviewData(queueId);
  const submitMutation = useSubmitClassification();
  const undoMutation = useUndoClassification();
  const dispatchMutation = useDispatchLote();
  const { data: atlasStats } = useAtlasStats();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [activeIdx, setActiveIdx] = useState(0);

  // Plate frame signed URL
  const { data: plateFrameUrl } = useEmbryoscoreUrl(reviewData?.plateFramePath);

  const embrioes = reviewData?.embrioes || [];
  const bboxes = (reviewData?.queue?.detected_bboxes || []) as DetectedBbox[];

  const statuses = useMemo(() =>
    embrioes.map((e, i) => {
      if (i === activeIdx) return 'active' as const;
      if (e.score?.biologist_classification) return 'classified' as const;
      return 'pending' as const;
    }),
    [embrioes, activeIdx],
  );

  const classifiedCount = embrioes.filter(e => e.score?.biologist_classification).length;
  const totalCount = embrioes.length;
  const allClassified = totalCount > 0 && classifiedCount === totalCount;

  const current = embrioes[activeIdx];
  const score = current?.score;

  const goToNextPending = useCallback(() => {
    const nextIdx = embrioes.findIndex((e, i) => i > activeIdx && !e.score?.biologist_classification);
    if (nextIdx >= 0) {
      setActiveIdx(nextIdx);
    } else {
      const wrapIdx = embrioes.findIndex((e) => !e.score?.biologist_classification);
      if (wrapIdx >= 0) setActiveIdx(wrapIdx);
    }
  }, [embrioes, activeIdx]);

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

  const handleDispatch = useCallback(() => {
    dispatchMutation.mutate(queueId, {
      onSuccess: () => {
        toast({
          title: "Lote Despachado!",
          description: "Os embriões já estão disponíveis para transferência no campo.",
        });
        navigate('/lab/lotes-fiv');
      },
      onError: (err: any) => {
        toast({
          title: "Erro ao despachar",
          description: err.message,
          variant: "destructive",
        });
      }
    });
  }, [queueId, dispatchMutation, navigate, toast]);

  const canUndo = useMemo(() => {
    if (!score?.biologist_classification || !score?.created_at) return false;
    return true; 
  }, [score]);

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-card rounded-lg w-1/3" />
        <div className="h-48 bg-card rounded-2xl" />
        <div className="h-64 bg-card rounded-2xl" />
      </div>
    );
  }

  if (!reviewData || embrioes.length === 0) {
    return (
      <Card className="p-12 text-center flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <BrainCircuit className="w-8 h-8 text-muted-foreground/40" />
        </div>
        <p className="font-sans text-muted-foreground">Nenhum embrião para revisar nesta sessão.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header with progress */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-xl font-display font-black text-foreground tracking-tightest">
            Mesa de Conferência
          </h2>
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground opacity-70">
            Validação de IA • {reviewData.queue?.expected_count} embriões
          </p>
        </div>
        
        <div className="text-right">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Progresso</span>
            <span className="font-display font-black text-lg leading-none">{classifiedCount}/{totalCount}</span>
          </div>
          <div className="w-32 h-1.5 bg-muted rounded-full overflow-hidden border border-border/50">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(52,211,153,0.4)]"
              style={{ width: `${totalCount > 0 ? (classifiedCount / totalCount) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Plate Panorama - View da Placa Completa */}
      <div className="relative">
        <div className="absolute -top-3 left-4 px-2 py-0.5 bg-background border border-border rounded text-[9px] font-mono font-bold uppercase tracking-widest text-muted-foreground z-10">
          Mapa da Placa
        </div>
        <PlatePanorama
          plateFrameUrl={plateFrameUrl}
          bboxes={bboxes}
          statuses={statuses}
          activeIndex={activeIdx}
          onSelect={setActiveIdx}
        />
      </div>

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
          onConfirmDispatch={handleDispatch}
          isLoading={dispatchMutation.isPending}
        />
      )}
    </div>
  );
}

// ─── EmbryoDetailCard (internal) ───

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
}: any) {
  const { data: cropUrl } = useEmbryoscoreUrl(score.crop_image_path);
  const { data: motionUrl } = useEmbryoscoreUrl(score.motion_map_path);

  const source = score.combined_source || 'insufficient';
  const sourceInfo = SOURCE_LABELS[source] || SOURCE_LABELS.insufficient;

  const votes = score.knn_votes || {};
  const totalVotes = Object.values(votes).reduce((sum: any, v: any) => sum + v, 0);
  const sortedVotes = Object.entries(votes).sort((a: any, b: any) => b[1] - a[1]);

  return (
    <Card className="overflow-hidden border-primary/20 shadow-glow bg-card/50 backdrop-blur-md" glow>
      {/* Navigation Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-primary/5 border-b border-primary/10">
        <Button variant="ghost" size="icon" onClick={onPrev} disabled={!hasPrev} className="h-8 w-8">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="text-center">
          <h3 className="font-display font-black text-xl tracking-tightest leading-none">
            Embrião {embryoLabel}
          </h3>
        </div>
        <Button variant="ghost" size="icon" onClick={onNext} disabled={!hasNext} className="h-8 w-8">
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      <div className="p-5 space-y-6">
        {/* Images Row */}
        <div className="grid grid-cols-3 gap-4">
          <ImageTile label="Morfologia" url={cropUrl} icon={Eye} />
          <ImageTile label="Atividade" url={motionUrl} icon={Activity} />
          <div className="flex flex-col items-center gap-2">
            <span className="text-[9px] font-mono font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Map className="w-3 h-3" /> Posição
            </span>
            <div className="w-full aspect-square rounded-xl overflow-hidden border border-border bg-muted/20">
              <EmbryoMinimap
                plateFrameUrl={plateFrameUrl}
                bboxes={bboxes}
                currentIndex={currentIndex}
              />
            </div>
          </div>
        </div>

        {/* AI Insight Header */}
        <div className="flex items-center justify-between pt-2 border-t border-border/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary">
              {sourceInfo.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-black text-2xl tracking-tightest text-primary leading-none">
                  {score.combined_classification || '??'}
                </span>
                {score.combined_confidence != null && (
                  <Badge variant="outline" className="font-mono text-[10px] h-5 border-primary/30 text-primary/80">
                    {score.combined_confidence}%
                  </Badge>
                )}
              </div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground opacity-70 mt-1">
                {sourceInfo.text}
              </p>
            </div>
          </div>
          
          {source === 'knn_mlp_agree' && (
            <div className="px-3 py-1 rounded-lg bg-primary/10 border border-primary/20 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[9px] font-mono font-bold text-primary uppercase tracking-widest">IA Validada</span>
            </div>
          )}
        </div>

        {/* KNN Voting Bars */}
        {sortedVotes.length > 0 && (
          <div className="grid grid-cols-1 gap-2.5 p-4 rounded-xl bg-muted/30 border border-border/50">
            {sortedVotes.map(([cls, count]: any) => {
              const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
              return (
                <div key={cls} className="flex items-center gap-3">
                  <span className="font-display font-black text-xs w-6 text-foreground text-center">{cls}</span>
                  <div className="flex-1 h-2 bg-background rounded-full overflow-hidden border border-border/30">
                    <div
                      className="h-full bg-primary transition-all duration-700 ease-out shadow-[0_0_8px_rgba(52,211,153,0.3)]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="font-mono text-[10px] font-bold text-muted-foreground w-8 text-right tracking-tighter">{pct}%</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Feedback Section */}
        <div className="pt-2 border-t border-border/30">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest">Seu Veredito</span>
            <span className="text-[9px] font-mono text-muted-foreground italic">
              Seu voto ensina a IA automaticamente
            </span>
          </div>
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
    </Card>
  );
}

function ImageTile({ label, url, icon: Icon }: any) {
  return (
    <div className="flex flex-col items-center gap-2 group">
      <span className="text-[9px] font-mono font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
        <Icon className="w-3 h-3 transition-colors group-hover:text-primary" /> {label}
      </span>
      <div className="relative w-full aspect-square rounded-xl overflow-hidden border border-border bg-muted/20 transition-all group-hover:border-primary/30 group-hover:shadow-glow">
        {url ? (
          <img src={url} alt={label} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Icon className="w-8 h-8 text-muted-foreground/20 animate-pulse" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
      </div>
    </div>
  );
}

