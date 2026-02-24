import type { AnimalRecord, MatchResult } from '@/lib/types/escritorio';

/**
 * Fuzzy match customizado para registros de animais.
 *
 * Registros são semi-estruturados: prefixo alfanumérico + número.
 * Ex: "REC-0235", "DOA-001", "ABC123", "0235"
 *
 * Estratégia:
 * 1. Normalizar (uppercase, remover espaços)
 * 2. Match exato → 100%
 * 3. Prefixo exato + tolerância numérica → 70-95%
 * 4. Apenas número com tolerância → 50-70%
 * 5. Levenshtein como fallback → 30-60%
 */

/** Normaliza registro: uppercase, trim, remove espaços extras */
function normalize(value: string): string {
  return value.toUpperCase().trim().replace(/\s+/g, '');
}

/** Separa prefixo alfanumérico da parte numérica */
function splitRegistro(reg: string): { prefix: string; number: string; numericValue: number } {
  const normalized = normalize(reg);
  // Match: tudo antes do último grupo de dígitos = prefixo
  const match = normalized.match(/^([A-Z\-_]*?)(\d+)$/);
  if (match) {
    return {
      prefix: match[1],
      number: match[2],
      numericValue: parseInt(match[2], 10),
    };
  }
  // Sem parte numérica clara
  return { prefix: normalized, number: '', numericValue: -1 };
}

/** Distância de Levenshtein simplificada */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Faz match de um registro OCR contra uma lista de animais do BD.
 * Retorna o melhor match encontrado.
 */
export function matchRegistro(
  ocrValue: string,
  animals: AnimalRecord[],
): MatchResult {
  if (!ocrValue || animals.length === 0) {
    return { matched: false, db_id: null, db_registro: null, confidence: 0, distance: 999 };
  }

  const normalizedOcr = normalize(ocrValue);
  const ocrParts = splitRegistro(ocrValue);

  let bestMatch: MatchResult = {
    matched: false,
    db_id: null,
    db_registro: null,
    confidence: 0,
    distance: 999,
  };

  for (const animal of animals) {
    const normalizedDb = normalize(animal.registro);
    const dbParts = splitRegistro(animal.registro);

    let confidence = 0;
    let distance = 999;

    // 1. Match exato
    if (normalizedOcr === normalizedDb) {
      return {
        matched: true,
        db_id: animal.id,
        db_registro: animal.registro,
        db_nome: animal.nome,
        confidence: 100,
        distance: 0,
      };
    }

    // 2. Prefixo exato + número próximo
    if (
      ocrParts.prefix &&
      dbParts.prefix &&
      ocrParts.prefix === dbParts.prefix &&
      ocrParts.numericValue >= 0 &&
      dbParts.numericValue >= 0
    ) {
      const numDiff = Math.abs(ocrParts.numericValue - dbParts.numericValue);
      if (numDiff === 0) {
        // Prefixo igual, número igual (mas normalização diferiu — ex: zeros à esquerda)
        confidence = 98;
        distance = 0;
      } else if (numDiff <= 1) {
        // Off-by-one (erro OCR comum: 5↔6, 3↔8)
        confidence = 88;
        distance = 1;
      } else if (numDiff <= 5) {
        confidence = 75;
        distance = numDiff;
      } else if (numDiff <= 10) {
        confidence = 60;
        distance = numDiff;
      }
    }

    // 3. Sem prefixo no OCR mas número bate
    if (
      confidence < 70 &&
      ocrParts.numericValue >= 0 &&
      dbParts.numericValue >= 0 &&
      !ocrParts.prefix &&
      dbParts.prefix
    ) {
      const numDiff = Math.abs(ocrParts.numericValue - dbParts.numericValue);
      if (numDiff === 0) {
        confidence = Math.max(confidence, 70);
        distance = Math.min(distance, 0);
      } else if (numDiff <= 2) {
        confidence = Math.max(confidence, 55);
        distance = Math.min(distance, numDiff);
      }
    }

    // 4. Levenshtein fallback
    if (confidence < 50) {
      const lev = levenshtein(normalizedOcr, normalizedDb);
      const maxLen = Math.max(normalizedOcr.length, normalizedDb.length);
      if (maxLen > 0) {
        const levConfidence = Math.max(0, Math.round((1 - lev / maxLen) * 100));
        if (levConfidence > confidence && lev <= 2) {
          confidence = Math.min(levConfidence, 60); // Cap Levenshtein confidence
          distance = lev;
        }
      }
    }

    if (confidence > bestMatch.confidence) {
      bestMatch = {
        matched: confidence >= 60,
        db_id: animal.id,
        db_registro: animal.registro,
        db_nome: animal.nome,
        confidence,
        distance,
      };
    }
  }

  return bestMatch;
}

/**
 * Faz match de múltiplas linhas OCR contra animais do BD.
 * Retorna mapa: índice da linha → MatchResult
 */
export function matchRegistros(
  ocrValues: string[],
  animals: AnimalRecord[],
): Map<number, MatchResult> {
  const results = new Map<number, MatchResult>();
  for (let i = 0; i < ocrValues.length; i++) {
    results.set(i, matchRegistro(ocrValues[i], animals));
  }
  return results;
}

/**
 * Retorna o nível de confiança visual.
 */
export function getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= 90) return 'high';
  if (confidence >= 70) return 'medium';
  return 'low';
}
