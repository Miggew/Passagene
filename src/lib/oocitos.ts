/**
 * Utilitários para cálculos de oócitos
 */

export interface OocitosData {
  atresicos: string | number;
  degenerados: string | number;
  expandidos: string | number;
  desnudos: string | number;
  viaveis: string | number;
}

/**
 * Calcula o total de oócitos a partir dos campos do formulário
 */
export function calculateTotalOocitos(data: OocitosData): number {
  const atresicos = typeof data.atresicos === 'string' ? parseInt(data.atresicos) || 0 : data.atresicos || 0;
  const degenerados = typeof data.degenerados === 'string' ? parseInt(data.degenerados) || 0 : data.degenerados || 0;
  const expandidos = typeof data.expandidos === 'string' ? parseInt(data.expandidos) || 0 : data.expandidos || 0;
  const desnudos = typeof data.desnudos === 'string' ? parseInt(data.desnudos) || 0 : data.desnudos || 0;
  const viaveis = typeof data.viaveis === 'string' ? parseInt(data.viaveis) || 0 : data.viaveis || 0;
  return atresicos + degenerados + expandidos + desnudos + viaveis;
}

/**
 * Adiciona horas a um horário no formato HH:MM
 */
export function adicionarHoras(horario: string, horas: number): string {
  if (!horario) return '';
  const [h, m] = horario.split(':').map(Number);
  const totalMinutos = h * 60 + m + horas * 60;
  const novaHora = Math.floor(totalMinutos / 60) % 24;
  const novoMinuto = totalMinutos % 60;
  return `${String(novaHora).padStart(2, '0')}:${String(novoMinuto).padStart(2, '0')}`;
}

/**
 * Estado inicial do formulário de oócitos
 */
export const initialOocitosForm = {
  atresicos: '',
  degenerados: '',
  expandidos: '',
  desnudos: '',
  viaveis: '',
};
