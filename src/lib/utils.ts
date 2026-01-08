import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formata uma data para exibição em pt-BR
 * Trata a data como string YYYY-MM-DD para evitar problemas de timezone
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-';
  
  // Se já é string no formato YYYY-MM-DD, usar diretamente
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split('-');
    return `${day}/${month}/${year}`;
  }
  
  // Se for Date ou string ISO, converter
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('pt-BR');
}

/**
 * Garante que a data seja salva como string YYYY-MM-DD
 * Evita conversões de timezone que causam -1 dia
 */
export function normalizeDateForDB(date: string | Date | null | undefined): string | null {
  if (!date) return null;
  
  // Se já é string YYYY-MM-DD, retornar diretamente
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }
  
  // Se for Date ou string ISO, extrair apenas a parte da data
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}