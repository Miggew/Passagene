/**
 * Alerta de discrepância entre classificação manual do biólogo e score da IA.
 *
 * Mapeamento classificação → faixa de score esperada:
 *   BE (Excelente) → 80-100 (midpoint 90)
 *   BN (Normal)    → 60-79  (midpoint 70)
 *   BX (Regular)   → 40-59  (midpoint 50)
 *   BL (Limitado)  → 20-39  (midpoint 30)
 *   BI (Irregular) → 0-19   (midpoint 10)
 *
 * Se |score_ia - midpoint| > 25 → mostrar aviso
 */

import { AlertTriangle } from 'lucide-react';

interface DiscrepancyAlertProps {
  classificacaoManual: string;
  scoreIA: number;
  classificationIA: string;
}

const CLASSIFICACAO_MAP: Record<string, { label: string; midpoint: number; range: string }> = {
  BE: { label: 'Excelente', midpoint: 90, range: '80-100' },
  BN: { label: 'Normal', midpoint: 70, range: '60-79' },
  BX: { label: 'Regular', midpoint: 50, range: '40-59' },
  BL: { label: 'Limitado', midpoint: 30, range: '20-39' },
  BI: { label: 'Irregular', midpoint: 10, range: '0-19' },
};

export function getDiscrepancy(classificacaoManual: string, scoreIA: number) {
  const mapping = CLASSIFICACAO_MAP[classificacaoManual];
  if (!mapping) return null;

  const diff = Math.abs(scoreIA - mapping.midpoint);
  if (diff <= 25) return null;

  return {
    classificacao: classificacaoManual,
    label: mapping.label,
    expectedRange: mapping.range,
    midpoint: mapping.midpoint,
    scoreIA: Math.round(scoreIA),
    diff: Math.round(diff),
  };
}

export function DiscrepancyAlert({ classificacaoManual, scoreIA, classificationIA }: DiscrepancyAlertProps) {
  const discrepancy = getDiscrepancy(classificacaoManual, scoreIA);
  if (!discrepancy) return null;

  return (
    <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
          Divergência IA vs Biólogo
        </p>
        <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">
          Biólogo: <span className="font-semibold">{discrepancy.classificacao} ({discrepancy.label})</span>
          {' '}— faixa esperada: {discrepancy.expectedRange}
        </p>
        <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80">
          IA: <span className="font-semibold">{Math.round(scoreIA)} ({classificationIA})</span>
          {' '}— diferença de {discrepancy.diff} pontos
        </p>
      </div>
    </div>
  );
}
