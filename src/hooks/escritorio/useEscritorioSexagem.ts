import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { SexagemEntryRow } from '@/lib/types/escritorio';

interface UseSexagemOptions {
  fazendaId?: string;
}

/** Carrega receptoras PRENHE/PRENHE_RETOQUE para sexagem + salva batch */
export function useEscritorioSexagem({ fazendaId }: UseSexagemOptions) {
  const queryClient = useQueryClient();

  const receptorasQuery = useQuery({
    queryKey: ['escritorio-sexagem-receptoras', fazendaId],
    queryFn: async (): Promise<SexagemEntryRow[]> => {
      if (!fazendaId) return [];

      const { data, error } = await supabase
        .from('protocolo_receptoras')
        .select(`
          id,
          receptora_id,
          status,
          receptoras!inner(id, identificacao, nome, raca)
        `)
        .in('status', ['PRENHE', 'PRENHE_RETOQUE'])
        .limit(200);

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

  const saveMutation = useMutation({
    mutationFn: async ({
      dataSexagem,
      veterinario,
      tecnico,
      resultados,
    }: {
      dataSexagem: string;
      veterinario: string;
      tecnico: string;
      resultados: SexagemEntryRow[];
    }) => {
      const filtered = resultados.filter(r => r.resultado !== '');

      const { data, error } = await supabase.rpc('registrar_sexagem_batch', {
        p_data_sexagem: dataSexagem,
        p_veterinario: veterinario,
        p_tecnico: tecnico,
        p_fazenda_id: fazendaId!,
        p_resultados: filtered.map(r => ({
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
      queryClient.invalidateQueries({ queryKey: ['escritorio-sexagem-receptoras'] });
    },
  });

  return {
    receptoras: receptorasQuery.data || [],
    isLoading: receptorasQuery.isLoading,
    save: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
  };
}
