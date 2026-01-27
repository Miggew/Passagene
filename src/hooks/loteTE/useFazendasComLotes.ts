import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Fazenda } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export type StatusReceptoraFiltro = 'SERVIDA' | 'PRENHE' | 'PRENHE_RETOQUE' | 'PRENHE_FEMEA' | 'PRENHE_MACHO' | 'PRENHE_SEM_SEXO' | 'PRENHE_2_SEXOS';
export type TipoDiagnosticoFiltro = 'DG' | 'SEXAGEM';

interface UseFazendasComLotesProps {
  statusReceptoraFiltro: StatusReceptoraFiltro | StatusReceptoraFiltro[];
  tipoDiagnosticoFiltro: TipoDiagnosticoFiltro;
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
  tipoDiagnosticoFiltro,
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

      // 2. Buscar receptoras da view
      const { data: viewData, error: viewError } = await supabase
        .from('vw_receptoras_fazenda_atual')
        .select('receptora_id, fazenda_id_atual');

      if (viewError) throw viewError;

      const receptoraIds = [...new Set((viewData || []).map(v => v.receptora_id).filter(Boolean))];

      if (receptoraIds.length === 0) {
        setFazendas([]);
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
        setFazendas([]);
        return;
      }

      // 4. Buscar TEs realizadas
      const { data: teData, error: teError } = await supabase
        .from('transferencias_embrioes')
        .select('receptora_id, data_te')
        .in('receptora_id', receptorasFiltradas)
        .eq('status_te', 'REALIZADA');

      if (teError) throw teError;

      // 5. Buscar diagnósticos existentes
      const { data: diagnosticosData, error: diagnosticosError } = await supabase
        .from('diagnosticos_gestacao')
        .select('receptora_id, data_te')
        .in('receptora_id', receptorasFiltradas)
        .eq('tipo_diagnostico', tipoDiagnosticoFiltro);

      if (diagnosticosError) throw diagnosticosError;

      // 6. Mapear receptora -> fazenda
      const receptoraFazendaMap = new Map(
        (viewData || [])
          .filter(v => v.receptora_id && v.fazenda_id_atual)
          .map(v => [v.receptora_id, v.fazenda_id_atual])
      );

      // 7. Agrupar receptoras por lote (fazenda + data_te)
      const receptorasPorLote = new Map<string, Set<string>>();
      const chaveFazendaMap = new Map<string, string>();

      (teData || []).forEach(te => {
        const fazendaId = receptoraFazendaMap.get(te.receptora_id);
        if (!fazendaId) return;
        const chave = `${fazendaId}|${te.data_te}`;
        chaveFazendaMap.set(chave, fazendaId);
        if (!receptorasPorLote.has(chave)) {
          receptorasPorLote.set(chave, new Set());
        }
        receptorasPorLote.get(chave)!.add(te.receptora_id);
      });

      // 8. Agrupar diagnósticos por lote
      const diagnosticosPorLote = new Map<string, Set<string>>();
      (diagnosticosData || []).forEach(dg => {
        const fazendaId = receptoraFazendaMap.get(dg.receptora_id);
        if (!fazendaId) return;
        const chave = `${fazendaId}|${dg.data_te}`;
        if (!diagnosticosPorLote.has(chave)) {
          diagnosticosPorLote.set(chave, new Set());
        }
        diagnosticosPorLote.get(chave)!.add(dg.receptora_id);
      });

      // 9. Identificar fazendas com lotes pendentes
      const fazendasAptasSet = new Set<string>();
      receptorasPorLote.forEach((receptorasLote, chave) => {
        const diagnosticosLote = diagnosticosPorLote.get(chave)?.size || 0;
        if (diagnosticosLote < receptorasLote.size) {
          const fazendaId = chaveFazendaMap.get(chave);
          if (fazendaId) fazendasAptasSet.add(fazendaId);
        }
      });

      const fazendasFiltradas = fazendasData.filter(f => fazendasAptasSet.has(f.id));
      setFazendas(fazendasFiltradas);
    } catch (error) {
      toast({
        title: 'Erro ao carregar fazendas',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      setFazendas([]);
    } finally {
      setLoading(false);
    }
  }, [statusReceptoraFiltro, tipoDiagnosticoFiltro, toast]);

  return {
    fazendas,
    loading,
    loadFazendas,
  };
}
