/**
 * Utilitários para cálculos de gestação
 */

/**
 * Calcula o número de dias de gestação a partir da data de abertura do lote (D0)
 */
export function calcularDiasGestacao(dataAberturaLote: string): number {
  const d0 = new Date(dataAberturaLote);
  const hoje = new Date();
  return Math.floor((hoje.getTime() - d0.getTime()) / (1000 * 60 * 60 * 24));
}

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
 * Retorna a data de hoje no formato YYYY-MM-DD
 */
export function getHoje(): string {
  return new Date().toISOString().split('T')[0];
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
 * Valida se veterinário e técnico estão preenchidos
 */
export function validarResponsaveis(formData: LoteFormDataBase): boolean {
  return formData.veterinario_responsavel.trim() !== '' &&
         formData.tecnico_responsavel.trim() !== '';
}
