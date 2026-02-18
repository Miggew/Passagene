import type {
  OcrResult,
  OcrRow,
  OcrCorrection,
  AnimalRecord,
  ReportType,
} from '@/lib/types/escritorio';
import { matchRegistro, getConfidenceLevel } from './matchRegistro';

/**
 * Pós-processamento do resultado OCR:
 * 1. Aplica correções conhecidas (few-shot learning)
 * 2. Faz fuzzy match de registros contra BD
 * 3. Valida e normaliza resultados por tipo de serviço
 * 4. Calcula confidence scores finais
 */

// ============================================================
// Correções conhecidas
// ============================================================

/** Aplica correções do histórico para melhorar valores OCR */
export function applyCorrections(
  rows: OcrRow[],
  corrections: OcrCorrection[],
  reportType: ReportType,
): OcrRow[] {
  if (corrections.length === 0) return rows;

  // Indexar correções por (field_type, raw_value normalizado)
  const correctionMap = new Map<string, string>();
  for (const c of corrections) {
    if (c.report_type === reportType) {
      const key = `${c.field_type}::${c.raw_value.toUpperCase().trim()}`;
      correctionMap.set(key, c.corrected_value);
    }
  }

  return rows.map(row => {
    const newRow = { ...row };

    // Tentar corrigir registro
    const regKey = `registro::${row.registro.value.toUpperCase().trim()}`;
    if (correctionMap.has(regKey)) {
      newRow.registro = {
        ...row.registro,
        value: correctionMap.get(regKey)!,
        original_value: row.registro.value,
        confidence: Math.min(row.registro.confidence + 15, 95),
      };
    }

    // Tentar corrigir raça
    const racaKey = `raca::${row.raca.value.toUpperCase().trim()}`;
    if (correctionMap.has(racaKey)) {
      newRow.raca = {
        ...row.raca,
        value: correctionMap.get(racaKey)!,
        original_value: row.raca.value,
        confidence: Math.min(row.raca.confidence + 15, 95),
      };
    }

    // Tentar corrigir resultado
    const resKey = `resultado::${row.resultado.value.toUpperCase().trim()}`;
    if (correctionMap.has(resKey)) {
      newRow.resultado = {
        ...row.resultado,
        value: correctionMap.get(resKey)!,
        original_value: row.resultado.value,
        confidence: Math.min(row.resultado.confidence + 15, 95),
      };
    }

    return newRow;
  });
}

// ============================================================
// Match contra BD
// ============================================================

/** Enriquece linhas OCR com match contra animais do BD */
export function matchRowsAgainstDB(
  rows: OcrRow[],
  animals: AnimalRecord[],
): OcrRow[] {
  return rows.map(row => {
    if (!row.registro.value) return row;

    const match = matchRegistro(row.registro.value, animals);

    return {
      ...row,
      registro: {
        ...row.registro,
        matched_db: match.matched,
        matched_value: match.db_registro ?? undefined,
        confidence: match.matched
          ? Math.max(row.registro.confidence, match.confidence)
          : Math.min(row.registro.confidence, 40),
      },
    };
  });
}

// ============================================================
// Normalização de resultados por tipo
// ============================================================

/** Mapeamento de abreviações comuns do campo para valores do BD */
const DG_RESULT_MAP: Record<string, string> = {
  'P': 'PRENHE',
  'PRENHE': 'PRENHE',
  'PR': 'PRENHE',
  'V': 'VAZIA',
  'VAZIA': 'VAZIA',
  'VA': 'VAZIA',
  'R': 'RETOQUE',
  'RETOQUE': 'RETOQUE',
  'RET': 'RETOQUE',
};

const SEXAGEM_RESULT_MAP: Record<string, string> = {
  'F': 'PRENHE_FEMEA',
  'FEMEA': 'PRENHE_FEMEA',
  'FÊMEA': 'PRENHE_FEMEA',
  'M': 'PRENHE_MACHO',
  'MACHO': 'PRENHE_MACHO',
  'S': 'PRENHE_SEM_SEXO',
  'SEM SEXO': 'PRENHE_SEM_SEXO',
  'D': 'PRENHE_2_SEXOS',
  'DOIS SEXOS': 'PRENHE_2_SEXOS',
  '2 SEXOS': 'PRENHE_2_SEXOS',
  'V': 'VAZIA',
  'VAZIA': 'VAZIA',
};

const P2_RESULT_MAP: Record<string, string> = {
  '✓': 'APTA',
  'CHECK': 'APTA',
  'OK': 'APTA',
  'APTA': 'APTA',
  'X': 'PERDA',
  'PERDA': 'PERDA',
  'PERDEU': 'PERDA',
};

/** Normaliza o valor de resultado com base no tipo de relatório */
export function normalizeResultado(value: string, reportType: ReportType): { normalized: string; valid: boolean } {
  const upper = value.toUpperCase().trim();

  let map: Record<string, string>;
  switch (reportType) {
    case 'dg':
      map = DG_RESULT_MAP;
      break;
    case 'sexagem':
      map = SEXAGEM_RESULT_MAP;
      break;
    case 'p2':
      map = P2_RESULT_MAP;
      break;
    default:
      return { normalized: upper, valid: true };
  }

  const normalized = map[upper];
  return normalized
    ? { normalized, valid: true }
    : { normalized: upper, valid: false };
}

/** Normaliza resultados de todas as linhas */
export function normalizeRows(rows: OcrRow[], reportType: ReportType): OcrRow[] {
  return rows.map(row => {
    if (!row.resultado.value) return row;

    const { normalized, valid } = normalizeResultado(row.resultado.value, reportType);

    return {
      ...row,
      resultado: {
        ...row.resultado,
        value: normalized,
        original_value: row.resultado.value !== normalized ? row.resultado.value : undefined,
        confidence: valid
          ? Math.max(row.resultado.confidence, 90)
          : Math.min(row.resultado.confidence, 30),
      },
    };
  });
}

// ============================================================
// Pipeline completo
// ============================================================

/** Pipeline de pós-processamento completo */
export function postProcessOcr(
  ocrResult: OcrResult,
  animals: AnimalRecord[],
  corrections: OcrCorrection[],
  reportType: ReportType,
): OcrResult {
  let rows = ocrResult.rows;

  // 1. Aplicar correções históricas
  rows = applyCorrections(rows, corrections, reportType);

  // 2. Match contra BD
  rows = matchRowsAgainstDB(rows, animals);

  // 3. Normalizar resultados
  rows = normalizeRows(rows, reportType);

  // 4. Filtrar linhas vazias (sem registro e sem resultado)
  rows = rows.filter(row => row.registro.value || row.resultado.value);

  return {
    ...ocrResult,
    rows,
    metadata: {
      ...ocrResult.metadata,
      total_rows: rows.length,
    },
  };
}

/** Detecta diferenças entre dados originais e corrigidos para salvar em ocr_corrections */
export function detectCorrections(
  originalRows: OcrRow[],
  correctedRows: OcrRow[],
  reportType: ReportType,
  fazendaId: string,
  veterinario?: string,
): Omit<OcrCorrection, 'id' | 'created_at'>[] {
  const corrections: Omit<OcrCorrection, 'id' | 'created_at'>[] = [];

  for (let i = 0; i < originalRows.length && i < correctedRows.length; i++) {
    const orig = originalRows[i];
    const corr = correctedRows[i];

    if (orig.registro.value && corr.registro.value && orig.registro.value !== corr.registro.value) {
      corrections.push({
        report_type: reportType,
        field_type: 'registro',
        raw_value: orig.registro.value,
        corrected_value: corr.registro.value,
        fazenda_id: fazendaId,
        veterinario,
      });
    }

    if (orig.raca.value && corr.raca.value && orig.raca.value !== corr.raca.value) {
      corrections.push({
        report_type: reportType,
        field_type: 'raca',
        raw_value: orig.raca.value,
        corrected_value: corr.raca.value,
        fazenda_id: fazendaId,
        veterinario,
      });
    }

    if (orig.resultado.value && corr.resultado.value && orig.resultado.value !== corr.resultado.value) {
      corrections.push({
        report_type: reportType,
        field_type: 'resultado',
        raw_value: orig.resultado.value,
        corrected_value: corr.resultado.value,
        fazenda_id: fazendaId,
        veterinario,
      });
    }
  }

  return corrections;
}

export { getConfidenceLevel };
