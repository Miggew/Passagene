import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type ResultType =
  // Resultados de DG
  | 'PRENHE'
  | 'VAZIA'
  | 'RETOQUE'
  // Resultados de Sexagem
  | 'FEMEA'
  | 'MACHO'
  | 'SEM_SEXO'
  | '2_SEXOS'
  // Tipo de TE
  | 'FRESCO'
  | 'CONGELADO'
  // Classificação de embriões
  | 'A' | 'B' | 'C' | 'D';

interface ResultBadgeProps {
  result: string;
  label?: string;
  className?: string;
  size?: 'sm' | 'default';
}

/**
 * Configuração de cores semânticas para resultados
 */
const resultConfig: Record<string, { color: string; label: string }> = {
  // ═══════════════════════════════════════════════════════════════
  // RESULTADOS DE DG
  // ═══════════════════════════════════════════════════════════════
  PRENHE: {
    color: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30',
    label: 'Prenhe',
  },
  VAZIA: {
    color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
    label: 'Vazia',
  },
  RETOQUE: {
    color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
    label: 'Retoque',
  },

  // ═══════════════════════════════════════════════════════════════
  // RESULTADOS DE SEXAGEM
  // ═══════════════════════════════════════════════════════════════
  FEMEA: {
    color: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/30',
    label: 'Fêmea',
  },
  MACHO: {
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
    label: 'Macho',
  },
  SEM_SEXO: {
    color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
    label: 'S/ sexo',
  },
  '2_SEXOS': {
    color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
    label: '2 sexos',
  },

  // ═══════════════════════════════════════════════════════════════
  // TIPO DE TE (Fresco/Congelado)
  // ═══════════════════════════════════════════════════════════════
  FRESCO: {
    color: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30',
    label: 'F',
  },
  CONGELADO: {
    color: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
    label: 'C',
  },

  // ═══════════════════════════════════════════════════════════════
  // CLASSIFICAÇÃO DE EMBRIÕES
  // ═══════════════════════════════════════════════════════════════
  A: {
    color: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30',
    label: 'A',
  },
  B: {
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
    label: 'B',
  },
  C: {
    color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
    label: 'C',
  },
  D: {
    color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
    label: 'D',
  },
};

// Fallback para resultados não mapeados
const defaultConfig = {
  color: 'bg-muted text-muted-foreground border-border',
  label: '',
};

/**
 * ResultBadge - Badge para exibição de resultados (DG, Sexagem, Tipo TE, Classificação)
 *
 * @example
 * <ResultBadge result="PRENHE" />
 * <ResultBadge result="FEMEA" />
 * <ResultBadge result="FRESCO" />
 * <ResultBadge result={embriao.classificacao} />
 */
export default function ResultBadge({
  result,
  label,
  className,
  size = 'default',
}: ResultBadgeProps) {
  const config = resultConfig[result] || defaultConfig;
  const displayLabel = label ?? config.label ?? result;

  const sizeClasses = size === 'sm'
    ? 'text-[10px] px-1.5 py-0 h-4'
    : 'text-xs px-2 py-0.5';

  return (
    <Badge
      variant="outline"
      className={cn(config.color, sizeClasses, className)}
    >
      {displayLabel}
    </Badge>
  );
}

/**
 * Exporta as cores para uso direto quando necessário
 */
export function getResultColor(result: string): string {
  return resultConfig[result]?.color || defaultConfig.color;
}

/**
 * Utilitário para determinar resultado de sexagem baseado nos dados
 */
export function getSexagemResult(sexagem?: string, resultado?: string): string {
  if (sexagem === 'FEMEA') return 'FEMEA';
  if (sexagem === 'MACHO') return 'MACHO';
  if (resultado === 'VAZIA') return 'VAZIA';
  return 'SEM_SEXO';
}

/**
 * Utilitário para obter label de sexagem
 */
export function getSexagemLabel(sexagem?: string, resultado?: string): string {
  if (sexagem === 'FEMEA') return 'Fêmea';
  if (sexagem === 'MACHO') return 'Macho';
  if (resultado === 'VAZIA') return 'Vazia';
  return 'S/ sexo';
}
