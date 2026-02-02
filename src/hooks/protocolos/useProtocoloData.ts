import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { ProtocoloSincronizacao, Receptora } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export interface ReceptoraWithStatus extends Receptora {
  pr_id: string;
  pr_status: string;
  pr_motivo_inapta?: string;
  pr_observacoes?: string;
}

export interface ReceptoraParaSelecao extends Receptora {
  disponivel: boolean;
  jaNoProtocolo: boolean;
}

interface UseProtocoloDataProps {
  protocoloId: string | undefined;
}

export function useProtocoloData({ protocoloId }: UseProtocoloDataProps) {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [protocolo, setProtocolo] = useState<ProtocoloSincronizacao | null>(null);
  const [fazendaNome, setFazendaNome] = useState('');
  const [receptoras, setReceptoras] = useState<ReceptoraWithStatus[]>([]);
  const [receptorasDisponiveis, setReceptorasDisponiveis] = useState<ReceptoraParaSelecao[]>([]);

  const loadReceptoras = useCallback(async (): Promise<ReceptoraWithStatus[]> => {
    if (!protocoloId) return [];

    const { data: prData, error: prError } = await supabase
      .from('protocolo_receptoras')
      .select('*')
      .eq('protocolo_id', protocoloId);

    if (prError) throw prError;

    if (!prData || prData.length === 0) {
      return [];
    }

    // Buscar todas as receptoras de uma vez
    const receptoraIds = prData.map(pr => pr.receptora_id);
    const { data: receptorasData, error: receptorasError } = await supabase
      .from('receptoras')
      .select('*')
      .in('id', receptoraIds);

    if (receptorasError) throw receptorasError;

    // Criar mapa para lookup rápido
    const receptorasMap = new Map(receptorasData?.map(r => [r.id, r]) || []);

    // Combinar dados
    return prData
      .map(pr => {
        const receptoraData = receptorasMap.get(pr.receptora_id);
        if (!receptoraData) return null;
        return {
          ...receptoraData,
          pr_id: pr.id,
          pr_status: pr.status,
          pr_motivo_inapta: pr.motivo_inapta,
          pr_observacoes: pr.observacoes,
        };
      })
      .filter((r): r is ReceptoraWithStatus => r !== null);
  }, [protocoloId]);

  const loadReceptorasDisponiveis = useCallback(async (fazendaId: string) => {
    // Usar view vw_receptoras_fazenda_atual para filtrar por fazenda atual
    const { data: viewData, error: viewError } = await supabase
      .from('vw_receptoras_fazenda_atual')
      .select('receptora_id')
      .eq('fazenda_id_atual', fazendaId);

    if (viewError) throw viewError;

    const receptoraIds = viewData?.map(v => v.receptora_id) || [];

    if (receptoraIds.length === 0) {
      setReceptorasDisponiveis([]);
      return;
    }

    // Buscar dados das receptoras e receptoras já no protocolo em paralelo
    const [receptorasResult, prResult] = await Promise.all([
      supabase
        .from('receptoras')
        .select('id, identificacao, nome, status_reprodutivo')
        .in('id', receptoraIds)
        .order('identificacao', { ascending: true }),
      supabase
        .from('protocolo_receptoras')
        .select('receptora_id')
        .eq('protocolo_id', protocoloId),
    ]);

    if (receptorasResult.error) throw receptorasResult.error;

    const allReceptoras = receptorasResult.data || [];
    const receptorasJaAdicionadas = new Set(prResult.data?.map(pr => pr.receptora_id) || []);

    // Retornar todas as receptoras com flags de disponibilidade
    const todasComStatus: ReceptoraParaSelecao[] = allReceptoras.map(r => {
      const jaNoProtocolo = receptorasJaAdicionadas.has(r.id);
      const status = r.status_reprodutivo || 'VAZIA';
      const disponivel = !jaNoProtocolo && status === 'VAZIA';

      return {
        ...r,
        disponivel,
        jaNoProtocolo,
      } as ReceptoraParaSelecao;
    });

    setReceptorasDisponiveis(todasComStatus);
  }, [protocoloId]);

  const loadData = useCallback(async () => {
    if (!protocoloId) return;

    try {
      setLoading(true);

      // 1. Load protocolo first (needed for fazenda_id)
      const { data: protocoloData, error: protocoloError } = await supabase
        .from('protocolos_sincronizacao')
        .select('*')
        .eq('id', protocoloId)
        .single();

      if (protocoloError) throw protocoloError;
      setProtocolo(protocoloData);

      // 2. Load fazenda, receptoras e receptoras disponíveis em paralelo
      const [fazendaResult, receptorasResult] = await Promise.all([
        supabase.from('fazendas').select('nome').eq('id', protocoloData.fazenda_id).single(),
        loadReceptoras(),
      ]);

      if (fazendaResult.error) throw fazendaResult.error;
      setFazendaNome(fazendaResult.data.nome);
      setReceptoras(receptorasResult);

      // 3. Load receptoras disponíveis
      await loadReceptorasDisponiveis(protocoloData.fazenda_id);

    } catch (error) {
      toast({
        title: 'Erro ao carregar dados',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [protocoloId, loadReceptoras, loadReceptorasDisponiveis, toast]);

  const reloadReceptorasDisponiveis = useCallback(async () => {
    if (!protocolo) return;
    await loadReceptorasDisponiveis(protocolo.fazenda_id);
  }, [protocolo, loadReceptorasDisponiveis]);

  return {
    loading,
    protocolo,
    setProtocolo,
    fazendaNome,
    receptoras,
    setReceptoras,
    receptorasDisponiveis,
    loadData,
    loadReceptoras,
    reloadReceptorasDisponiveis,
  };
}
