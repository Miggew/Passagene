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
}

export interface ReceptoraComStatus extends Receptora {
  status: string;
  motivoIndisponivel?: string;
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

      // Fetch complete receptora data
      const { data, error } = await supabase
        .from('receptoras')
        .select('id, identificacao, nome, status_reprodutivo')
        .in('id', receptoraIds)
        .order('identificacao', { ascending: true });

      if (error) throw error;

      const receptorasData = data || [];

      // Calculate status for all receptoras
      const receptorasComStatusPromises = receptorasData
        .filter(r => {
          const rId = r.id ? String(r.id).trim() : '';
          return rId !== '';
        })
        .map(async (r) => {
          const rId = r.id ? String(r.id).trim() : '';
          if (!rId) return null;
          const status = r.status_reprodutivo || 'VAZIA';
          const validacao = validarTransicaoStatus(status, 'ENTRAR_PASSO1');

          return {
            ...r,
            status,
            motivoIndisponivel: validacao.valido ? undefined : validacao.mensagem,
          };
        });

      const receptorasComStatusResults = await Promise.all(receptorasComStatusPromises);
      const receptorasComStatusFiltradas = receptorasComStatusResults.filter(
        (r): r is ReceptoraComStatus => r !== null
      );

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
  }, [toast]);

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
