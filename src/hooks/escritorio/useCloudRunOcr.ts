import { useState, useCallback } from 'react';
import { compressImage, fileToBase64, fetchWithRetry, PIPELINE_URL } from '@/lib/cloudRunOcr';
import type { ReportType, OcrResult, OcrAspiracaoResult, OcrRow } from '@/lib/types/escritorio';

type OcrStep = 'idle' | 'compressing' | 'sending' | 'processing' | 'done' | 'error';

interface UseCloudRunOcrOptions {
  reportType: ReportType;
  fazendaId: string;
}

/** Merge multiple OCR pages into one result, flagging duplicate registros */
export function mergeOcrResults(results: OcrResult[]): OcrResult {
  const allRows = results.flatMap(r => r.rows);

  // Count occurrences by registro key to detect duplicates
  const countByKey = new Map<string, number>();
  for (const row of allRows) {
    const key = (row.registro.matched_value || row.registro.value).toUpperCase().trim();
    if (!key) continue;
    countByKey.set(key, (countByKey.get(key) || 0) + 1);
  }

  // Re-number and mark duplicates with low confidence for human review
  const merged: OcrRow[] = allRows.map((row, i) => {
    const key = (row.registro.matched_value || row.registro.value).toUpperCase().trim();
    const isDuplicate = key && (countByKey.get(key) || 0) > 1;
    return {
      ...row,
      numero: i + 1,
      registro: isDuplicate
        ? { ...row.registro, confidence: Math.min(row.registro.confidence, 30) }
        : row.registro,
    };
  });

  return {
    rows: merged,
    header: results[0]?.header,
    metadata: {
      pagina: `1-${results.length}`,
      total_rows: merged.length,
    },
  };
}

export function useCloudRunOcr({ reportType, fazendaId }: UseCloudRunOcrOptions) {
  const [step, setStep] = useState<OcrStep>('idle');
  const [result, setResult] = useState<OcrResult | OcrAspiracaoResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback(async (file: File): Promise<OcrResult | OcrAspiracaoResult> => {
    setError(null);
    setStep('compressing');

    try {
      // 1. Compress image (max 2048px, JPEG ~400KB)
      const compressed = await compressImage(file);

      // 2. Convert to base64
      const base64 = await fileToBase64(compressed);

      // 3. Send to Cloud Run
      setStep('sending');
      const resp = await fetchWithRetry(`${PIPELINE_URL}/ocr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: base64,
          mime_type: 'image/jpeg',
          report_type: reportType,
          fazenda_id: fazendaId,
        }),
      });

      setStep('processing');

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`OCR falhou (${resp.status}): ${errText.substring(0, 200)}`);
      }

      const json = await resp.json();
      if (!json.success) throw new Error(json.error || 'Erro no OCR');

      // Result is already post-processed server-side
      const processed = json.data as OcrResult | OcrAspiracaoResult;
      setResult(processed);
      setStep('done');
      return processed;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(msg);
      setStep('error');
      throw err;
    }
  }, [reportType, fazendaId]);

  const processMultipleFiles = useCallback(async (files: File[]): Promise<OcrResult> => {
    setError(null);
    setStep('compressing');

    try {
      // Process all pages in parallel
      const results = await Promise.all(files.map(async (file) => {
        const compressed = await compressImage(file);
        const base64 = await fileToBase64(compressed);

        setStep('sending');
        const resp = await fetchWithRetry(`${PIPELINE_URL}/ocr`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_base64: base64,
            mime_type: 'image/jpeg',
            report_type: reportType,
            fazenda_id: fazendaId,
          }),
        });

        if (!resp.ok) {
          const errText = await resp.text();
          throw new Error(`OCR falhou (${resp.status}): ${errText.substring(0, 200)}`);
        }

        const json = await resp.json();
        if (!json.success) throw new Error(json.error || 'Erro no OCR');
        return json.data as OcrResult;
      }));

      setStep('processing');
      const merged = mergeOcrResults(results);
      setResult(merged);
      setStep('done');
      return merged;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(msg);
      setStep('error');
      throw err;
    }
  }, [reportType, fazendaId]);

  const reset = useCallback(() => {
    setStep('idle');
    setResult(null);
    setError(null);
  }, []);

  return { step, result, error, processFile, processMultipleFiles, reset };
}
