import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { P1EntryRow, AnimalRecord } from '@/lib/types/escritorio';

interface UseP1Options {
  fazendaId?: string;
}

/** Carrega receptoras para autocomplete + salva protocolo P1 */
export function useEscritorioP1({ fazendaId }: UseP1Options) {
  const queryClient = useQueryClient();

  /** Receptoras da fazenda para autocomplete */
  const receptorasQuery = useQuery({
    queryKey: ['escritorio-p1-receptoras', fazendaId],
    queryFn: async (): Promise<AnimalRecord[]> => {
      if (!fazendaId) return [];

      // Usar view de receptoras da fazenda atual
      const { data, error } = await supabase
        .from('vw_receptoras_fazenda_atual')
        .select('receptora_id, registro, nome, raca')
        .eq('fazenda_id', fazendaId)
        .limit(500);

      if (error) {
        // Fallback: buscar todas receptoras
        const { data: fallback, error: fallbackErr } = await supabase
          .from('receptoras')
          .select('id, registro, nome, raca')
          .limit(500);

        if (fallbackErr) throw fallbackErr;
        return (fallback || []).map(r => ({
          id: r.id,
          registro: r.registro,
          nome: r.nome ?? undefined,
          raca: r.raca ?? undefined,
        }));
      }

      return (data || []).map((r: any) => ({
        id: r.receptora_id,
        registro: r.registro,
        nome: r.nome,
        raca: r.raca,
      }));
    },
    enabled: !!fazendaId,
  });

  /** Salva protocolo P1 via RPC existente */
  const saveMutation = useMutation({
    mutationFn: async ({
      dataInicio,
      responsavel,
      rows,
      observacoes,
    }: {
      dataInicio: string;
      responsavel: string;
      rows: P1EntryRow[];
      observacoes?: string;
    }) => {
      // Separar receptoras existentes das novas
      const existingIds = rows
        .filter(r => r.receptora_id && !r.isNew)
        .map(r => r.receptora_id!);

      // Para novas receptoras, criar antes e coletar IDs
      const newRows = rows.filter(r => r.isNew);
      const newIds: string[] = [];

      for (const row of newRows) {
        const { data, error } = await supabase
          .from('receptoras')
          .insert({
            registro: row.registro,
            raca: row.raca || null,
            nome: row.nome || null,
          })
          .select('id')
          .single();

        if (error) throw new Error(`Erro ao criar receptora ${row.registro}: ${error.message}`);
        newIds.push(data.id);

        // Criar vínculo com fazenda
        await supabase.from('receptora_fazenda_historico').insert({
          receptora_id: data.id,
          fazenda_id: fazendaId!,
          data_entrada: dataInicio,
        });
      }

      const allIds = [...existingIds, ...newIds];

      // Chamar RPC de criação do protocolo
      const { data, error } = await supabase.rpc('criar_protocolo_passo1_atomico', {
        p_fazenda_id: fazendaId!,
        p_data_inicio: dataInicio,
        p_responsavel_inicio: responsavel,
        p_receptoras_ids: allIds,
        p_data_inclusao: dataInicio,
        p_observacoes: observacoes || null,
      });

      if (error) throw error;
      return data; // protocolo_id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['protocolos'] });
      queryClient.invalidateQueries({ queryKey: ['receptoras'] });
      queryClient.invalidateQueries({ queryKey: ['escritorio-p1-receptoras'] });
    },
  });

  return {
    receptoras: receptorasQuery.data || [],
    isLoading: receptorasQuery.isLoading,
    save: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
  };
}
