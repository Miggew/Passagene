/**
 * Bancada — Desktop workbench for reviewing embryo plates.
 *
 * State 1: Job list grouped by Lote FIV (collapsible sections)
 * State 2: FullscreenPlateView (frame + SVG markers + floating card)
 *
 * Hotkeys: ←/→ nav, 1-7 classes, Del=Dg, Enter=confirm
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Microscope, Play, ExternalLink, Check, AlertTriangle, Clock, Loader2, RefreshCw, ChevronDown, MoreVertical } from 'lucide-react';
import { format } from 'date-fns';
import { formatElapsed } from '@/hooks/useJobStatus';
import PageHeader from '@/components/shared/PageHeader';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { FullscreenPlateView } from '@/components/bancada/FullscreenPlateView';
import { useBancadaJobs, groupJobsByLote } from '@/hooks/useBancadaJobs';
import type { BancadaJob } from '@/hooks/useBancadaJobs';
import { supabase } from '@/lib/supabase';
import { triggerAnalysis } from '@/hooks/useAnalyzeEmbryo';
import { useToast } from '@/hooks/use-toast';

// ─── Job Card ────────────────────────────────────────────

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

  const hasMenuActions = job.status === 'pending' || job.status === 'failed' || job.status === 'completed';

  return (
    <div
      onClick={onSelect}
      className="rounded-lg border-l-4 border-l-primary/30 border border-border bg-card/50 shadow-sm p-3 pl-4 cursor-pointer hover:border-l-primary/60 hover:bg-card/80 transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {statusIcon}
            <span className="font-medium text-foreground truncate text-sm">
              {job.doadora_nome || 'Doadora'} &times; {job.dose_nome || 'Touro'}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span>{job.embryo_count} embriões</span>
            <span>&middot;</span>
            <span>{dateStr}</span>
            <span>&middot;</span>
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

        {/* Classify button (visible) + overflow menu for maintenance actions */}
        <div className="flex items-center gap-1 shrink-0">
          {!hasClassification && job.status === 'pending' && (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleQuickClassify}>
              <ExternalLink className="w-3 h-3 mr-1" />
              Classificar
            </Button>
          )}
          {hasMenuActions && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className="p-1 rounded-md text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/50 transition-colors"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                {(job.status === 'pending' || job.status === 'failed') && (
                  <DropdownMenuItem onClick={handleProcessWithoutClassification}>
                    <Play className="w-3.5 h-3.5 mr-2" />
                    {job.status === 'failed' ? 'Reprocessar IA' : 'Processar sem classificação'}
                  </DropdownMenuItem>
                )}
                {job.status === 'completed' && (
                  <DropdownMenuItem onClick={handleReprocess}>
                    <RefreshCw className="w-3.5 h-3.5 mr-2" />
                    Reprocessar IA
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Lote Group (Collapsible) ────────────────────────────

function LoteGroup({
  loteId,
  dataAbertura,
  fazendaNome,
  loteStatus,
  diaAtual,
  jobs,
  totalEmbryos,
  totalClassified,
  defaultOpen,
  onSelectJob,
}: {
  loteId: string | null;
  dataAbertura: string | null;
  fazendaNome: string | null;
  loteStatus: string | null;
  diaAtual: number | null;
  jobs: BancadaJob[];
  totalEmbryos: number;
  totalClassified: number;
  defaultOpen: boolean;
  onSelectJob: (jobId: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const progressPct = totalEmbryos > 0 ? Math.round((totalClassified / totalEmbryos) * 100) : 0;

  // Unique doadora names from jobs
  const doadoraNames = [...new Set(jobs.map(j => j.doadora_nome).filter(Boolean))] as string[];

  const isAberto = loteStatus === 'ABERTO';

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border glass-panel hover:border-primary/20 transition-all text-left">
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 ${
              open ? '' : '-rotate-90'
            }`}
          />
          <div className="flex-1 min-w-0">
            {/* Line 1: Fazenda + date + status + Dx */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground">
                {loteId
                  ? fazendaNome || 'Lote FIV'
                  : 'Sem lote'}
              </span>
              {dataAbertura && (
                <span className="text-xs text-muted-foreground">
                  {format(new Date(dataAbertura + 'T12:00:00'), 'dd/MM/yyyy')}
                </span>
              )}
              {loteStatus && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                  isAberto
                    ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                    : 'bg-muted text-muted-foreground border border-border'
                }`}>
                  {isAberto ? 'Aberto' : 'Fechado'}
                </span>
              )}
              {diaAtual != null && isAberto && (
                <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                  D{diaAtual}
                </span>
              )}
            </div>
            {/* Line 2: stats + doadoras */}
            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
              <span>{jobs.length} acasalamento{jobs.length !== 1 ? 's' : ''}</span>
              <span>&middot;</span>
              <span>{totalEmbryos} embriões</span>
              {doadoraNames.length > 0 && (
                <>
                  <span>&middot;</span>
                  <span className="truncate max-w-[280px]" title={doadoraNames.join(', ')}>
                    {doadoraNames.join(', ')}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground">{progressPct}%</span>
            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="grid gap-2 pl-4 mt-2">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} onSelect={() => onSelectJob(job.id)} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Main Page ────────────────────────────────────────────

export default function Bancada() {
  const { data: jobs, isLoading } = useBancadaJobs();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const loteGroups = useMemo(() => {
    if (!jobs?.length) return [];
    return groupJobsByLote(jobs);
  }, [jobs]);

  // Fullscreen plate view
  if (selectedJobId) {
    return (
      <FullscreenPlateView
        queueId={selectedJobId}
        onBack={() => setSelectedJobId(null)}
      />
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

      {loteGroups.length > 0 && (
        <div className="space-y-3">
          {loteGroups.map((group, idx) => (
            <LoteGroup
              key={group.lote_fiv_id || 'orphan'}
              loteId={group.lote_fiv_id}
              dataAbertura={group.data_abertura}
              fazendaNome={group.fazenda_nome}
              loteStatus={group.lote_status}
              diaAtual={group.dia_atual}
              jobs={group.jobs}
              totalEmbryos={group.total_embryos}
              totalClassified={group.total_classified}
              defaultOpen={idx < 3}
              onSelectJob={setSelectedJobId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
