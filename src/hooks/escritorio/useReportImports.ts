import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ReportImport } from '@/lib/types/escritorio';

/** Histórico de importações + rollback */
export function useReportImports(fazendaId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['report-imports', fazendaId],
    queryFn: async (): Promise<ReportImport[]> => {
      let q = supabase
        .from('report_imports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (fazendaId) {
        q = q.eq('fazenda_id', fazendaId);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as ReportImport[];
    },
  });

  /** Cria registro de importação */
  const createImport = useMutation({
    mutationFn: async (importData: Partial<ReportImport>) => {
      const { data, error } = await supabase
        .from('report_imports')
        .insert(importData)
        .select()
        .single();

      if (error) throw error;
      return data as ReportImport;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-imports'] });
    },
  });

  /** Atualiza status da importação */
  const updateImport = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<ReportImport>) => {
      const { error } = await supabase
        .from('report_imports')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-imports'] });
    },
  });

  /** Reverte uma importação via RPC */
  const revertImport = useMutation({
    mutationFn: async (importId: string) => {
      const { data, error } = await supabase.rpc('reverter_import', {
        p_import_id: importId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-imports'] });
      // Invalidar queries que podem ter sido afetadas
      queryClient.invalidateQueries({ queryKey: ['receptoras'] });
      queryClient.invalidateQueries({ queryKey: ['diagnosticos'] });
      queryClient.invalidateQueries({ queryKey: ['transferencias'] });
      queryClient.invalidateQueries({ queryKey: ['aspiracoes'] });
      queryClient.invalidateQueries({ queryKey: ['protocolos'] });
    },
  });

  return {
    imports: query.data || [],
    isLoading: query.isLoading,
    createImport: createImport.mutateAsync,
    updateImport: updateImport.mutateAsync,
    revertImport: revertImport.mutateAsync,
    isReverting: revertImport.isPending,
  };
}
