import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Date utilities should be imported directly from @/lib/dateUtils
export {
  formatDateBR as formatDate,
  formatDateTimeBR as formatDateTime,
  addDays,
  diffDays,
  parseDateBRtoISO,
  todayISO,
  todayBR,
  formatRelativeDate,
  extractDateOnly,
  normalizeDateForDB,
  getDayOfWeekName,
  formatDateBR as formatDateString,
  todayISO as getTodayDateString
} from './dateUtils';

/** Retorna a cor de fundo Tailwind para qualidade (1=vermelho, 2=amarelo, 3=verde) */
export function getQualidadeColor(num: 1 | 2 | 3): string {
  const colors = { 1: 'bg-red-500', 2: 'bg-yellow-500', 3: 'bg-green-500' };
  return colors[num];
}
