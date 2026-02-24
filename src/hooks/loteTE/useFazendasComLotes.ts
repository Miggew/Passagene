import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Fazenda } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export type StatusReceptoraFiltro = 'SERVIDA' | 'PRENHE' | 'PRENHE_RETOQUE' | 'PRENHE_FEMEA' | 'PRENHE_MACHO' | 'PRENHE_SEM_SEXO' | 'PRENHE_2_SEXOS';

interface UseFazendasComLotesProps {
  statusReceptoraFiltro: StatusReceptoraFiltro | StatusReceptoraFiltro[];
}

interface UseFazendasComLotesReturn {
  fazendas: Fazenda[];
  loading: boolean;
  loadFazendas: () => Promise<void>;
}

/**
 * Hook para carregar fazendas que possuem receptoras aptas para DG ou Sexagem
 */
export function useFazendasComLotes({
  statusReceptoraFiltro,
}: UseFazendasComLotesProps): UseFazendasComLotesReturn {
  const { toast } = useToast();
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [loading, setLoading] = useState(false);

  const loadFazendas = useCallback(async () => {
    try {
      setLoading(true);

      // 1. Buscar todas as fazendas
      const { data: fazendasData, error: fazendasError } = await supabase
        .from('fazendas')
        .select('*')
        .order('nome', { ascending: true });

      if (fazendasError) throw fazendasError;
      if (!fazendasData || fazendasData.length === 0) {
        setFazendas([]);
        return;
      }

      // 2. Buscar receptoras que estão em alguma fazenda
      const { data: viewData, error: viewError } = await supabase
        .from('receptoras')
        .select('id, fazenda_atual_id')
        .not('fazenda_atual_id', 'is', null);

      if (viewError) throw viewError;

      const receptoraIds = [...new Set((viewData || []).map(v => v.id).filter(Boolean))];

      if (receptoraIds.length === 0) {
        // Retorna todas as fazendas mesmo sem receptoras
        setFazendas(fazendasData);
        return;
      }

      // 3. Buscar receptoras com o status desejado
      const statusArray = Array.isArray(statusReceptoraFiltro)
        ? statusReceptoraFiltro
        : [statusReceptoraFiltro];

      let query = supabase
        .from('receptoras')
        .select('id')
        .in('id', receptoraIds);

      if (statusArray.length === 1) {
        query = query.eq('status_reprodutivo', statusArray[0]);
      } else {
        query = query.in('status_reprodutivo', statusArray);
      }

      const { data: receptorasData, error: receptorasError } = await query;

      if (receptorasError) throw receptorasError;

      const receptorasFiltradas = receptorasData?.map(r => r.id) || [];

      if (receptorasFiltradas.length === 0) {
        // Se não há receptoras com o status, retorna lista vazia
        setFazendas([]);
        return;
      }

      // 4. Buscar TEs realizadas para essas receptoras
      const { data: teData, error: teError } = await supabase
        .from('transferencias_embrioes')
        .select('receptora_id')
        .in('receptora_id', receptorasFiltradas)
        .eq('status_te', 'REALIZADA');

      if (teError) {
        console.error('Erro ao buscar TEs:', teError);
        throw teError;
      }

      const receptorasComTE = new Set(teData?.map(te => te.receptora_id) || []);

      if (receptorasComTE.size === 0) {
        // Se não há TEs realizadas, retorna lista vazia
        setFazendas([]);
        return;
      }

      // 5. Mapear receptora -> fazenda
      const receptoraFazendaMap = new Map(
        (viewData || [])
          .filter(v => v.id && v.fazenda_atual_id)
          .map(v => [v.id, v.fazenda_atual_id])
      );

      // 6. Identificar fazendas que têm receptoras com o status desejado E com TE realizada
      const fazendasComReceptorasSet = new Set<string>();
      receptorasComTE.forEach(receptoraId => {
        const fazendaId = receptoraFazendaMap.get(receptoraId);
        if (fazendaId) fazendasComReceptorasSet.add(fazendaId);
      });

      const fazendasFiltradas = fazendasData.filter(f => fazendasComReceptorasSet.has(f.id));
      setFazendas(fazendasFiltradas);
    } catch (error) {
      console.error('Erro ao carregar fazendas:', error);
      toast({
        title: 'Erro ao carregar fazendas',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      setFazendas([]);
    } finally {
      setLoading(false);
    }
  }, [statusReceptoraFiltro, toast]);

  return {
    fazendas,
    loading,
    loadFazendas,
  };
}
