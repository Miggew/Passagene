import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { TEEntryRow } from '@/lib/types/escritorio';

interface UseTEOptions {
  protocoloId?: string;
  fazendaId?: string;
  loteFivId?: string;
}

/** Carrega receptoras SINCRONIZADAS + embriões disponíveis + salva batch */
export function useEscritorioTE({ protocoloId, fazendaId, loteFivId }: UseTEOptions) {
  const queryClient = useQueryClient();

  /** Receptoras sincronizadas do protocolo */
  const receptorasQuery = useQuery({
    queryKey: ['escritorio-te-receptoras', protocoloId],
    queryFn: async (): Promise<TEEntryRow[]> => {
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
        .eq('status', 'SINCRONIZADA')
        .limit(200);

      if (error) throw error;

      return (data || []).map((pr: any) => ({
        protocolo_receptora_id: pr.id,
        receptora_id: pr.receptora_id,
        registro: pr.receptoras?.registro || '',
        nome: pr.receptoras?.nome,
        raca: pr.receptoras?.raca,
        embriao_id: '',
        embriao_codigo: '',
        observacoes: '',
      }));
    },
    enabled: !!protocoloId,
  });

  /** Embriões disponíveis no lote FIV */
  const embrioesQuery = useQuery({
    queryKey: ['escritorio-te-embrioes', loteFivId],
    queryFn: async () => {
      if (!loteFivId) return [];

      const { data, error } = await supabase
        .from('embrioes')
        .select('id, codigo, classificacao, doadora_id, doadoras(registro, nome)')
        .eq('lote_fiv_id', loteFivId)
        .in('classificacao', ['A', 'B', 'C', 'BE', 'BN', 'BX', 'BL', 'BI']);

      if (error) throw error;

      // Filtrar embriões já transferidos
      const { data: transferidos } = await supabase
        .from('transferencias_embrioes')
        .select('embriao_id');

      const transferidosSet = new Set((transferidos || []).map(t => t.embriao_id));

      return (data || [])
        .filter(e => !transferidosSet.has(e.id))
        .map((e: any) => ({
          id: e.id,
          codigo: e.codigo,
          classificacao: e.classificacao,
          doadora_registro: e.doadoras?.registro,
          doadora_nome: e.doadoras?.nome,
        }));
    },
    enabled: !!loteFivId,
  });

  const saveMutation = useMutation({
    mutationFn: async ({
      dataTE,
      veterinario,
      tecnico,
      rows,
    }: {
      dataTE: string;
      veterinario: string;
      tecnico: string;
      rows: TEEntryRow[];
    }) => {
      const filtered = rows.filter(r => r.embriao_id);

      const { data, error } = await supabase.rpc('registrar_te_batch', {
        p_data_te: dataTE,
        p_veterinario: veterinario,
        p_tecnico: tecnico,
        p_fazenda_id: fazendaId!,
        p_transferencias: filtered.map(r => ({
          protocolo_receptora_id: r.protocolo_receptora_id,
          receptora_id: r.receptora_id,
          embriao_id: r.embriao_id,
          observacoes: r.observacoes || null,
        })),
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transferencias'] });
      queryClient.invalidateQueries({ queryKey: ['embrioes'] });
      queryClient.invalidateQueries({ queryKey: ['receptoras'] });
      queryClient.invalidateQueries({ queryKey: ['escritorio-te-receptoras'] });
      queryClient.invalidateQueries({ queryKey: ['escritorio-te-embrioes'] });
    },
  });

  return {
    receptoras: receptorasQuery.data || [],
    embrioes: embrioesQuery.data || [],
    isLoading: receptorasQuery.isLoading || embrioesQuery.isLoading,
    save: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
  };
}
