/**
 * Badge minimalista de EmbryoScore para uso em tabelas e listagens
 *
 * Cores por faixa de score:
 *   80-100: verde — Excelente
 *   60-79:  verde claro — Bom
 *   40-59:  amarelo — Regular
 *   20-39:  laranja — Borderline
 *   0-19:   vermelho — Inviável
 *
 * Dark mode compatível via opacidades relativas.
 */

import { useState, useEffect } from 'react';
import type { EmbryoScore } from '@/lib/types';
import { Brain, Clock, RefreshCw, X } from 'lucide-react';

interface EmbryoScoreBadgeProps {
  score: EmbryoScore;
  compact?: boolean;
}

function getScoreColor(score: number) {
  if (score >= 80) return {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-400',
    ring: 'ring-emerald-500/30',
    dot: 'bg-emerald-500',
  };
  if (score >= 60) return {
    bg: 'bg-green-500/15',
    text: 'text-green-700 dark:text-green-400',
    ring: 'ring-green-500/30',
    dot: 'bg-green-500',
  };
  if (score >= 40) return {
    bg: 'bg-amber-500/15',
    text: 'text-amber-700 dark:text-amber-400',
    ring: 'ring-amber-500/30',
    dot: 'bg-amber-500',
  };
  if (score >= 20) return {
    bg: 'bg-orange-500/15',
    text: 'text-orange-700 dark:text-orange-400',
    ring: 'ring-orange-500/30',
    dot: 'bg-orange-500',
  };
  return {
    bg: 'bg-red-500/15',
    text: 'text-red-700 dark:text-red-400',
    ring: 'ring-red-500/30',
    dot: 'bg-red-500',
  };
}

function getConfidenceLabel(confidence: string) {
  switch (confidence) {
    case 'high': return 'Alta';
    case 'medium': return 'Média';
    case 'low': return 'Baixa';
    default: return confidence;
  }
}

export function EmbryoScoreBadge({ score, compact = false }: EmbryoScoreBadgeProps) {
  const colors = getScoreColor(score.embryo_score);

  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md ${colors.bg} ring-1 ${colors.ring}`}
        title={`EmbryoScore: ${score.embryo_score} — ${score.classification} (${getConfidenceLabel(score.confidence)})`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
        <span className={`text-[10px] font-bold ${colors.text}`}>
          {Math.round(score.embryo_score)}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md ${colors.bg} ring-1 ${colors.ring}`}
      title={`EmbryoScore: ${score.embryo_score} — ${score.classification}\nRecomendação: ${score.transfer_recommendation}\nConfiança: ${getConfidenceLabel(score.confidence)}`}
    >
      <Brain className={`w-3 h-3 ${colors.text}`} />
      <span className={`text-xs font-bold ${colors.text}`}>
        {Math.round(score.embryo_score)}
      </span>
      <span className={`text-[10px] ${colors.text} opacity-70`}>
        {score.classification}
      </span>
    </div>
  );
}

/**
 * Badge de status de processamento com detalhes da fila
 */
export function EmbryoScoreProcessing({
  status,
  startedAt,
  retryCount,
}: {
  status?: 'pending' | 'processing' | string;
  startedAt?: string | null;
  retryCount?: number;
} = {}) {
  const isPending = status === 'pending' || !status;
  const label = isPending ? 'Na fila...' : 'Analisando...';

  // Calcular tempo decorrido se estiver processando
  let elapsed = '';
  if (startedAt && !isPending) {
    const seconds = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
    if (seconds < 60) {
      elapsed = `${seconds}s`;
    } else {
      elapsed = `${Math.floor(seconds / 60)}m${seconds % 60}s`;
    }
  }

  const retryLabel = retryCount && retryCount > 1 ? ` (tentativa ${retryCount})` : '';

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md ring-1 ${
        isPending
          ? 'bg-amber-500/10 ring-amber-500/20'
          : 'bg-blue-500/10 ring-blue-500/20 animate-pulse'
      }`}
      title={`Status: ${isPending ? 'Aguardando na fila' : 'Processando com Gemini IA'}${retryLabel}${elapsed ? ` — ${elapsed}` : ''}`}
    >
      {isPending ? (
        <Clock className="w-3 h-3 text-amber-500" />
      ) : (
        <Brain className="w-3 h-3 text-blue-500" />
      )}
      <span className={`text-[10px] font-medium ${
        isPending ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'
      }`}>
        {label}
      </span>
      {elapsed && (
        <span className="text-[10px] text-blue-500/70">{elapsed}</span>
      )}
    </div>
  );
}

/**
 * Badge de erro na análise — mais visível com mensagem expandível
 */
export function EmbryoScoreError({ message, retryCount }: { message?: string; retryCount?: number }) {
  const retryLabel = retryCount != null && retryCount >= 3
    ? ' (máx. tentativas)'
    : retryCount != null && retryCount > 0
      ? ` (tentativa ${retryCount}/3)`
      : '';

  return (
    <div
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-500/10 ring-1 ring-red-500/20 cursor-help"
      title={`${message || 'Falha na análise'}${retryLabel}`}
    >
      <Brain className="w-3 h-3 text-red-500" />
      <span className="text-[10px] text-red-600 dark:text-red-400 font-medium">Falha IA</span>
      {retryCount != null && retryCount >= 3 && (
        <span className="text-[10px] text-red-500/60">max</span>
      )}
    </div>
  );
}

/**
 * Barra de loading no rodapé do card do embrião durante análise IA.
 * Substitui os badges inline (EmbryoScoreProcessing/Error) com visual mais proeminente.
 *
 * Variantes:
 *   pending    → âmbar, shimmer lento, "Aguardando IA..."
 *   processing → azul, shimmer + pulse, "Analisando..." + tempo decorrido
 *   failed     → vermelho, estático, "Falha IA" + botão retry
 */
export function EmbryoAnalysisBar({
  status,
  startedAt,
  retryCount,
  onRetry,
  onCancel,
}: {
  status: 'pending' | 'processing' | 'failed';
  startedAt?: string | null;
  retryCount?: number;
  onRetry?: () => void;
  onCancel?: () => void;
}) {
  const [elapsed, setElapsed] = useState('');

  // Atualizar tempo decorrido a cada segundo quando processando
  useEffect(() => {
    if (status !== 'processing' || !startedAt) {
      setElapsed('');
      return;
    }
    const update = () => {
      const seconds = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
      if (seconds < 0) { setElapsed(''); return; }
      if (seconds < 60) setElapsed(`${seconds}s`);
      else setElapsed(`${Math.floor(seconds / 60)}m${seconds % 60}s`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [status, startedAt]);

  const retryLabel = retryCount && retryCount > 1 ? ` (tentativa ${retryCount})` : '';

  if (status === 'failed') {
    return (
      <div className="mt-2 -mx-3 -mb-3 px-3 py-1.5 rounded-b-lg bg-red-500/5 border-t border-red-500/20">
        <div className="h-1 rounded-full bg-red-500/15 mb-1">
          <div className="h-full w-full bg-red-500/40 rounded-full" />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Brain className="w-3 h-3 text-red-500" />
            <span className="text-[10px] text-red-600 dark:text-red-400 font-medium">
              Falha IA{retryLabel}
            </span>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 active:bg-amber-500/30 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Reanalisar
            </button>
          )}
        </div>
      </div>
    );
  }

  const isPending = status === 'pending';

  return (
    <div className={`mt-2 -mx-3 -mb-3 px-3 py-1.5 rounded-b-lg border-t ${
      isPending
        ? 'bg-amber-500/5 border-amber-500/20'
        : 'bg-blue-500/5 border-blue-500/20'
    }`}>
      {/* Barra de progresso indeterminado */}
      <div className={`h-1 rounded-full overflow-hidden mb-1 ${
        isPending ? 'bg-amber-500/10' : 'bg-blue-500/10'
      }`}>
        <div
          className={`h-full w-1/3 rounded-full ${
            isPending ? 'bg-amber-500/50' : 'bg-blue-500/60'
          }`}
          style={{ animation: `embryo-shimmer ${isPending ? '2s' : '1.5s'} ease-in-out infinite` }}
        />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {isPending ? (
            <Clock className="w-3 h-3 text-amber-500" />
          ) : (
            <Brain className="w-3 h-3 text-blue-500 animate-pulse" />
          )}
          <span className={`text-[10px] font-medium ${
            isPending
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-blue-600 dark:text-blue-400'
          }`}>
            {isPending ? 'Aguardando IA...' : 'Analisando...'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {elapsed && (
            <span className="text-[10px] text-blue-500/70">{elapsed}</span>
          )}
          {onCancel && (
            <button
              onClick={onCancel}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium text-muted-foreground hover:text-red-600 dark:hover:text-red-400 bg-muted/50 hover:bg-red-500/10 active:bg-red-500/20 transition-colors"
              title="Cancelar análise"
            >
              <X className="w-3 h-3" />
              Parar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Re-exportar helper para uso externo
export { getScoreColor };
