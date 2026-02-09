import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import HubTabs from './HubTabs';
import MobileNav from './MobileNav';
import { useGlobalAnalysisQueue, useCancelAllAnalysis } from '@/hooks/useEmbryoScores';
import { Brain, X } from 'lucide-react';

function AnalysisQueueBadge() {
  const { data: queueCount = 0 } = useGlobalAnalysisQueue();
  const cancelAll = useCancelAllAnalysis();
  const [confirming, setConfirming] = useState(false);

  if (queueCount === 0) return null;

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

  return (
    <div className="fixed top-16 md:top-14 right-4 z-40 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-500/15 border border-violet-500/30 shadow-sm">
      <Brain className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 animate-pulse" />
      <span className="text-xs font-medium text-violet-600 dark:text-violet-400">
        {queueCount} análise{queueCount > 1 ? 's' : ''} na fila
      </span>
      <button
        onClick={handleCancel}
        disabled={cancelAll.isPending}
        className={`ml-1 flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
          confirming
            ? 'bg-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/30'
            : 'bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-red-500/15 hover:text-red-600 dark:hover:text-red-400'
        } disabled:opacity-50`}
        title={confirming ? 'Clique de novo para confirmar' : 'Cancelar todas as análises'}
      >
        <X className="w-3 h-3" />
        {cancelAll.isPending ? 'Parando...' : confirming ? 'Confirmar?' : 'Parar'}
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

      {/* Badge de fila de análise IA */}
      <AnalysisQueueBadge />

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
