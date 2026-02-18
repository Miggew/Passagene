import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { ReportType, OcrResult } from '@/lib/types/escritorio';
import { postProcessOcr } from '@/utils/escritorio/postProcess';
import type { AnimalRecord, OcrCorrection } from '@/lib/types/escritorio';

type OcrStep = 'idle' | 'uploading' | 'processing' | 'post-processing' | 'done' | 'error';

interface UseReportOcrOptions {
  reportType: ReportType;
  fazendaId: string;
  protocolId?: string;
  animals: AnimalRecord[];
  corrections: OcrCorrection[];
}

export function useReportOcr({ reportType, fazendaId, protocolId, animals, corrections }: UseReportOcrOptions) {
  const [step, setStep] = useState<OcrStep>('idle');
  const [result, setResult] = useState<OcrResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback(async (file: File): Promise<OcrResult> => {
    setError(null);
    setStep('uploading');

    try {
      // 1. Upload para Storage
      const timestamp = Date.now();
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${fazendaId}/${timestamp}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('report-images')
        .upload(path, file, { contentType: file.type });

      if (uploadError) throw new Error(`Upload falhou: ${uploadError.message}`);

      // 2. Invocar Edge Function via fetch direto
      setStep('processing');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const session = (await supabase.auth.getSession()).data.session;

      const resp = await fetch(`${supabaseUrl}/functions/v1/report-ocr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${session?.access_token || supabaseAnonKey}`,
        },
        body: JSON.stringify({
          image_path: path,
          report_type: reportType,
          context: {
            fazenda_id: fazendaId,
            protocol_id: protocolId,
          },
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`OCR falhou (${resp.status}): ${errText.substring(0, 200)}`);
      }

      const json = await resp.json();
      if (!json.success) throw new Error(json.error || 'Erro no OCR');

      // 3. Pós-processamento
      setStep('post-processing');
      const processed = postProcessOcr(json.data, animals, corrections, reportType);

      setResult(processed);
      setStep('done');
      return processed;

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(msg);
      setStep('error');
      throw err;
    }
  }, [reportType, fazendaId, protocolId, animals, corrections]);

  const reset = useCallback(() => {
    setStep('idle');
    setResult(null);
    setError(null);
  }, []);

  return { step, result, error, processFile, reset };
}
