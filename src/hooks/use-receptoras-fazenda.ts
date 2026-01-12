import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Receptora } from '@/lib/types';

export function useReceptorasFazenda(fazendaId: string | null) {
  return useQuery({
    queryKey: ['receptoras-fazenda', fazendaId],
    queryFn: async () => {
      if (!fazendaId) return [];
      
      const { data: viewData, error: viewError } = await supabase
        .from('vw_receptoras_fazenda_atual')
        .select('receptora_id, fazenda_nome_atual')
        .eq('fazenda_id_atual', fazendaId);

      if (viewError) throw viewError;
      const receptoraIds = viewData?.map(v => v.receptora_id) || [];

      if (receptoraIds.length === 0) return [];

      const { data, error } = await supabase
        .from('receptoras')
        .select('*')
        .in('id', receptoraIds)
        .order('identificacao', { ascending: true });

      if (error) throw error;

      const fazendaMap = new Map(viewData?.map(v => [v.receptora_id, v.fazenda_nome_atual]) || []);

      return (data || []).map(r => ({
        ...r,
        fazenda_nome_atual: fazendaMap.get(r.id),
      })) as (Receptora & { fazenda_nome_atual?: string })[];
    },
    enabled: !!fazendaId,
  });
}
