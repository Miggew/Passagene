import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import type { LoteTEBase } from '@/lib/gestacao';
import { calcularDiasGestacao } from '@/lib/dataEnrichment';
import type { StatusReceptoraFiltro } from './useFazendasComLotes';

interface UseLotesTEProps<T extends LoteTEBase> {
  statusReceptoraFiltro: StatusReceptoraFiltro | StatusReceptoraFiltro[];
  transformLote: (
    loteBase: LoteTEBase,
    diagnosticoLote: { veterinario_responsavel?: string; tecnico_responsavel?: string } | undefined
  ) => T;
}

interface UseLotesTEReturn<T extends LoteTEBase> {
  lotesTE: T[];
  loading: boolean;
  loadLotesTE: (fazendaId: string, fazendaNome?: string) => Promise<void>;
}

/**
 * Hook para carregar lotes de TE de uma fazenda
 */
export function useLotesTE<T extends LoteTEBase>({
  statusReceptoraFiltro,
  transformLote,
}: UseLotesTEProps<T>): UseLotesTEReturn<T> {
  const { toast } = useToast();
  const [lotesTE, setLotesTE] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);

  const loadLotesTE = useCallback(async (fazendaId: string, fazendaNome?: string) => {
    try {
      setLoading(true);

      // 1. Buscar receptoras da fazenda
      const { data: viewData, error: viewError } = await supabase
        .from('vw_receptoras_fazenda_atual')
        .select('receptora_id')
        .eq('fazenda_id_atual', fazendaId);

      if (viewError) {
        console.error('Erro ao buscar view:', viewError);
        throw viewError;
      }

      const receptoraIds = viewData?.map(v => v.receptora_id) || [];

      if (receptoraIds.length === 0) {
        setLotesTE([]);
        return;
      }

      // 2. Filtrar por status
      const statusArray = Array.isArray(statusReceptoraFiltro)
        ? statusReceptoraFiltro
        : [statusReceptoraFiltro];

      let query = supabase
        .from('receptoras')
        .select('id, status_reprodutivo')
        .in('id', receptoraIds);

      if (statusArray.length === 1) {
        query = query.eq('status_reprodutivo', statusArray[0]);
      } else {
        query = query.in('status_reprodutivo', statusArray);
      }

      const { data: receptorasData, error: receptorasError } = await query;

      if (receptorasError) {
        console.error('Erro ao buscar receptoras:', receptorasError);
        throw receptorasError;
      }

      const receptorasFiltradas = receptorasData?.map(r => r.id) || [];

      if (receptorasFiltradas.length === 0) {
        setLotesTE([]);
        return;
      }

      // 3. Buscar TEs realizadas
      const { data: teData, error: teError } = await supabase
        .from('transferencias_embrioes')
        .select('id, receptora_id, data_te, embriao_id')
        .in('receptora_id', receptorasFiltradas)
        .eq('status_te', 'REALIZADA')
        .order('data_te', { ascending: false });

      if (teError) {
        console.error('Erro ao buscar TEs:', teError);
        throw teError;
      }

      if (!teData || teData.length === 0) {
        setLotesTE([]);
        return;
      }

      // 4. Buscar embriões das TEs para obter lote_fiv_id
      const embriaoIds = teData.map(te => te.embriao_id).filter(Boolean);
      let embrioesMap = new Map<string, { lote_fiv_id: string }>();
      let lotesFivMap = new Map<string, { data_abertura: string }>();

      if (embriaoIds.length > 0) {
        const { data: embrioesData } = await supabase
          .from('embrioes')
          .select('id, lote_fiv_id')
          .in('id', embriaoIds);

        if (embrioesData) {
          embrioesMap = new Map(embrioesData.map(e => [e.id, { lote_fiv_id: e.lote_fiv_id }]));

          // 5. Buscar lotes FIV para obter data_abertura
          const loteFivIds = [...new Set(embrioesData.map(e => e.lote_fiv_id).filter(Boolean))];
          if (loteFivIds.length > 0) {
            const { data: lotesFivData } = await supabase
              .from('lotes_fiv')
              .select('id, data_abertura')
              .in('id', loteFivIds);

            if (lotesFivData) {
              lotesFivMap = new Map(lotesFivData.map(l => [l.id, { data_abertura: l.data_abertura }]));
            }
          }
        }
      }

      // 6. Agrupar por fazenda + data_te e calcular dias de gestação
      const lotesMap = new Map<string, LoteTEBase>();
      const receptorasPorData = new Map<string, Set<string>>();
      const dataAberturasPorLote = new Map<string, string>(); // chave do lote -> data_abertura mais antiga

      teData.forEach(te => {
        const chave = `${fazendaId}-${te.data_te}`;

        if (!receptorasPorData.has(te.data_te)) {
          receptorasPorData.set(te.data_te, new Set());
        }
        receptorasPorData.get(te.data_te)!.add(te.receptora_id);

        // Obter data_abertura do lote FIV através do embrião
        const embriao = embrioesMap.get(te.embriao_id);
        if (embriao?.lote_fiv_id) {
          const loteFiv = lotesFivMap.get(embriao.lote_fiv_id);
          if (loteFiv?.data_abertura) {
            const dataAtual = dataAberturasPorLote.get(chave);
            // Usar a data mais antiga (menor) como referência
            if (!dataAtual || loteFiv.data_abertura < dataAtual) {
              dataAberturasPorLote.set(chave, loteFiv.data_abertura);
            }
          }
        }

        if (!lotesMap.has(chave)) {
          lotesMap.set(chave, {
            id: chave,
            fazenda_id: fazendaId,
            fazenda_nome: fazendaNome || '',
            data_te: te.data_te,
            quantidade_receptoras: 0,
            status: 'ABERTO',
          });
        }
      });

      // 7. Calcular quantidade de receptoras e dias de gestação
      lotesMap.forEach((lote, chave) => {
        const receptorasUnicas = receptorasPorData.get(lote.data_te)?.size || 0;
        lote.quantidade_receptoras = receptorasUnicas;

        const dataAbertura = dataAberturasPorLote.get(chave);
        if (dataAbertura) {
          lote.data_abertura_lote = dataAbertura;
          lote.dias_gestacao = calcularDiasGestacao(dataAbertura);
        }
      });

      // 8. Transformar para o tipo específico
      const lotesArray = Array.from(lotesMap.values())
        .map(loteBase => transformLote(loteBase, undefined))
        .sort((a, b) => new Date(b.data_te).getTime() - new Date(a.data_te).getTime());

      setLotesTE(lotesArray);
    } catch (error) {
      console.error('Erro ao carregar lotes:', error);
      toast({
        title: 'Erro ao carregar lotes',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      setLotesTE([]);
    } finally {
      setLoading(false);
    }
  }, [statusReceptoraFiltro, transformLote, toast]);

  return {
    lotesTE,
    loading,
    loadLotesTE,
  };
}
