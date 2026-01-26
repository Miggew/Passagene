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
 * @param dia - Número do dia (D-1 a D8)
 */
export function getCorDia(dia: number): string {
  if (dia === -1) return 'bg-blue-100 text-blue-800 border-blue-300'; // D-1 (Aspiração)
  if (dia === 0) return 'bg-green-100 text-green-800 border-green-300'; // D0 (Fecundação)
  if (dia >= 1 && dia <= 3) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
  if (dia >= 4 && dia <= 5) return 'bg-orange-100 text-orange-800 border-orange-300';
  if (dia === 6) return 'bg-orange-100 text-orange-800 border-orange-300';
  if (dia === 7) return 'bg-purple-100 text-purple-800 border-purple-300'; // D7 (Transferência)
  if (dia === 8) return 'bg-red-100 text-red-800 border-red-300';
  return 'bg-slate-100 text-slate-800 border-slate-300';
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
