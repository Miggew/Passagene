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

/**
 * Extrai apenas a parte da data (YYYY-MM-DD) de uma string ISO ou Date
 * Evita problemas de timezone trabalhando apenas com strings
 */
export function extractDateOnly(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  
  // Se já é YYYY-MM-DD, retornar diretamente
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // Extrair apenas a parte da data (antes do T ou espaço)
  const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

/**
 * Adiciona dias a uma data no formato YYYY-MM-DD
 * Trabalha apenas com strings para evitar problemas de timezone
 * Exemplo: addDays('2026-01-05', 8) => '2026-01-13'
 */
export function addDays(dateStr: string, days: number): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error('Data deve estar no formato YYYY-MM-DD');
  }
  
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day); // month é 0-indexed
  date.setDate(date.getDate() + days);
  
  // Retornar como YYYY-MM-DD sem problemas de timezone
  const resultYear = date.getFullYear();
  const resultMonth = String(date.getMonth() + 1).padStart(2, '0');
  const resultDay = String(date.getDate()).padStart(2, '0');
  
  return `${resultYear}-${resultMonth}-${resultDay}`;
}

/**
 * Calcula a diferença em dias entre duas datas no formato YYYY-MM-DD
 * Retorna a diferença em dias (pode ser negativa)
 */
export function diffDays(dateStr1: string, dateStr2: string): number {
  if (!dateStr1 || !dateStr2) return 0;
  
  const date1 = extractDateOnly(dateStr1);
  const date2 = extractDateOnly(dateStr2);
  
  if (!date1 || !date2) return 0;
  
  const [year1, month1, day1] = date1.split('-').map(Number);
  const [year2, month2, day2] = date2.split('-').map(Number);
  
  const d1 = new Date(year1, month1 - 1, day1);
  const d2 = new Date(year2, month2 - 1, day2);
  
  const diffTime = d1.getTime() - d2.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Obtém a data de hoje no formato YYYY-MM-DD
 * Usa timezone local para garantir consistência
 */
export function getTodayDateString(): string {
  const hoje = new Date();
  const year = hoje.getFullYear();
  const month = String(hoje.getMonth() + 1).padStart(2, '0');
  const day = String(hoje.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formata uma data YYYY-MM-DD para pt-BR (DD/MM/YYYY)
 */
export function formatDateString(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  
  const date = extractDateOnly(dateStr);
  if (!date) return '-';
  
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Obtém o nome do dia da semana de uma data YYYY-MM-DD
 */
export function getDayOfWeekName(dateStr: string): string {
  const date = extractDateOnly(dateStr);
  if (!date) return '';
  
  const [year, month, day] = date.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  return diasSemana[dateObj.getDay()];
}