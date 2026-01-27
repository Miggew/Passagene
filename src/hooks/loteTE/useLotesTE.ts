import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Fazenda } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import type { LoteTEBase } from '@/lib/gestacao';
import type { StatusReceptoraFiltro, TipoDiagnosticoFiltro } from './useFazendasComLotes';

interface UseLotesTEProps<T extends LoteTEBase> {
  statusReceptoraFiltro: StatusReceptoraFiltro | StatusReceptoraFiltro[];
  tipoDiagnosticoFiltro: TipoDiagnosticoFiltro;
  fazendas: Fazenda[];
  transformLote: (
    loteBase: LoteTEBase,
    diagnosticoLote: { veterinario_responsavel?: string; tecnico_responsavel?: string } | undefined
  ) => T;
}

interface UseLotesTEReturn<T extends LoteTEBase> {
  lotesTE: T[];
  loading: boolean;
  loadLotesTE: (fazendaId: string) => Promise<void>;
}

/**
 * Hook para carregar lotes de TE de uma fazenda
 */
export function useLotesTE<T extends LoteTEBase>({
  statusReceptoraFiltro,
  tipoDiagnosticoFiltro,
  fazendas,
  transformLote,
}: UseLotesTEProps<T>): UseLotesTEReturn<T> {
  const { toast } = useToast();
  const [lotesTE, setLotesTE] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);

  const loadLotesTE = useCallback(async (fazendaId: string) => {
    try {
      setLoading(true);

      // 1. Buscar receptoras da fazenda
      const { data: viewData, error: viewError } = await supabase
        .from('vw_receptoras_fazenda_atual')
        .select('receptora_id')
        .eq('fazenda_id_atual', fazendaId);

      if (viewError) throw viewError;

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

      const { data: receptorasData } = await query;

      const receptorasFiltradas = receptorasData?.map(r => r.id) || [];

      if (receptorasFiltradas.length === 0) {
        setLotesTE([]);
        return;
      }

      // 3. Buscar TEs realizadas
      const { data: teData, error: teError } = await supabase
        .from('transferencias_embrioes')
        .select('id, receptora_id, data_te')
        .in('receptora_id', receptorasFiltradas)
        .eq('status_te', 'REALIZADA')
        .order('data_te', { ascending: false });

      if (teError) throw teError;

      // 4. Buscar diagnósticos existentes
      const { data: diagnosticosData } = await supabase
        .from('diagnosticos_gestacao')
        .select('receptora_id, data_te, veterinario_responsavel, tecnico_responsavel, data_diagnostico')
        .in('receptora_id', receptorasFiltradas)
        .eq('tipo_diagnostico', tipoDiagnosticoFiltro)
        .order('data_diagnostico', { ascending: false });

      // 5. Agrupar por fazenda + data_te
      const lotesMap = new Map<string, LoteTEBase>();
      const receptorasPorData = new Map<string, Set<string>>();
      const diagnosticoPorData = new Map<string, typeof diagnosticosData[0]>();

      teData?.forEach(te => {
        const chave = `${fazendaId}-${te.data_te}`;

        if (!receptorasPorData.has(te.data_te)) {
          receptorasPorData.set(te.data_te, new Set());
        }
        receptorasPorData.get(te.data_te)!.add(te.receptora_id);

        if (!lotesMap.has(chave)) {
          const dgLote = diagnosticosData?.find(dg => dg.data_te === te.data_te);
          if (dgLote && !diagnosticoPorData.has(te.data_te)) {
            diagnosticoPorData.set(te.data_te, dgLote);
          }

          lotesMap.set(chave, {
            id: chave,
            fazenda_id: fazendaId,
            fazenda_nome: fazendas.find(f => f.id === fazendaId)?.nome || '',
            data_te: te.data_te,
            quantidade_receptoras: 0,
            status: 'ABERTO',
          });
        }
      });

      // 6. Calcular quantidade e status
      lotesMap.forEach((lote) => {
        const receptorasUnicas = receptorasPorData.get(lote.data_te)?.size || 0;
        lote.quantidade_receptoras = receptorasUnicas;

        const diagnosticosDoLote = diagnosticosData?.filter(dg => dg.data_te === lote.data_te) || [];
        if (diagnosticosDoLote.length > 0 && diagnosticosDoLote.length >= receptorasUnicas) {
          lote.status = 'FECHADO';
        }
      });

      // 7. Transformar para o tipo específico e filtrar apenas abertos
      const lotesArray = Array.from(lotesMap.values())
        .map(loteBase => {
          const dgLote = diagnosticoPorData.get(loteBase.data_te);
          return transformLote(loteBase, dgLote ? {
            veterinario_responsavel: dgLote.veterinario_responsavel,
            tecnico_responsavel: dgLote.tecnico_responsavel,
          } : undefined);
        })
        .filter(l => l.status === 'ABERTO')
        .sort((a, b) => new Date(b.data_te).getTime() - new Date(a.data_te).getTime());

      setLotesTE(lotesArray);
    } catch (error) {
      toast({
        title: 'Erro ao carregar lotes',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      setLotesTE([]);
    } finally {
      setLoading(false);
    }
  }, [statusReceptoraFiltro, tipoDiagnosticoFiltro, fazendas, transformLote, toast]);

  return {
    lotesTE,
    loading,
    loadLotesTE,
  };
}
