// ============================================================
// Types para o Hub Escritório
// ============================================================

/** Tipos de relatório suportados */
export type ReportType = 'p1' | 'p2' | 'te' | 'dg' | 'sexagem' | 'aspiracao';

/** Status de uma importação */
export type ImportStatus = 'processing' | 'review' | 'completed' | 'reverted';

/** Nível de confiança do OCR */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

// ============================================================
// OCR — campos e linhas extraídas
// ============================================================

/** Campo OCR com valor e confiança */
export interface OcrField<T = string> {
  value: T;
  confidence: number;           // 0-100
  matched_db?: boolean;          // true se matched contra BD
  matched_value?: string;        // valor do BD que fez match
  original_value?: string;       // valor antes da correção do usuário
}

/** Linha extraída pelo OCR (relatório universal) */
export interface OcrRow {
  numero: number;
  registro: OcrField;
  raca: OcrField;
  resultado: OcrField;
  obs: OcrField;
}

/** Linha extraída pelo OCR (relatório aspiração) */
export interface OcrAspiracaoRow {
  numero: number;
  registro: OcrField;
  raca: OcrField;
  atresicos: OcrField<number>;
  degenerados: OcrField<number>;
  expandidos: OcrField<number>;
  desnudos: OcrField<number>;
  viaveis: OcrField<number>;
  total: OcrField<number>;
}

/** Header do relatório extraído por OCR */
export interface OcrHeader {
  fazenda: OcrField;
  data: OcrField;
  veterinario: OcrField;
  tecnico: OcrField;
  servico_detectado: ReportType | null;
}

/** Resposta completa do OCR */
export interface OcrResult {
  header: OcrHeader;
  rows: OcrRow[];
  metadata: {
    pagina: string;             // "1/2" se detectado
    total_rows: number;
  };
}

/** Resposta OCR para aspiração */
export interface OcrAspiracaoResult {
  header: OcrHeader;
  rows: OcrAspiracaoRow[];
  metadata: {
    pagina: string;
    total_rows: number;
  };
}

// ============================================================
// Correções OCR (aprendizado)
// ============================================================

export interface OcrCorrection {
  id: string;
  report_type: ReportType;
  field_type: string;
  raw_value: string;
  corrected_value: string;
  fazenda_id: string;
  veterinario?: string;
  created_at: string;
}

// ============================================================
// Import de relatórios
// ============================================================

export interface ReportImport {
  id: string;
  report_type: ReportType;
  image_path: string | null;
  extracted_data: unknown;
  final_data: unknown;
  status: ImportStatus;
  fazenda_id: string | null;
  protocolo_id: string | null;
  pacote_aspiracao_id: string | null;
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
  reverted_at: string | null;
}

// ============================================================
// Entrada manual — linhas por tipo de serviço
// ============================================================

/** DG - entrada manual */
export interface DGEntryRow {
  protocolo_receptora_id: string;
  receptora_id: string;
  registro: string;
  nome?: string;
  raca?: string;
  resultado: 'PRENHE' | 'VAZIA' | 'RETOQUE' | '';
  observacoes?: string;
}

/** Sexagem - entrada manual */
export interface SexagemEntryRow {
  protocolo_receptora_id: string;
  receptora_id: string;
  registro: string;
  nome?: string;
  raca?: string;
  resultado: 'PRENHE_FEMEA' | 'PRENHE_MACHO' | 'PRENHE_SEM_SEXO' | 'PRENHE_2_SEXOS' | 'VAZIA' | '';
  observacoes?: string;
}

/** P2 - entrada manual */
export interface P2EntryRow {
  protocolo_receptora_id: string;
  receptora_id: string;
  registro: string;
  nome?: string;
  raca?: string;
  is_perda: boolean;
}

/** TE - entrada manual */
export interface TEEntryRow {
  protocolo_receptora_id: string;
  receptora_id: string;
  registro: string;
  nome?: string;
  raca?: string;
  embriao_id: string;
  embriao_codigo?: string;
  observacoes?: string;
}

/** Aspiração - entrada manual */
export interface AspiracaoEntryRow {
  doadora_id?: string;
  registro: string;
  nome?: string;
  raca?: string;
  isNew?: boolean;
  horario_aspiracao: string;
  hora_final: string;
  atresicos: number;
  degenerados: number;
  expandidos: number;
  desnudos: number;
  viaveis: number;
  total: number;
  recomendacao_touro?: string;
  observacoes?: string;
}

/** P1 - entrada manual */
export interface P1EntryRow {
  receptora_id?: string;
  registro: string;
  nome?: string;
  raca?: string;
  cl?: 'N' | 'CL' | '';
  avaliacao?: 'Ruim' | 'Média' | 'Boa' | '';
  isNew?: boolean;
  observacoes?: string;
}

// ============================================================
// Match result (fuzzy matching)
// ============================================================

export interface MatchResult {
  matched: boolean;
  db_id: string | null;
  db_registro: string | null;
  db_nome?: string;
  confidence: number;           // 0-100
  distance: number;             // edit distance or custom metric
}

/** Animal do BD para matching */
export interface AnimalRecord {
  id: string;
  registro: string;
  nome?: string;
  raca?: string;
  status_reprodutivo?: string;
  numero_gestacoes?: number;
  is_blocked?: boolean; // Se o status atual impede sua selecao (ex: PRENHE)
}

// ============================================================
// Modo de entrada
// ============================================================

export type EntryMode = 'ocr' | 'manual';
