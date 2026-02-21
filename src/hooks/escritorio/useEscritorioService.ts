/**
 * useEscritorioService — hook genérico para DG e Sexagem.
 *
 * Encapsula o padrão comum: carregar receptoras por status,
 * salvar resultados via RPC batch, invalidar queries.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/** Base compartilhada entre DGEntryRow e SexagemEntryRow */
interface BaseEntryRow {
  protocolo_receptora_id: string;
  receptora_id: string;
  registro: string;
  nome?: string;
  raca?: string;
  resultado: string;
  observacoes?: string;
}

interface UseEscritorioServiceConfig<T extends BaseEntryRow> {
  /** Identificador do serviço para query keys */
  serviceKey: string;
  /** Fazenda selecionada */
  fazendaId?: string;
  /** Status de receptora a buscar */
  statuses: string[];
  /** Data TE para filtro opcional (usado no DG) */
  dataTE?: string;
  /** Nome da RPC batch no Supabase */
  rpcFunction: string;
  /** Nome do parâmetro de data na RPC */
  dateParamName: string;
  /** Query keys extras para invalidar ao salvar */
  extraInvalidateKeys?: string[];
  /** Mapper do resultado da query para o row type */
  rowMapper: (pr: Record<string, unknown>) => T;
}

export function useEscritorioService<T extends BaseEntryRow>(config: UseEscritorioServiceConfig<T>) {
  const { serviceKey, fazendaId, statuses, dataTE, rpcFunction, dateParamName, extraInvalidateKeys = [], rowMapper } = config;
  const queryClient = useQueryClient();

  const receptorasQuery = useQuery({
    queryKey: [`escritorio-${serviceKey}-receptoras`, fazendaId, dataTE],
    queryFn: async (): Promise<T[]> => {
      if (!fazendaId) return [];

      let q = supabase
        .from('protocolo_receptoras')
        .select(`
          id,
          receptora_id,
          status,
          receptoras!inner(id, identificacao, nome, raca)
        `)
        .in('status', statuses);

      // Filtro opcional por data TE
      if (dataTE) {
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

      return (data || []).map(rowMapper as (pr: unknown) => T);
    },
    enabled: !!fazendaId,
  });

  const saveMutation = useMutation({
    mutationFn: async ({
      date,
      veterinario,
      tecnico,
      resultados,
    }: {
      date: string;
      veterinario: string;
      tecnico: string;
      resultados: T[];
    }) => {
      const filtered = resultados.filter(r => r.resultado !== '');

      const { data, error } = await supabase.rpc(rpcFunction, {
        [dateParamName]: date,
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
      queryClient.invalidateQueries({ queryKey: [`escritorio-${serviceKey}-receptoras`] });
      extraInvalidateKeys.forEach(key => {
        queryClient.invalidateQueries({ queryKey: [key] });
      });
    },
  });

  return {
    receptoras: receptorasQuery.data || [],
    isLoading: receptorasQuery.isLoading,
    save: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
  };
}
