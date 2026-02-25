/**
 * Bancada — Desktop workbench for reviewing embryo plates.
 *
 * State 1: Job list (cards showing each plate/queue)
 * State 2: Plate detail — split-panel layout:
 *   Left:  PlatePanorama (sticky) + concordance + embryo table
 *   Right: BancadaEmbryoDetailPanel (rich detail + classification buttons)
 *
 * Hotkeys: ←/→ nav, 1-7 classes, Del=Dg, Enter=confirm
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Microscope, ArrowLeft, Play, ExternalLink, Check, AlertTriangle, Clock, Loader2, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { formatElapsed } from '@/hooks/useJobStatus';
import PageHeader from '@/components/shared/PageHeader';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { PlatePanorama } from '@/components/embryoscore/PlatePanorama';
import { CLASSES } from '@/components/embryoscore/BiologistClassButtons';
import { BancadaEmbryoDetailPanel } from '@/components/bancada/BancadaEmbryoDetailPanel';
import { useEmbryoscoreUrl } from '@/hooks/useStorageUrl';
import { useBancadaJobs, useBancadaPlate } from '@/hooks/useBancadaJobs';
import type { BancadaJob } from '@/hooks/useBancadaJobs';
import { useSubmitClassification, useUndoClassification } from '@/hooks/useEmbryoReview';
import { supabase } from '@/lib/supabase';
import { triggerAnalysis } from '@/hooks/useAnalyzeEmbryo';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import type { ClassificacaoEmbriao } from '@/lib/types';

// ─── Job List ────────────────────────────────────────────

function ElapsedTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [startedAt]);
  return <span>{formatElapsed(elapsed)}</span>;
}

function JobCard({ job, onSelect }: { job: BancadaJob; onSelect: () => void }) {
  const { toast } = useToast();
  const navigate = useNavigate();

  const statusIcon = job.status === 'completed'
    ? <Check className="w-4 h-4 text-green-500" />
    : job.status === 'processing'
      ? <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
      : job.status === 'failed'
        ? <AlertTriangle className="w-4 h-4 text-red-500" />
        : <Clock className="w-4 h-4 text-muted-foreground" />;

  const handleProcessWithoutClassification = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const result = await triggerAnalysis(job.id);
    if (result.success) {
      toast({ title: 'Análise iniciada (OpenCV)' });
    } else {
      toast({ title: 'Erro ao iniciar análise', variant: 'destructive' });
    }
  };

  const handleReprocess = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase
      .from('embryo_analysis_queue')
      .update({ status: 'pending', started_at: null, completed_at: null, error_message: null })
      .eq('id', job.id);
    if (error) {
      toast({ title: 'Erro ao resetar job', variant: 'destructive' });
      return;
    }
    const result = await triggerAnalysis(job.id);
    if (result.success) {
      toast({ title: 'Reprocessamento iniciado' });
    } else {
      toast({ title: 'Erro ao iniciar reprocessamento', variant: 'destructive' });
    }
  };

  const handleQuickClassify = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/bancada/rapida/${job.id}`);
  };

  const hasClassification = (job.classified_count || 0) > 0;
  const dateStr = format(new Date(job.created_at), 'dd/MM HH:mm');

  return (
    <div
      onClick={onSelect}
      className="rounded-xl border border-border glass-panel shadow-sm p-4 cursor-pointer hover:border-primary/20 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {statusIcon}
            <span className="font-medium text-foreground truncate">
              {job.doadora_nome || 'Doadora'} &times; {job.dose_nome || 'Touro'}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground">
            <span>{job.embryo_count} embriões</span>
            <span>&middot;</span>
            <span>{dateStr}</span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span>
              Rápida: {hasClassification
                ? `${job.classified_count}/${job.embryo_count} \u2713`
                : '\u2014'}
            </span>
            <span>&middot;</span>
            <span>
              IA: {job.status === 'completed'
                ? (() => {
                    const dur = job.started_at && job.completed_at
                      ? Math.floor((new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000)
                      : null;
                    return dur !== null ? `pronto (${formatElapsed(dur)})` : 'pronto';
                  })()
                : job.status === 'processing' && job.started_at
                  ? <><span>processando </span><ElapsedTimer startedAt={job.started_at} /></>
                  : job.status === 'failed'
                    ? 'erro'
                    : 'pendente'}
            </span>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      {(job.status === 'pending' || job.status === 'failed') && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
          {!hasClassification && job.status === 'pending' && (
            <Button variant="outline" size="sm" onClick={handleQuickClassify}>
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              Classificar
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleProcessWithoutClassification}>
            <Play className="w-3.5 h-3.5 mr-1.5" />
            {job.status === 'failed' ? 'Reprocessar' : 'Processar sem IA'}
          </Button>
        </div>
      )}
      {job.status === 'completed' && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
          <Button variant="outline" size="sm" onClick={handleReprocess}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Reprocessar
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Plate Detail (Split-Panel) ──────────────────────────

function PlateDetail({ queueId, onBack }: { queueId: string; onBack: () => void }) {
  const { data, isLoading } = useBancadaPlate(queueId);
  const { data: plateFrameUrl } = useEmbryoscoreUrl(data?.job?.plate_frame_path);
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [selectedClass, setSelectedClass] = useState<ClassificacaoEmbriao | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const submitMutation = useSubmitClassification();
  const undoMutation = useUndoClassification();

  const embryos = data?.embryos || [];
  const job = data?.job;

  // Reset selection when embryo changes
  useEffect(() => {
    setSelectedClass(null);
  }, [selectedIdx]);

  // Computed values
  const bboxes = useMemo(() => job?.manual_bboxes || job?.detected_bboxes || [], [job]);
  const detectedCount = (job?.detected_bboxes || []).length;
  const expectedCount = job?.expected_count || embryos.length;
  const hasMismatch = job?.status === 'completed' && detectedCount > 0 && detectedCount < expectedCount;

  // Concordance stats
  const { concordCount, divergeCount } = useMemo(() => {
    let conc = 0;
    let div = 0;
    for (const emb of embryos) {
      if (emb.classificacao && emb.score?.gemini_classification) {
        if (emb.classificacao === emb.score.gemini_classification) conc++;
        else div++;
      }
    }
    return { concordCount: conc, divergeCount: div };
  }, [embryos]);

  // Statuses for PlatePanorama
  const statuses = useMemo(() =>
    embryos.map((emb, i) => {
      if (i === selectedIdx) return 'active' as const;
      if (emb.score?.biologist_classification || emb.classificacao) return 'classified' as const;
      return 'pending' as const;
    }),
    [embryos, selectedIdx],
  );

  // Classification progress
  const classifiedCount = embryos.filter(e => e.score?.biologist_classification || e.classificacao).length;

  // Navigate to next unclassified
  const goToNextPending = useCallback(() => {
    const nextIdx = embryos.findIndex((e, i) => i > selectedIdx && !e.score?.biologist_classification && !e.classificacao);
    if (nextIdx >= 0) {
      setSelectedIdx(nextIdx);
    } else {
      const wrapIdx = embryos.findIndex((e) => !e.score?.biologist_classification && !e.classificacao);
      if (wrapIdx >= 0) setSelectedIdx(wrapIdx);
    }
  }, [embryos, selectedIdx]);

  // Classification handler — uses useSubmitClassification (feeds atlas)
  const handleClassify = useCallback((cls: ClassificacaoEmbriao) => {
    const emb = embryos[selectedIdx];
    if (!emb) return;

    const score = emb.score;
    if (score?.id) {
      // Use the full submit path (updates score + feeds atlas)
      submitMutation.mutate({
        scoreId: score.id,
        embriaoId: emb.id,
        classification: cls,
        queueId,
      }, {
        onSuccess: () => {
          // Also update the embryo classificacao
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
      // Fallback: no score — just update embryo directly
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
    const emb = embryos[selectedIdx];
    if (!emb?.score?.id) return;
    undoMutation.mutate({
      scoreId: emb.score.id,
      embriaoId: emb.id,
      queueId,
    }, {
      onSuccess: () => {
        // Also clear embryo classificacao
        supabase.from('embrioes').update({
          classificacao: null,
          data_classificacao: null,
        }).eq('id', emb.id).then(() => {
          queryClient.invalidateQueries({ queryKey: ['bancada-plate', queueId] });
        });
      },
    });
  }, [embryos, selectedIdx, queueId, undoMutation, queryClient]);

  // Keyboard hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const currentEmb = embryos[selectedIdx];
      const isConfirmed = !!(currentEmb?.score?.biologist_classification);

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          setSelectedIdx(prev => Math.min(embryos.length - 1, prev + 1));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setSelectedIdx(prev => Math.max(0, prev - 1));
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
  }, [embryos, selectedIdx, selectedClass, handleClassify]);

  if (isLoading) return <LoadingSpinner />;
  if (!job) return <p className="text-sm text-muted-foreground p-6">Job não encontrado</p>;

  const currentEmb = embryos[selectedIdx];

  return (
    <div className="h-[calc(100vh-80px)] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-1 pb-3 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{classifiedCount}/{embryos.length} classificados</span>
          <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${embryos.length > 0 ? (classifiedCount / embryos.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Detection mismatch warning */}
      {hasMismatch && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 mb-3 shrink-0">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              Detectados {detectedCount}/{expectedCount} embriões
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/bancada/rapida/${queueId}`)}
            className="shrink-0"
          >
            Corrigir
          </Button>
        </div>
      )}

      {/* Split-panel layout */}
      <PanelGroup direction="horizontal" className="flex-1 rounded-xl border border-border overflow-hidden">
        {/* Left Panel — PlatePanorama + Concordance + Table */}
        <Panel defaultSize={40} minSize={25}>
          <div className="h-full flex flex-col overflow-hidden">
            {/* Sticky PlatePanorama */}
            {bboxes.length > 0 && (
              <div className="shrink-0 border-b border-border">
                <PlatePanorama
                  plateFrameUrl={plateFrameUrl}
                  bboxes={bboxes}
                  statuses={statuses}
                  activeIndex={selectedIdx}
                  onSelect={setSelectedIdx}
                />
              </div>
            )}

            {/* Concordance */}
            {(concordCount > 0 || divergeCount > 0) && (
              <div className="flex items-center gap-3 px-3 py-2 border-b border-border text-xs shrink-0">
                <span className="text-green-600">{concordCount}/{concordCount + divergeCount} concordam</span>
                {divergeCount > 0 && (
                  <span className="text-amber-600">{divergeCount} divergências</span>
                )}
              </div>
            )}

            {/* Embryo table — scrollable */}
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-muted/80 backdrop-blur-sm border-b border-border">
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">#</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">ID</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Rápida</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Gemini</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {embryos.map((emb, idx) => {
                    const rapida = emb.classificacao || '\u2014';
                    const gemini = emb.score?.gemini_classification || '\u2014';
                    const match = emb.classificacao && emb.score?.gemini_classification
                      ? emb.classificacao === emb.score.gemini_classification
                      : null;
                    const isSelected = selectedIdx === idx;

                    return (
                      <tr
                        key={emb.id}
                        onClick={() => setSelectedIdx(idx)}
                        className={`border-b border-border cursor-pointer transition-colors ${
                          isSelected ? 'bg-primary/10' : 'hover:bg-muted/30'
                        }`}
                      >
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{idx + 1}</td>
                        <td className="px-3 py-2 font-mono text-xs truncate max-w-[80px]">{emb.identificacao || emb.id.slice(0, 8)}</td>
                        <td className="px-3 py-2">
                          <span className="font-mono font-bold text-xs">{rapida}</span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="font-mono font-bold text-xs">{gemini}</span>
                        </td>
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
          </div>
        </Panel>

        {/* Resize Handle */}
        <PanelResizeHandle className="w-1.5 bg-border hover:bg-primary/20 rounded-full transition-colors data-[resize-handle-active]:bg-primary/30" />

        {/* Right Panel — Detail */}
        <Panel defaultSize={60} minSize={35}>
          {currentEmb ? (
            <BancadaEmbryoDetailPanel
              embryoId={currentEmb.id}
              embryoLabel={currentEmb.identificacao || `#${selectedIdx + 1}`}
              classificacao={currentEmb.classificacao}
              score={currentEmb.score || null}
              onClassify={handleClassify}
              onUndo={handleUndo}
              canUndo={!!currentEmb.score?.biologist_classification}
              isLoading={submitMutation.isPending || undoMutation.isPending}
              onPrev={() => setSelectedIdx(Math.max(0, selectedIdx - 1))}
              onNext={() => setSelectedIdx(Math.min(embryos.length - 1, selectedIdx + 1))}
              hasPrev={selectedIdx > 0}
              hasNext={selectedIdx < embryos.length - 1}
              selectedClass={selectedClass}
              onSelectClass={setSelectedClass}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              Selecione um embrião na tabela
            </div>
          )}
        </Panel>
      </PanelGroup>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────

export default function Bancada() {
  const { data: jobs, isLoading } = useBancadaJobs();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  if (selectedJobId) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <PlateDetail queueId={selectedJobId} onBack={() => setSelectedJobId(null)} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <PageHeader title="Bancada" icon={Microscope} description="Classificação e revisão de embriões" />

      {isLoading && <LoadingSpinner />}

      {!isLoading && (!jobs || jobs.length === 0) && (
        <EmptyState
          title="Nenhum job de análise"
          description="Despache embriões em Lotes FIV para iniciar"
        />
      )}

      {jobs && jobs.length > 0 && (
        <div className="grid gap-3">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} onSelect={() => setSelectedJobId(job.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
