import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { OcrCorrection, ReportType } from '@/lib/types/escritorio';

/** Carrega correções recentes por fazenda + tipo */
export function useOcrCorrections(fazendaId: string | undefined, reportType: ReportType) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['ocr-corrections', fazendaId, reportType],
    queryFn: async (): Promise<OcrCorrection[]> => {
      if (!fazendaId) return [];

      const { data, error } = await supabase
        .from('ocr_corrections')
        .select('*')
        .eq('fazenda_id', fazendaId)
        .eq('report_type', reportType)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return (data || []) as OcrCorrection[];
    },
    enabled: !!fazendaId,
  });

  const saveMutation = useMutation({
    mutationFn: async (corrections: Omit<OcrCorrection, 'id' | 'created_at'>[]) => {
      if (corrections.length === 0) return;

      const { error } = await supabase
        .from('ocr_corrections')
        .insert(corrections);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ocr-corrections', fazendaId, reportType] });
    },
  });

  return {
    corrections: query.data || [],
    isLoading: query.isLoading,
    saveCorrections: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
  };
}
