/**
 * Kinetic diagnosis labels based on scientific biomarkers.
 *
 * NSD (Normalized Standard Deviation) validated as viability biomarker:
 * - PMC5695959: live embryos ≥5× more variance than dead (Speckle Variance OCT)
 * - PMC9089758: NSD as biomarker for intracellular activity (Biodynamic Holographic Speckle)
 * - PMC6977009: SVM 79.3% accuracy, ATP validation 89.7% (Biodynamic Optical Assay)
 *
 * Thresholds are initial estimates — calibrate with DG outcome data.
 */

type DiagnosisLevel = {
  label: string;
  color: 'green' | 'amber' | 'red';
};

export function classifyActivity(nsd: number | null | undefined): DiagnosisLevel {
  if (nsd == null) return { label: '—', color: 'amber' };
  if (nsd >= 0.05) return { label: 'Alta', color: 'green' };
  if (nsd >= 0.015) return { label: 'Moderada', color: 'amber' };
  return { label: 'Baixa', color: 'red' };
}

export function classifyDistribution(harmony: number | null | undefined): DiagnosisLevel {
  if (harmony == null) return { label: '—', color: 'amber' };
  if (harmony >= 0.65) return { label: 'Homogênea', color: 'green' };
  if (harmony >= 0.4) return { label: 'Parcial', color: 'amber' };
  return { label: 'Localizada', color: 'red' };
}

export function classifyStability(stability: number | null | undefined): DiagnosisLevel {
  if (stability == null) return { label: '—', color: 'amber' };
  if (stability >= 0.6) return { label: 'Estável', color: 'green' };
  if (stability >= 0.3) return { label: 'Flutuante', color: 'amber' };
  return { label: 'Irregular', color: 'red' };
}

export function getKineticDiagnosis(score: {
  kinetic_intensity?: number | null;
  kinetic_harmony?: number | null;
  kinetic_stability?: number | null;
}) {
  return {
    activity: classifyActivity(score.kinetic_intensity),
    distribution: classifyDistribution(score.kinetic_harmony),
    stability: classifyStability(score.kinetic_stability),
  };
}

const LABEL_COLORS = {
  green: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  red: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
} as const;

export function getLabelClasses(color: 'green' | 'amber' | 'red'): string {
  return LABEL_COLORS[color];
}
