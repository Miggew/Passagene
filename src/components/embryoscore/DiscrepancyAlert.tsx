/**
 * Alerta de discrepância entre classificação manual do biólogo e classificação Gemini.
 *
 * Comparação direta IETS vs IETS:
 *   Se classificacaoManual !== geminiClassification → mostrar aviso
 */

import { AlertTriangle } from 'lucide-react';

interface DiscrepancyAlertProps {
  classificacaoManual: string;
  geminiClassification: string;
}

const IETS_LABELS: Record<string, string> = {
  BE: 'Excelente',
  BN: 'Normal',
  BX: 'Regular',
  BL: 'Limitado',
  BI: 'Irregular',
  Mo: 'Mórula',
  Dg: 'Degenerado',
};

export function getDiscrepancy(classificacaoManual: string, geminiClassification: string | null | undefined) {
  if (!geminiClassification) return null;
  if (classificacaoManual === geminiClassification) return null;

  return {
    classificacaoManual,
    labelManual: IETS_LABELS[classificacaoManual] || classificacaoManual,
    geminiClassification,
    labelGemini: IETS_LABELS[geminiClassification] || geminiClassification,
  };
}

export function DiscrepancyAlert({ classificacaoManual, geminiClassification }: DiscrepancyAlertProps) {
  const discrepancy = getDiscrepancy(classificacaoManual, geminiClassification);
  if (!discrepancy) return null;

  return (
    <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
          Divergência IA vs Biólogo
        </p>
        <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">
          Biólogo: <span className="font-semibold">{discrepancy.classificacaoManual} ({discrepancy.labelManual})</span>
        </p>
        <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80">
          Gemini IA: <span className="font-semibold">{discrepancy.geminiClassification} ({discrepancy.labelGemini})</span>
        </p>
      </div>
    </div>
  );
}
