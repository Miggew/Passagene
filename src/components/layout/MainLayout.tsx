import { useState, useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import MobileNav from './MobileNav';
import TopBar from './TopBar';
import { useGlobalAnalysisQueue, useCancelAllAnalysis } from '@/hooks/useEmbryoScores';
import type { GlobalAnalysisQueueData } from '@/hooks/useEmbryoScores';
import { cn } from '@/lib/utils';
import { Brain, X, Loader2, AlertCircle } from 'lucide-react';
import { LoaderDNA } from '@/components/ui/LoaderDNA';

function formatElapsed(startedAt: string): string {
  const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  if (elapsed < 0) return '0s';
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return m > 0 ? `${m}m${String(s).padStart(2, '0')}s` : `${s}s`;
}

function AnalysisQueueBar() {
  const { data: queue } = useGlobalAnalysisQueue();
  const queueData: GlobalAnalysisQueueData = queue ?? { pending: 0, processing: 0, total: 0, oldestStartedAt: null, newestExpectedCount: null };
  const cancelAll = useCancelAllAnalysis();
  const [confirming, setConfirming] = useState(false);
  const [, setTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer that updates every second when processing
  useEffect(() => {
    if (queueData.processing > 0 && queueData.oldestStartedAt) {
      intervalRef.current = setInterval(() => setTick(t => t + 1), 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [queueData.processing > 0, queueData.oldestStartedAt]);

  if (queueData.total === 0) return null;

  const handleCancel = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    cancelAll.mutate(undefined, {
      onSuccess: () => setConfirming(false),
      onError: () => setConfirming(false),
    });
  };

  // Build status parts
  const parts: string[] = [];
  if (queueData.processing > 0) {
    let processingText = `${queueData.processing} analisando`;
    if (queueData.newestExpectedCount) {
      processingText += ` (${queueData.newestExpectedCount} embriões)`;
    }
    parts.push(processingText);
  }
  if (queueData.pending > 0) {
    parts.push(`${queueData.pending} na fila`);
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-[hsl(var(--logo-bg))] border-b border-[hsl(var(--logo-bg))]/80 text-primary-foreground shadow-sm relative overflow-hidden">

      {/* Glow Effect / Pulse background for processing */}
      {queueData.processing > 0 && (
        <div className="absolute left-0 top-0 bottom-0 w-64 bg-[radial-gradient(ellipse_at_left,_var(--tw-gradient-stops))] from-primary/20 to-transparent opacity-40 animate-pulse pointer-events-none"></div>
      )}

      {/* Main Content Area */}
      <div className="flex items-center gap-4 relative z-10 w-full">
        {/* DNA Loader */}
        <div className="shrink-0 flex items-center justify-center bg-black/10 rounded-xl p-1 shadow-inner">
          <LoaderDNA size={40} variant="premium" />
        </div>

        {/* Text and Stats */}
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-extrabold tracking-wider uppercase text-white shadow-sm">
              Analisando IA
            </span>
            {queueData.processing > 0 && (
              <span className="flex items-center h-5 px-2 text-[10px] font-bold tracking-widest uppercase rounded-full bg-primary/20 text-primary-100 border border-primary/30">
                Processando
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mt-1.5 text-xs font-mono font-medium text-white/70">
            <span className="flex items-center gap-1.5 bg-black/20 px-2 py-0.5 rounded-md">
              <Brain className="w-3.5 h-3.5 text-primary-light" />
              {parts.join(' | ')}
            </span>
            {queueData.oldestStartedAt && queueData.processing > 0 && (
              <span className="flex items-center gap-1.5 bg-black/20 px-2 py-0.5 rounded-md text-primary-200">
                Tempo Real: {formatElapsed(queueData.oldestStartedAt)}
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="shrink-0 flex items-center">
          <button
            onClick={handleCancel}
            disabled={cancelAll.isPending}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all focus:outline-none focus:ring-2 focus:ring-red-500/50 ${confirming
              ? 'bg-red-500 text-white shadow-lg shadow-red-500/20 scale-105'
              : 'bg-white/5 text-white/60 hover:bg-red-500/20 hover:text-red-400 border border-white/10 hover:border-red-500/30'
              } disabled:opacity-50`}
            title={confirming ? 'Clique de novo para confirmar cancelamento' : 'Abortar Análises Globais'}
          >
            <X className={cn("w-4 h-4", confirming && "animate-pulse")} />
            {cancelAll.isPending ? 'Abortando...' : confirming ? 'Confirmar Aborto' : 'Abortar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MainLayout() {
  return (
    <div className="flex flex-col min-h-screen bg-secondary pb-24 lg:pb-0">
      {/* TopBar Universal */}
      <TopBar />

      {/* Barra de status de análise IA (no fluxo, não fixed) */}
      <AnalysisQueueBar />

      {/* Conteúdo principal */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8 overflow-auto">
        <Outlet />
      </main>

      {/* Navegação mobile */}
      <MobileNav />
    </div>
  );
}
