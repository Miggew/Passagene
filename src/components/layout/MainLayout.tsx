import { useState, useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import HubTabs from './HubTabs';
import MobileNav from './MobileNav';
import { useGlobalAnalysisQueue, useCancelAllAnalysis } from '@/hooks/useEmbryoScores';
import type { GlobalAnalysisQueueData } from '@/hooks/useEmbryoScores';
import { Brain, X, Loader2 } from 'lucide-react';

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
    <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-500/10 border-b border-violet-500/20">
      {queueData.processing > 0 ? (
        <Loader2 className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 animate-spin shrink-0" />
      ) : (
        <Brain className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
      )}

      <span className="text-xs font-medium text-violet-600 dark:text-violet-400 truncate">
        <span className="hidden sm:inline">EmbryoScore — </span>
        {parts.join(' | ')}
        {queueData.oldestStartedAt && (
          <span className="ml-1.5 tabular-nums opacity-75">
            {formatElapsed(queueData.oldestStartedAt)}
          </span>
        )}
      </span>

      <button
        onClick={handleCancel}
        disabled={cancelAll.isPending}
        className={`ml-auto shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
          confirming
            ? 'bg-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/30'
            : 'bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-red-500/15 hover:text-red-600 dark:hover:text-red-400'
        } disabled:opacity-50`}
        title={confirming ? 'Clique de novo para confirmar' : 'Cancelar todas as análises'}
      >
        <X className="w-3 h-3" />
        {cancelAll.isPending ? '...' : confirming ? 'Confirmar?' : 'Parar'}
      </button>
    </div>
  );
}

export default function MainLayout() {
  return (
    <div className="flex flex-col min-h-screen bg-secondary">
      {/* Header com tabs de hubs - esconde em mobile */}
      <div className="hidden md:block">
        <HubTabs />
      </div>

      {/* Barra de status de análise IA (no fluxo, não fixed) */}
      <AnalysisQueueBar />

      {/* Conteúdo principal com sidebar */}
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-4 md:p-8 overflow-auto pb-24 md:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Navegação mobile */}
      <MobileNav />
    </div>
  );
}
