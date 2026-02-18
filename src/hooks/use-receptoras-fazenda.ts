import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Receptora } from '@/lib/types';

export function useReceptorasFazenda(fazendaId: string | null) {
  return useQuery({
    queryKey: ['receptoras-fazenda', fazendaId],
    queryFn: async () => {
      if (!fazendaId) return [];

      const { data: receptoraIdsData, error: receptoraIdsError } = await supabase
        .from('receptoras')
        .select('id')
        .eq('fazenda_atual_id', fazendaId);

      if (receptoraIdsError) throw receptoraIdsError;
      const receptoraIds = receptoraIdsData?.map(r => r.id) || [];

      if (receptoraIds.length === 0) return [];

      const { data, error } = await supabase
        .from('receptoras')
        .select('*, fazendas!fazenda_atual_id(nome)')
        .in('id', receptoraIds)
        .order('identificacao', { ascending: true });

      if (error) throw error;

      return (data || []).map(r => ({
        ...r,
        fazenda_nome_atual: (r.fazendas as any)?.nome,
      })) as (Receptora & { fazenda_nome_atual?: string })[];
    },
    enabled: !!fazendaId,
  });
}
