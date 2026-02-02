/**
 * Utilitários para cálculos de gestação
 */

/**
 * Dias mínimos de gestação para cada procedimento
 */
export const DIAS_MINIMOS = {
  DG: 27,      // Diagnóstico de Gestação: mínimo 27 dias após fecundação
  SEXAGEM: 54, // Sexagem Fetal: mínimo 54 dias após fecundação
} as const;

/**
 * Calcula a data provável de parto (D0 + 275 dias)
 */
export function calcularDataProvavelParto(dataAberturaLote: string): string {
  const d0 = new Date(dataAberturaLote);
  const dataParto = new Date(d0);
  dataParto.setDate(dataParto.getDate() + 275);
  return dataParto.toISOString().split('T')[0];
}

/**
 * Interface base para lote de TE (usada em DG e Sexagem)
 */
export interface LoteTEBase {
  id: string; // chave: fazenda_id-data_te
  fazenda_id: string;
  fazenda_nome: string;
  data_te: string;
  quantidade_receptoras: number;
  status: 'ABERTO' | 'FECHADO';
  dias_gestacao?: number; // Dias desde a fecundação (D0)
  data_abertura_lote?: string; // Data de abertura do lote FIV (D0)
}

/**
 * Interface para lote de DG
 */
export interface LoteTEDiagnostico extends LoteTEBase {
  veterinario_dg?: string;
  tecnico_dg?: string;
}

/**
 * Interface para lote de Sexagem
 */
export interface LoteTESexagem extends LoteTEBase {
  veterinario_sexagem?: string;
  tecnico_sexagem?: string;
}

/**
 * Interface para embrião transferido (comum em DG e Sexagem)
 */
export interface EmbriaoTransferido {
  te_id: string;
  embriao_id: string;
  embriao_identificacao?: string;
  embriao_classificacao?: string;
  lote_fiv_id: string;
  lote_fiv_acasalamento_id?: string;
  doadora_registro?: string;
  touro_nome?: string;
}

/**
 * Form data base para veterinário e técnico responsáveis
 */
export interface LoteFormDataBase {
  veterinario_responsavel: string;
  tecnico_responsavel: string;
}

/**
 * Valida se o veterinário está preenchido (técnico é opcional)
 */
export function validarResponsaveis(formData: LoteFormDataBase): boolean {
  return formData.veterinario_responsavel.trim() !== '';
}
