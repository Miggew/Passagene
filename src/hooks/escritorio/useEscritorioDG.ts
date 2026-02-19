import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { DGEntryRow } from '@/lib/types/escritorio';

interface UseDGOptions {
  fazendaId?: string;
  /** Filtrar receptoras por data da TE */
  dataTE?: string;
}

/** Carrega receptoras SERVIDAS/UTILIZADAS para DG + salva batch */
export function useEscritorioDG({ fazendaId, dataTE }: UseDGOptions) {
  const queryClient = useQueryClient();

  /** Carrega receptoras com status SERVIDA/UTILIZADA */
  const receptorasQuery = useQuery({
    queryKey: ['escritorio-dg-receptoras', fazendaId, dataTE],
    queryFn: async (): Promise<DGEntryRow[]> => {
      if (!fazendaId) return [];

      // Buscar protocolo_receptoras com status SERVIDA via view
      let q = supabase
        .from('protocolo_receptoras')
        .select(`
          id,
          receptora_id,
          status,
          receptoras!inner(id, identificacao, nome, raca)
        `)
        .in('status', ['SERVIDA', 'UTILIZADA']);

      // Filtrar por fazenda via transferência
      if (dataTE) {
        // Buscar receptoras que foram transferidas nesta data
        const { data: tes } = await supabase
          .from('transferencias_embrioes')
          .select('receptora_id, protocolo_receptora_id')
          .eq('data_te', dataTE);

        if (tes && tes.length > 0) {
          const prIds = tes.map(t => t.protocolo_receptora_id).filter(Boolean);
          q = q.in('id', prIds);
        } else {
          return [];
        }
      }

      const { data, error } = await q.limit(200);
      if (error) throw error;

      return (data || []).map((pr: any) => ({
        protocolo_receptora_id: pr.id,
        receptora_id: pr.receptora_id,
        registro: pr.receptoras?.identificacao || '',
        nome: pr.receptoras?.nome,
        raca: pr.receptoras?.raca,
        resultado: '' as const,
        observacoes: '',
      }));
    },
    enabled: !!fazendaId,
  });

  /** Salva resultados DG em batch via RPC */
  const saveMutation = useMutation({
    mutationFn: async ({
      dataDiagnostico,
      veterinario,
      tecnico,
      resultados,
    }: {
      dataDiagnostico: string;
      veterinario: string;
      tecnico: string;
      resultados: DGEntryRow[];
    }) => {
      const filteredResults = resultados.filter(r => r.resultado !== '');

      const { data, error } = await supabase.rpc('registrar_dg_batch', {
        p_data_diagnostico: dataDiagnostico,
        p_veterinario: veterinario,
        p_tecnico: tecnico,
        p_fazenda_id: fazendaId!,
        p_resultados: filteredResults.map(r => ({
          protocolo_receptora_id: r.protocolo_receptora_id,
          receptora_id: r.receptora_id,
          resultado: r.resultado,
          observacoes: r.observacoes || null,
        })),
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receptoras'] });
      queryClient.invalidateQueries({ queryKey: ['diagnosticos'] });
      queryClient.invalidateQueries({ queryKey: ['escritorio-dg-receptoras'] });
    },
  });

  return {
    receptoras: receptorasQuery.data || [],
    isLoading: receptorasQuery.isLoading,
    save: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
  };
}
