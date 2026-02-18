import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { P2EntryRow } from '@/lib/types/escritorio';

interface UseP2Options {
  protocoloId?: string;
}

/** Carrega receptoras do protocolo para confirmação P2 + salva batch */
export function useEscritorioP2({ protocoloId }: UseP2Options) {
  const queryClient = useQueryClient();

  const receptorasQuery = useQuery({
    queryKey: ['escritorio-p2-receptoras', protocoloId],
    queryFn: async (): Promise<P2EntryRow[]> => {
      if (!protocoloId) return [];

      const { data, error } = await supabase
        .from('protocolo_receptoras')
        .select(`
          id,
          receptora_id,
          status,
          receptoras!inner(id, registro, nome, raca)
        `)
        .eq('protocolo_id', protocoloId)
        .not('status', 'eq', 'INAPTA')
        .limit(200);

      if (error) throw error;

      return (data || []).map((pr: any) => ({
        protocolo_receptora_id: pr.id,
        receptora_id: pr.receptora_id,
        registro: pr.receptoras?.registro || '',
        nome: pr.receptoras?.nome,
        raca: pr.receptoras?.raca,
        is_perda: false,
      }));
    },
    enabled: !!protocoloId,
  });

  const saveMutation = useMutation({
    mutationFn: async ({
      dataConfirmacao,
      veterinario,
      tecnico,
      rows,
    }: {
      dataConfirmacao: string;
      veterinario: string;
      tecnico: string;
      rows: P2EntryRow[];
    }) => {
      const perdasIds = rows
        .filter(r => r.is_perda)
        .map(r => r.protocolo_receptora_id);

      const { data, error } = await supabase.rpc('confirmar_p2_batch', {
        p_protocolo_id: protocoloId!,
        p_data_confirmacao: dataConfirmacao,
        p_veterinario: veterinario,
        p_tecnico: tecnico,
        p_perdas_ids: perdasIds,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['protocolos'] });
      queryClient.invalidateQueries({ queryKey: ['receptoras'] });
      queryClient.invalidateQueries({ queryKey: ['escritorio-p2-receptoras'] });
    },
  });

  return {
    receptoras: receptorasQuery.data || [],
    isLoading: receptorasQuery.isLoading,
    save: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
  };
}
