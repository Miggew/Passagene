/**
 * Funções utilitárias para Lotes FIV
 * Extraídas de LotesFIV.tsx para reutilização e manutenção
 */

/**
 * Retorna o nome descritivo do dia de cultivo
 * @param dia - Número do dia (D-1 a D8)
 */
export function getNomeDia(dia: number): string {
  const nomesDias: { [key: number]: string } = {
    [-1]: 'Aspiração',
    0: 'Fecundação',
    1: 'Zigoto',
    2: 'Clivagem',
    3: 'Clivagem Avançada',
    4: 'Compactação',
    5: 'Mórula / Blastocisto Inicial',
    6: 'Blastocisto',
    7: 'Blastocisto Expandido',
    8: 'Resgate / Saída Tardia',
  };
  return nomesDias[dia] || `Dia ${dia}`;
}

/**
 * Retorna as classes CSS para o badge do dia de cultivo
 * Padrão: bg-[cor]-500/10 text-[cor]-600 dark:text-[cor]-400 border-[cor]-500/30
 * @param dia - Número do dia (D-1 a D8)
 */
export function getCorDia(dia: number): string {
  if (dia === -1) return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30'; // D-1 (Aspiração)
  if (dia === 0) return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'; // D0 (Fecundação)
  if (dia >= 1 && dia <= 3) return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'; // D1-D3 (Clivagem)
  if (dia >= 4 && dia <= 6) return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30'; // D4-D6 (Mórula/Blastocisto)
  if (dia === 7) return 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30'; // D7 (Transferência)
  if (dia === 8) return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30'; // D8 (Resgate)
  return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30';
}

/**
 * Chave para persistência de filtros no localStorage
 */
export const LOTES_FIV_FILTROS_KEY = 'lotes_fiv_filtros';

/**
 * Tipo para filtros persistidos
 */
export type LotesFivFiltrosPersistidos = {
  abaAtiva?: 'ativos' | 'historico';
  filtroFazendaAspiracao?: string;
  filtroFazendaAspiracaoBusca?: string;
  filtroDiaCultivo?: string;
  filtroHistoricoDataInicio?: string;
  filtroHistoricoDataFim?: string;
  filtroHistoricoFazenda?: string;
  filtroHistoricoFazendaBusca?: string;
  historicoPage?: number;
};

/**
 * Carrega filtros persistidos do localStorage
 */
export function carregarFiltrosLotesFiv(): LotesFivFiltrosPersistidos {
  try {
    const raw = localStorage.getItem(LOTES_FIV_FILTROS_KEY);
    return raw ? (JSON.parse(raw) as LotesFivFiltrosPersistidos) : {};
  } catch {
    return {};
  }
}

/**
 * Salva filtros no localStorage
 */
export function salvarFiltrosLotesFiv(filtros: LotesFivFiltrosPersistidos): void {
  try {
    localStorage.setItem(LOTES_FIV_FILTROS_KEY, JSON.stringify(filtros));
  } catch {
    // Silently fail if localStorage is not available
  }
}

/**
 * Página de histórico
 */
export const HISTORICO_PAGE_SIZE = 8;

/**
 * Converte diaAtual (dias desde D-1) para dia do cultivo
 * Lógica: diaAtual = 0 → D-1 (aspiração), diaAtual = 1 → D0 (fecundação), etc.
 * D8 é o ÚLTIMO DIA. Acima de D8 não existe mais lote FIV.
 * @param diaAtual - Número de dias desde a aspiração (D-1)
 * @returns Dia do cultivo (-1 a 8)
 */
export function getDiaCultivo(diaAtual: number): number {
  if (diaAtual === 0) {
    return -1; // D-1 (aspiração)
  }
  if (diaAtual > 9) {
    return 8; // D8 (acima de D8 não existe, mas mostrar D8 até ser fechado)
  }
  return diaAtual - 1; // Converte: 1→0 (D0), 2→1 (D1), ..., 8→7 (D7), 9→8 (D8)
}
