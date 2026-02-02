/**
 * Utilitários de data padronizados
 * - ÚNICO lugar para operações com data
 * - Evita bugs de timezone
 * - Formato brasileiro (dd/MM/yyyy)
 */

/**
 * Formata data para exibição no formato brasileiro
 * @param dateStr - Data em formato ISO (YYYY-MM-DD) ou Date
 * @returns Data formatada (dd/MM/yyyy) ou '-' se inválida
 */
export function formatDateBR(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '-';

  try {
    // Se for string no formato ISO (YYYY-MM-DD)
    if (typeof dateStr === 'string') {
      // Extrai partes da data para evitar problemas de timezone
      const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const [, year, month, day] = match;
        return `${day}/${month}/${year}`;
      }

      // Tenta parsear como Date
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('pt-BR');
      }
    }

    // Se for Date object
    if (dateStr instanceof Date && !isNaN(dateStr.getTime())) {
      return dateStr.toLocaleDateString('pt-BR');
    }

    return '-';
  } catch {
    return '-';
  }
}

/**
 * Formata data e hora para exibição
 * @param dateStr - Data em formato ISO
 * @returns Data e hora formatadas (dd/MM/yyyy HH:mm)
 */
export function formatDateTimeBR(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '-';

  try {
    const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    if (isNaN(date.getTime())) return '-';

    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '-';
  }
}

/**
 * Converte data brasileira (dd/MM/yyyy) para ISO (YYYY-MM-DD)
 * @param dateBR - Data no formato brasileiro
 * @returns Data no formato ISO ou null se inválida
 */
export function parseDateBRtoISO(dateBR: string): string | null {
  if (!dateBR) return null;

  const match = dateBR.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;

  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

/**
 * Retorna data atual no formato ISO (YYYY-MM-DD)
 */
export function todayISO(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Retorna data atual no formato brasileiro (dd/MM/yyyy)
 */
export function todayBR(): string {
  return formatDateBR(todayISO());
}

/**
 * Adiciona dias a uma data
 * @param dateStr - Data em formato ISO
 * @param days - Número de dias a adicionar (pode ser negativo)
 * @returns Nova data em formato ISO
 */
export function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + 'T12:00:00'); // Meio-dia para evitar DST issues
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

/**
 * Calcula diferença em dias entre duas datas
 * @param from - Data inicial (ISO)
 * @param to - Data final (ISO)
 * @returns Número de dias de diferença
 */
export function diffDays(from: string, to: string): number {
  const fromDate = new Date(from + 'T12:00:00');
  const toDate = new Date(to + 'T12:00:00');
  const diffTime = toDate.getTime() - fromDate.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Formata data relativa (ex: "há 2 dias", "em 3 dias")
 */
export function formatRelativeDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';

  const today = todayISO();
  const diff = diffDays(today, dateStr);

  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Amanhã';
  if (diff === -1) return 'Ontem';
  if (diff > 0 && diff <= 7) return `Em ${diff} dias`;
  if (diff < 0 && diff >= -7) return `Há ${Math.abs(diff)} dias`;

  return formatDateBR(dateStr);
}

/** Regex para validar formato YYYY-MM-DD */
export const DATE_YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Extrai apenas a parte da data (YYYY-MM-DD) de uma string ISO ou Date
 * Evita problemas de timezone trabalhando apenas com strings
 */
export function extractDateOnly(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;

  // Se já é YYYY-MM-DD, retornar diretamente
  if (DATE_YYYY_MM_DD.test(dateStr)) {
    return dateStr;
  }

  // Extrair apenas a parte da data (antes do T ou espaço)
  const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

/**
 * Garante que a data seja salva como string YYYY-MM-DD
 * Evita conversões de timezone que causam -1 dia
 */
export function normalizeDateForDB(date: string | Date | null | undefined): string | null {
  if (!date) return null;

  // Se já é string YYYY-MM-DD, retornar diretamente
  if (typeof date === 'string' && DATE_YYYY_MM_DD.test(date)) {
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
