/**
 * Bancada — Desktop workbench for reviewing embryo plates.
 *
 * State 1: Job list (cards showing each plate/queue)
 * State 2: Plate detail (PlatePanorama + concordance table + inline reclassification)
 */

import { useState, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { Microscope, ArrowLeft, Play, ExternalLink, Check, AlertTriangle, Clock, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { formatElapsed } from '@/hooks/useJobStatus';
import PageHeader from '@/components/shared/PageHeader';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { PlatePanorama } from '@/components/embryoscore/PlatePanorama';
import { CLASSES } from '@/components/embryoscore/BiologistClassButtons';
import { useEmbryoscoreUrl } from '@/hooks/useStorageUrl';
import { useBancadaJobs, useBancadaPlate } from '@/hooks/useBancadaJobs';
import type { BancadaJob, BancadaPlateEmbryo } from '@/hooks/useBancadaJobs';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import type { ClassificacaoEmbriao } from '@/lib/types';
import { getKineticDiagnosis, getLabelClasses } from '@/lib/embryoscore/kinetic-labels';

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
    try {
      await supabase.functions.invoke('embryo-analyze', {
        body: { queue_id: job.id },
      });
      toast({ title: 'Análise iniciada (OpenCV)' });
    } catch {
      toast({ title: 'Erro ao iniciar análise', variant: 'destructive' });
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

      {/* Action buttons for pending/failed jobs */}
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
    </div>
  );
}

// ─── Plate Detail ─────────────────────────────────────────

function PlateDetail({ queueId, onBack }: { queueId: string; onBack: () => void }) {
  const { data, isLoading } = useBancadaPlate(queueId);
  const { data: plateFrameUrl } = useEmbryoscoreUrl(data?.job?.plate_frame_path);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  if (isLoading) return <LoadingSpinner />;
  if (!data?.job) return <p className="text-sm text-muted-foreground p-6">Job não encontrado</p>;

  const { job, embryos } = data;
  const bboxes = job.manual_bboxes || job.detected_bboxes || [];
  const detectedCount = (job.detected_bboxes || []).length;
  const expectedCount = job.expected_count || embryos.length;
  const hasMismatch = job.status === 'completed' && detectedCount > 0 && detectedCount < expectedCount;

  // Concordance stats
  let concordCount = 0;
  let divergeCount = 0;
  for (const emb of embryos) {
    if (emb.classificacao && emb.score?.gemini_classification) {
      if (emb.classificacao === emb.score.gemini_classification) concordCount++;
      else divergeCount++;
    }
  }

  const statuses = embryos.map((emb) =>
    emb.classificacao ? 'classified' as const : 'pending' as const
  );

  const handleReclassify = async (embryoId: string, cls: ClassificacaoEmbriao) => {
    const { error } = await supabase.from('embrioes').update({
      classificacao: cls,
      data_classificacao: new Date().toISOString(),
    }).eq('id', embryoId);
    if (error) { toast({ title: 'Erro ao reclassificar', variant: 'destructive' }); throw error; }
    toast({ title: `Reclassificado como ${cls}` });
    setExpandedIdx(null);
  };

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar
      </button>

      {/* Detection mismatch warning */}
      {hasMismatch && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              Detectados {detectedCount}/{expectedCount} embriões
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {expectedCount - detectedCount} embrião(ões) não detectado(s) automaticamente
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/bancada/rapida/${queueId}`)}
            className="shrink-0"
          >
            Corrigir marcações
          </Button>
        </div>
      )}

      {/* Plate panorama */}
      {bboxes.length > 0 && (
        <PlatePanorama
          plateFrameUrl={plateFrameUrl}
          bboxes={bboxes}
          statuses={statuses}
          activeIndex={expandedIdx ?? -1}
          onSelect={(i) => setExpandedIdx(i === expandedIdx ? null : i)}
        />
      )}

      {/* Summary */}
      {(concordCount > 0 || divergeCount > 0) && (
        <div className="flex items-center gap-4 text-sm">
          <span className="text-green-600">{concordCount}/{concordCount + divergeCount} concordam</span>
          {divergeCount > 0 && (
            <span className="text-amber-600">{divergeCount} divergências</span>
          )}
        </div>
      )}

      {/* Embryo table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">#</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">ID</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Rápida</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Gemini</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-10"></th>
              </tr>
            </thead>
            <tbody>
              {embryos.map((emb, idx) => {
                const rapida = emb.classificacao || '\u2014';
                const gemini = emb.score?.gemini_classification || '\u2014';
                const match = emb.classificacao && emb.score?.gemini_classification
                  ? emb.classificacao === emb.score.gemini_classification
                  : null;
                const isExpanded = expandedIdx === idx;

                return (
                  <Fragment key={emb.id}>
                    <tr
                      onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                      className={`border-b border-border cursor-pointer transition-colors ${
                        isExpanded ? 'bg-primary/5' : 'hover:bg-muted/30'
                      }`}
                    >
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{idx + 1}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">{emb.identificacao || emb.id.slice(0, 8)}</td>
                      <td className="px-4 py-2.5">
                        <span className="font-mono font-bold">{rapida}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="font-mono font-bold">{gemini}</span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {match === true && <Check className="w-4 h-4 text-green-500 inline" />}
                        {match === false && <AlertTriangle className="w-4 h-4 text-amber-500 inline" />}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-muted/20">
                        <td colSpan={5} className="px-4 py-3">
                          <EmbryoExpandedRow
                            emb={emb}
                            onReclassify={(cls) => handleReclassify(emb.id, cls)}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Embryo Expanded Row ──────────────────────────────────

function EmbryoExpandedRow({ emb, onReclassify }: {
  emb: BancadaPlateEmbryo;
  onReclassify: (cls: ClassificacaoEmbriao) => void;
}) {
  const { data: cropUrl } = useEmbryoscoreUrl(emb.score?.crop_image_path);
  const { data: motionUrl } = useEmbryoscoreUrl(emb.score?.motion_map_path);
  const score = emb.score;

  return (
    <div className="space-y-3">
      {/* Images + Kinetics */}
      <div className="flex gap-3">
        {/* Crop */}
        <div className="shrink-0">
          {cropUrl ? (
            <img src={cropUrl} alt="Embrião" className="w-24 h-24 rounded-lg border border-border object-cover" loading="lazy" />
          ) : (
            <div className="w-24 h-24 rounded-lg border border-border bg-muted/30 flex items-center justify-center text-[10px] text-muted-foreground">
              Sem imagem
            </div>
          )}
        </div>
        {/* Motion map */}
        <div className="shrink-0">
          {motionUrl ? (
            <img src={motionUrl} alt="Mapa cinético" className="w-24 h-24 rounded-lg border border-border object-cover" loading="lazy" />
          ) : (
            <div className="w-24 h-24 rounded-lg border border-border bg-muted/30 flex items-center justify-center text-[10px] text-muted-foreground">
              Sem mapa
            </div>
          )}
        </div>
        {/* Kinetics + Reasoning */}
        <div className="flex-1 min-w-0 space-y-2">
          {score?.kinetic_intensity != null && (() => {
            const diag = getKineticDiagnosis(score);
            return (
              <div className="flex flex-wrap gap-2 text-xs">
                {(['Atividade', 'Distribuição', 'Estabilidade'] as const).map((label, i) => {
                  const d = [diag.activity, diag.distribution, diag.stability][i];
                  return (
                    <span key={label} className="flex items-center gap-1">
                      <span className="text-muted-foreground">{label}:</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${getLabelClasses(d.color)}`}>
                        {d.label}
                      </span>
                    </span>
                  );
                })}
              </div>
            );
          })()}
          {score?.gemini_reasoning && (
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">
              {score.gemini_reasoning}
            </p>
          )}
        </div>
      </div>

      {/* Reclassification buttons */}
      <div className="flex flex-wrap gap-2">
        {CLASSES.map((cls) => (
          <button
            key={cls.value}
            onClick={(e) => {
              e.stopPropagation();
              onReclassify(cls.value);
            }}
            className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition-colors ${
              emb.classificacao === cls.value
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border glass-panel hover:border-primary/20 text-foreground'
            }`}
          >
            {cls.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────

export default function Bancada() {
  const { data: jobs, isLoading } = useBancadaJobs();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  if (selectedJobId) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
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
