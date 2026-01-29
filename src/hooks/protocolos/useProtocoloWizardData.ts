/**
 * Hook para gerenciar dados do wizard de protocolo
 * - Carregamento de fazendas e receptoras
 * - Filtros de receptoras
 * - Estado do formulário do protocolo
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { validarTransicaoStatus } from '@/lib/receptoraStatus';
import { getTodayDateString } from '@/lib/utils';
import type { Fazenda, Receptora } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export interface ReceptoraLocal {
  id?: string;
  identificacao: string;
  nome?: string;
  observacoes?: string;
  ciclando_classificacao?: 'N' | 'CL' | null;
  qualidade_semaforo?: 1 | 2 | 3 | null;
  isNew?: boolean;
  historicoStats?: ReceptoraHistoricoStats;
}

export interface ReceptoraHistoricoStats {
  totalProtocolos: number;
  gestacoes: number;
  protocolosDesdeUltimaGestacao: number;
}

export interface ReceptoraComStatus extends Receptora {
  status: string;
  motivoIndisponivel?: string;
  historicoStats?: ReceptoraHistoricoStats;
}

export interface ReceptoraFiltrada extends ReceptoraComStatus {
  disponivel: boolean;
}

export interface ProtocoloFormData {
  fazenda_id: string;
  data_inicio: string;
  veterinario: string;
  tecnico: string;
  observacoes: string;
}

export interface UseProtocoloWizardDataReturn {
  // Loading states
  loading: boolean;
  loadingReceptoras: boolean;

  // Data
  fazendas: Fazenda[];
  allReceptoras: Receptora[];
  receptorasComStatus: ReceptoraComStatus[];

  // Protocol form
  protocoloData: ProtocoloFormData;
  setProtocoloData: React.Dispatch<React.SetStateAction<ProtocoloFormData>>;

  // Actions
  loadFazendas: () => Promise<void>;
  loadAllReceptoras: (fazendaId: string) => Promise<void>;

  // Derived data helpers
  getSelectedIds: (receptorasLocais: ReceptoraLocal[]) => Set<string>;
  getAvailableReceptoras: (selectedIds: Set<string>) => Receptora[];
  getReceptorasFiltradas: (
    buscaReceptora: string,
    selectedIds: Set<string>
  ) => ReceptoraFiltrada[];

  // Utilities
  getFazendaNome: (fazendaId: string) => string;
}

export function useProtocoloWizardData(): UseProtocoloWizardDataReturn {
  const { toast } = useToast();

  // Loading states
  const [loading, setLoading] = useState(false);
  const [loadingReceptoras, setLoadingReceptoras] = useState(false);

  // Data
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [allReceptoras, setAllReceptoras] = useState<Receptora[]>([]);
  const [receptorasComStatus, setReceptorasComStatus] = useState<ReceptoraComStatus[]>([]);

  // Protocol form
  const [protocoloData, setProtocoloData] = useState<ProtocoloFormData>({
    fazenda_id: '',
    data_inicio: getTodayDateString(),
    veterinario: '',
    tecnico: '',
    observacoes: '',
  });

  // Load fazendas
  const loadFazendas = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('fazendas')
        .select('*')
        .order('nome', { ascending: true });

      if (error) throw error;
      setFazendas(data || []);
    } catch (error) {
      toast({
        title: 'Erro ao carregar fazendas',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Load historico stats for multiple receptoras at once
  const loadHistoricoStats = useCallback(async (receptoraIds: string[]): Promise<Map<string, ReceptoraHistoricoStats>> => {
    const statsMap = new Map<string, ReceptoraHistoricoStats>();

    if (receptoraIds.length === 0) return statsMap;

    try {
      // Buscar todos os protocolos das receptoras
      const { data: protocolosData } = await supabase
        .from('protocolo_receptoras')
        .select('receptora_id, created_at')
        .in('receptora_id', receptoraIds)
        .order('created_at', { ascending: false });

      // Buscar todos os diagnósticos com resultado PRENHE
      const { data: diagnosticosData } = await supabase
        .from('diagnosticos_gestacao')
        .select('receptora_id, data_diagnostico')
        .in('receptora_id', receptoraIds)
        .in('resultado', ['PRENHE', 'PRENHE_IA'])
        .order('data_diagnostico', { ascending: false });

      // Processar dados por receptora
      const protocolosPorReceptora = new Map<string, string[]>();
      (protocolosData || []).forEach(p => {
        const list = protocolosPorReceptora.get(p.receptora_id) || [];
        list.push(p.created_at);
        protocolosPorReceptora.set(p.receptora_id, list);
      });

      const gestacoesPorReceptora = new Map<string, string[]>();
      (diagnosticosData || []).forEach(d => {
        const list = gestacoesPorReceptora.get(d.receptora_id) || [];
        list.push(d.data_diagnostico);
        gestacoesPorReceptora.set(d.receptora_id, list);
      });

      // Calcular stats para cada receptora
      receptoraIds.forEach(id => {
        const protocolos = protocolosPorReceptora.get(id) || [];
        const gestacoes = gestacoesPorReceptora.get(id) || [];

        const totalProtocolos = protocolos.length;
        const totalGestacoes = gestacoes.length;

        // Calcular protocolos desde última gestação
        let protocolosDesdeUltimaGestacao = totalProtocolos;
        if (gestacoes.length > 0 && protocolos.length > 0) {
          const ultimaGestacao = new Date(gestacoes[0]);
          protocolosDesdeUltimaGestacao = protocolos.filter(
            p => new Date(p) > ultimaGestacao
          ).length;
        }

        statsMap.set(id, {
          totalProtocolos,
          gestacoes: totalGestacoes,
          protocolosDesdeUltimaGestacao,
        });
      });
    } catch (error) {
      console.error('Erro ao carregar histórico stats:', error);
    }

    return statsMap;
  }, []);

  // Load all receptoras from fazenda with status
  const loadAllReceptoras = useCallback(async (fazendaId: string) => {
    try {
      setLoadingReceptoras(true);

      // Use view to filter by current fazenda
      const { data: viewData, error: viewError } = await supabase
        .from('vw_receptoras_fazenda_atual')
        .select('receptora_id')
        .eq('fazenda_id_atual', fazendaId);

      if (viewError) throw viewError;

      const receptoraIds = viewData?.map(v => v.receptora_id) || [];

      if (receptoraIds.length === 0) {
        setAllReceptoras([]);
        setReceptorasComStatus([]);
        return;
      }

      // Fetch complete receptora data and historico stats in parallel
      const [receptorasResult, historicoStatsMap] = await Promise.all([
        supabase
          .from('receptoras')
          .select('id, identificacao, nome, status_reprodutivo')
          .in('id', receptoraIds)
          .order('identificacao', { ascending: true }),
        loadHistoricoStats(receptoraIds),
      ]);

      if (receptorasResult.error) throw receptorasResult.error;

      const receptorasData = receptorasResult.data || [];

      // Calculate status for all receptoras
      const receptorasComStatusFiltradas: ReceptoraComStatus[] = receptorasData
        .filter(r => {
          const rId = r.id ? String(r.id).trim() : '';
          return rId !== '';
        })
        .map((r) => {
          const rId = r.id ? String(r.id).trim() : '';
          const status = r.status_reprodutivo || 'VAZIA';
          const validacao = validarTransicaoStatus(status, 'ENTRAR_PASSO1');

          return {
            ...r,
            status,
            motivoIndisponivel: validacao.valido ? undefined : validacao.mensagem,
            historicoStats: historicoStatsMap.get(rId),
          };
        });

      // Separate VAZIA receptoras (for availableReceptoras) and all (for receptorasComStatus)
      const receptorasVazias = receptorasComStatusFiltradas.filter(r => r.status === 'VAZIA');

      setAllReceptoras(receptorasVazias);
      setReceptorasComStatus(receptorasComStatusFiltradas);
    } catch (error) {
      toast({
        title: 'Erro ao carregar receptoras',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoadingReceptoras(false);
    }
  }, [toast, loadHistoricoStats]);

  // Get selected IDs as Set
  const getSelectedIds = useCallback((receptorasLocais: ReceptoraLocal[]): Set<string> => {
    return new Set(
      receptorasLocais
        .filter(r => r.id && r.id.trim() !== '' && r.id !== null && r.id !== undefined)
        .map(r => String(r.id!).trim())
    );
  }, []);

  // Get available receptoras (VAZIA - selected)
  const getAvailableReceptoras = useCallback((selectedIds: Set<string>): Receptora[] => {
    return allReceptoras.filter(r => {
      const receptoraId = r.id ? String(r.id).trim() : '';
      return receptoraId !== '' && !selectedIds.has(receptoraId);
    });
  }, [allReceptoras]);

  // Get filtered receptoras for search
  const getReceptorasFiltradas = useCallback(
    (buscaReceptora: string, selectedIds: Set<string>): ReceptoraFiltrada[] => {
      if (!buscaReceptora.trim()) {
        // No search: show only adequate receptoras (VAZIA and not selected)
        return receptorasComStatus
          .filter(r => {
            const rId = r.id ? String(r.id).trim() : '';
            return rId !== '' && !selectedIds.has(rId) && r.status === 'VAZIA';
          })
          .map(r => ({ ...r, disponivel: true }));
      }

      // With search: include all matching, even inadequate
      const buscaLower = buscaReceptora.toLowerCase().trim();
      return receptorasComStatus
        .filter(r => {
          const rId = r.id ? String(r.id).trim() : '';
          if (rId === '' || selectedIds.has(rId)) return false;

          const identificacao = (r.identificacao || '').toLowerCase();
          const nome = (r.nome || '').toLowerCase();
          return identificacao.includes(buscaLower) || nome.includes(buscaLower);
        })
        .map(r => ({
          ...r,
          disponivel: r.status === 'VAZIA',
        }));
    },
    [receptorasComStatus]
  );

  // Get fazenda name by ID
  const getFazendaNome = useCallback(
    (fazendaId: string): string => {
      return fazendas.find(f => f.id === fazendaId)?.nome || '-';
    },
    [fazendas]
  );

  return {
    // Loading states
    loading,
    loadingReceptoras,

    // Data
    fazendas,
    allReceptoras,
    receptorasComStatus,

    // Protocol form
    protocoloData,
    setProtocoloData,

    // Actions
    loadFazendas,
    loadAllReceptoras,

    // Derived data helpers
    getSelectedIds,
    getAvailableReceptoras,
    getReceptorasFiltradas,

    // Utilities
    getFazendaNome,
  };
}

export default useProtocoloWizardData;
