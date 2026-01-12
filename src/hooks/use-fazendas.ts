import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Fazenda } from '@/lib/types';

export function useFazendas() {
  return useQuery({
    queryKey: ['fazendas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fazendas')
        .select('*')
        .order('nome', { ascending: true });
      
      if (error) throw error;
      return (data || []) as Fazenda[];
    },
  });
}
