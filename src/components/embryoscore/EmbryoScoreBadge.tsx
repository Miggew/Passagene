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
import { Brain, Clock, RefreshCw, X, AlertCircle } from 'lucide-react';
import { LoaderDNA } from '@/components/ui/LoaderDNA';

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

// Colors by classification for v2 badges
const CLASS_BADGE_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  BE: { bg: 'bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-400', ring: 'ring-emerald-500/30' },
  BN: { bg: 'bg-green-500/15', text: 'text-green-700 dark:text-green-400', ring: 'ring-green-500/30' },
  BX: { bg: 'bg-amber-500/15', text: 'text-amber-700 dark:text-amber-400', ring: 'ring-amber-500/30' },
  BL: { bg: 'bg-blue-500/15', text: 'text-blue-700 dark:text-blue-400', ring: 'ring-blue-500/30' },
  BI: { bg: 'bg-sky-500/15', text: 'text-sky-700 dark:text-sky-400', ring: 'ring-sky-500/30' },
  Mo: { bg: 'bg-purple-500/15', text: 'text-purple-700 dark:text-purple-400', ring: 'ring-purple-500/30' },
  Dg: { bg: 'bg-red-500/15', text: 'text-red-700 dark:text-red-400', ring: 'ring-red-500/30' },
};

export function EmbryoScoreBadge({ score, compact = false }: EmbryoScoreBadgeProps) {
  // v6: Show IETS class badge if gemini_classification exists
  const hasGemini = score.gemini_classification != null;

  if (hasGemini) {
    const cls = score.gemini_classification!;
    const clsColors = CLASS_BADGE_COLORS[cls] || { bg: 'bg-muted', text: 'text-muted-foreground', ring: 'ring-border' };
    const confidence = score.ai_confidence != null ? `${Math.round(score.ai_confidence * 100)}%` : '';

    if (compact) {
      return (
        <div
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md ${clsColors.bg} ring-1 ${clsColors.ring}`}
          title={`Gemini: ${cls}${confidence ? ` (${confidence})` : ''}`}
        >
          <span className={`text-[10px] font-bold font-mono ${clsColors.text}`}>{cls}</span>
        </div>
      );
    }

    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md ${clsColors.bg} ring-1 ${clsColors.ring}`}
        title={`Gemini: ${cls}${confidence ? ` — Confiança: ${confidence}` : ''}`}
      >
        <Brain className={`w-3 h-3 ${clsColors.text}`} />
        <span className={`text-xs font-bold font-mono ${clsColors.text}`}>{cls}</span>
        {confidence && (
          <span className={`text-[10px] ${clsColors.text} opacity-70`}>{confidence}</span>
        )}
      </div>
    );
  }

  // Fallback: Numeric score badge (legacy)
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
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md ring-1 ${isPending
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
      <span className={`text-[10px] font-medium ${isPending ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'
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
      <div className="mt-3 -mx-3 -mb-3 px-4 py-5 rounded-b-2xl bg-destructive/5 border-t border-destructive/20 flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center relative">
          <div className="absolute inset-0 border-2 border-destructive/20 rounded-full animate-ping opacity-20"></div>
          <AlertCircle className="w-5 h-5 text-destructive" />
        </div>

        <div className="flex flex-col items-center text-center gap-1">
          <span className="text-[11px] font-bold uppercase tracking-widest text-destructive">
            Falha na Análise
          </span>
          {retryCount && retryCount > 1 && (
            <span className="text-[10px] text-destructive/70 font-medium">
              (Tentativa {retryCount})
            </span>
          )}
        </div>

        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-1 flex items-center gap-1.5 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider text-destructive bg-destructive/10 hover:bg-destructive/20 active:bg-destructive/30 transition-all focus:outline-none focus:ring-2 focus:ring-destructive/40"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Tentar Novamente
          </button>
        )}
      </div>
    );
  }

  const isPending = status === 'pending';

  return (
    <div className={`mt-3 -mx-3 -mb-3 px-4 py-6 rounded-b-2xl border-t flex flex-col items-center justify-center gap-4 transition-colors duration-500 overflow-hidden relative ${isPending
        ? 'bg-muted/30 border-border/50'
        : 'bg-primary/5 border-[hsl(var(--logo-bg))] shadow-inner'
      }`}>
      {/* Background Decorativo no estado de processamento */}
      {!isPending && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20 flex items-center justify-center">
          <div className="w-[150%] h-[150%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/20 via-primary/5 to-transparent blur-2xl animate-spin-slow"></div>
        </div>
      )}

      {/* O Escultor Magnético de Espera */}
      <div className="relative z-10 flex flex-col items-center">
        <LoaderDNA size={isPending ? 32 : 48} variant={isPending ? 'premium' : 'accent'} />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-1.5 text-center">
        {/* Título de Autoridade */}
        <div className="flex items-center gap-2">
          {!isPending && <Brain className="w-3.5 h-3.5 text-primary animate-pulse" />}
          <span className={`text-[11px] font-extrabold tracking-widest uppercase ${isPending
              ? 'text-muted-foreground'
              : 'text-[hsl(var(--logo-bg))]'
            }`}>
            {isPending ? 'Na fila de IA' : 'Analisando Embrião'}
          </span>
        </div>

        {/* Temporizador Orbitando o DNA */}
        <div className="flex items-center gap-2 min-h-[16px]">
          {isPending ? (
            <div className="flex items-center gap-1.5 text-muted-foreground/70">
              <Clock className="w-3 h-3" />
              <span className="text-[10px] font-medium">Aguardando servidor...</span>
            </div>
          ) : (
            elapsed && (
              <span className="text-xs font-mono font-medium text-[hsl(var(--logo-bg))]/80 bg-[hsl(var(--logo-bg))]/5 px-2 py-0.5 rounded-full border border-[hsl(var(--logo-bg))]/10">
                Tempo: {elapsed}
              </span>
            )
          )}
        </div>
      </div>

      {/* Botão de Cancelamento Ancorado Inferior */}
      {onCancel && (
        <button
          onClick={onCancel}
          className="relative z-10 mt-1 flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-red-500 hover:bg-red-500/10 active:bg-red-500/20 transition-all focus:outline-none focus:ring-2 focus:ring-red-500/30"
          title="Cancelar análise em andamento"
        >
          <X className="w-3.5 h-3.5" />
          Abortar Analise
        </button>
      )}
    </div>
  );
}

// Re-exportar helper para uso externo
export { getScoreColor };
