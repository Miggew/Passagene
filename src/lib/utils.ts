import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Re-export date utilities for backward compatibility
// All date operations should use @/lib/dateUtils directly
export {
  DATE_YYYY_MM_DD,
  formatDateBR as formatDate,
  formatDateBR as formatDateString,
  todayISO as getTodayDateString,
  addDays,
  diffDays,
  extractDateOnly,
  normalizeDateForDB,
  getDayOfWeekName,
} from './dateUtils';

/** Retorna a cor de fundo Tailwind para qualidade (1=vermelho, 2=amarelo, 3=verde) */
export function getQualidadeColor(num: 1 | 2 | 3): string {
  const colors = { 1: 'bg-red-500', 2: 'bg-yellow-500', 3: 'bg-green-500' };
  return colors[num];
}
