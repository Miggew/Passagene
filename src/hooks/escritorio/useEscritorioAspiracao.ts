import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { AspiracaoEntryRow, AnimalRecord } from '@/lib/types/escritorio';

interface UseAspiracaoOptions {
  fazendaId?: string;
}

/** Carrega doadoras para autocomplete + salva batch aspiração */
export function useEscritorioAspiracao({ fazendaId }: UseAspiracaoOptions) {
  const queryClient = useQueryClient();

  /** Doadoras conhecidas para autocomplete */
  const doadorasQuery = useQuery({
    queryKey: ['escritorio-aspiracao-doadoras', fazendaId],
    queryFn: async (): Promise<AnimalRecord[]> => {
      const { data, error } = await supabase
        .from('doadoras')
        .select('id, registro, nome, raca')
        .limit(500);

      if (error) throw error;
      return (data || []) as AnimalRecord[];
    },
    enabled: !!fazendaId,
  });

  /** Fazendas para seleção */
  const fazendasQuery = useQuery({
    queryKey: ['fazendas-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fazendas')
        .select('id, nome')
        .order('nome');

      if (error) throw error;
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({
      fazendaDestinoId,
      dataAspiracao,
      horarioInicio,
      veterinario,
      tecnico,
      observacoes,
      doadoras,
    }: {
      fazendaDestinoId?: string;
      dataAspiracao: string;
      horarioInicio: string;
      veterinario: string;
      tecnico: string;
      observacoes?: string;
      doadoras: AspiracaoEntryRow[];
    }) => {
      const { data, error } = await supabase.rpc('registrar_aspiracao_batch', {
        p_fazenda_id: fazendaId!,
        p_fazenda_destino_id: fazendaDestinoId || fazendaId!,
        p_data_aspiracao: dataAspiracao,
        p_horario_inicio: horarioInicio,
        p_veterinario: veterinario,
        p_tecnico: tecnico,
        p_observacoes: observacoes || null,
        p_doadoras: doadoras.map(d => ({
          doadora_id: d.doadora_id,
          horario_aspiracao: d.horario_aspiracao,
          hora_final: d.hora_final || null,
          atresicos: d.atresicos,
          degenerados: d.degenerados,
          expandidos: d.expandidos,
          desnudos: d.desnudos,
          viaveis: d.viaveis,
          recomendacao_touro: d.recomendacao_touro || null,
          observacoes: d.observacoes || null,
        })),
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aspiracoes'] });
      queryClient.invalidateQueries({ queryKey: ['doadoras'] });
      queryClient.invalidateQueries({ queryKey: ['escritorio-aspiracao-doadoras'] });
    },
  });

  return {
    doadoras: doadorasQuery.data || [],
    fazendas: fazendasQuery.data || [],
    isLoading: doadorasQuery.isLoading,
    save: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
  };
}
