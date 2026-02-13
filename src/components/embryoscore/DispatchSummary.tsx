/**
 * DispatchSummary — Resumo final quando todos os embriões estão classificados.
 *
 * Mostra: contagem por classe, concordância biólogo × IA, maturidade do atlas,
 * e botão "Confirmar despacho".
 */

import type { EmbryoScore } from '@/lib/types';
import { Check, Brain, BarChart3 } from 'lucide-react';

const CLASS_COLORS: Record<string, string> = {
  BE: 'bg-emerald-500',
  BN: 'bg-green-500',
  BX: 'bg-amber-500',
  BL: 'bg-blue-500',
  BI: 'bg-sky-400',
  Mo: 'bg-purple-500',
  Dg: 'bg-red-500',
};

interface DispatchSummaryProps {
  scores: EmbryoScore[];
  atlasTotal?: number;
  atlasBovineReal?: number;
  onConfirmDispatch: () => void;
  isLoading?: boolean;
}

export function DispatchSummary({
  scores,
  atlasTotal = 0,
  atlasBovineReal = 0,
  onConfirmDispatch,
  isLoading,
}: DispatchSummaryProps) {
  // Count by class
  const classCounts: Record<string, number> = {};
  let totalClassified = 0;
  let agreed = 0;

  for (const s of scores) {
    const cls = s.biologist_classification;
    if (!cls) continue;
    classCounts[cls] = (classCounts[cls] || 0) + 1;
    totalClassified++;

    // Check concordance (biologist vs AI suggestion)
    if (s.combined_classification && s.biologist_classification === s.combined_classification) {
      agreed++;
    }
  }

  const sortedClasses = Object.entries(classCounts).sort((a, b) => b[1] - a[1]);
  const concordancePercent = totalClassified > 0
    ? Math.round((agreed / totalClassified) * 100)
    : 0;

  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-b from-primary/5 to-transparent p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
          <BarChart3 className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Resumo do Despacho</h3>
          <p className="text-xs text-muted-foreground">{totalClassified} embriões classificados</p>
        </div>
      </div>

      {/* Class distribution */}
      <div className="space-y-2">
        {sortedClasses.map(([cls, count]) => {
          const pct = Math.round((count / totalClassified) * 100);
          return (
            <div key={cls} className="flex items-center gap-3">
              <span className="font-mono text-sm font-bold w-8 text-foreground">{cls}</span>
              <div className="flex-1 h-5 bg-muted rounded-sm overflow-hidden">
                <div
                  className={`h-full rounded-sm ${CLASS_COLORS[cls] || 'bg-primary'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground w-16 text-right">
                {count} ({pct}%)
              </span>
            </div>
          );
        })}
      </div>

      {/* Concordance */}
      <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/50">
        <Brain className="w-4 h-4 text-primary/60" />
        <div className="flex-1">
          <span className="text-xs text-muted-foreground">Concordância IA</span>
          <span className="ml-2 text-sm font-semibold text-foreground">
            {concordancePercent}% ({agreed}/{totalClassified})
          </span>
        </div>
      </div>

      {/* Atlas maturity */}
      <div className="px-3 py-2 rounded-lg bg-muted/30 text-xs text-muted-foreground">
        Atlas: {atlasTotal.toLocaleString()} cross-species + {atlasBovineReal.toLocaleString()} reais
      </div>

      {/* Confirm dispatch */}
      <button
        onClick={onConfirmDispatch}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary hover:bg-primary-dark text-white font-medium text-sm shadow-sm shadow-primary/25 transition-colors disabled:opacity-50"
      >
        <Check className="w-4 h-4" />
        Confirmar despacho
      </button>
    </div>
  );
}
