/**
 * Hook para gerenciar carregamento de dados e filtros de receptoras
 */

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Fazenda, ReceptoraComStatus } from '@/lib/types';
import { handleError } from '@/lib/error-handler';

export interface UseReceptorasDataProps {
  selectedFazendaId: string;
}

export interface UseReceptorasDataReturn {
  // Data
  fazendas: Fazenda[];
  receptoras: ReceptoraComStatus[];
  filteredReceptoras: ReceptoraComStatus[];
  statusDisponiveis: string[];

  // Loading states
  loadingFazendas: boolean;
  loadingReceptoras: boolean;

  // Filter state
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filtroStatus: string;
  setFiltroStatus: (status: string) => void;

  // Actions
  loadFazendas: () => Promise<void>;
  loadReceptoras: () => Promise<void>;
  reloadReceptoras: () => Promise<void>;
  updateReceptoraInList: (receptoraId: string, updates: Partial<ReceptoraComStatus>) => void;
  removeReceptoraFromList: (receptoraId: string) => void;
}

export function useReceptorasData({ selectedFazendaId }: UseReceptorasDataProps): UseReceptorasDataReturn {
  // Data state
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [receptoras, setReceptoras] = useState<ReceptoraComStatus[]>([]);
  const [filteredReceptoras, setFilteredReceptoras] = useState<ReceptoraComStatus[]>([]);
  const [statusDisponiveis, setStatusDisponiveis] = useState<string[]>([]);

  // Loading state
  const [loadingFazendas, setLoadingFazendas] = useState(true);
  const [loadingReceptoras, setLoadingReceptoras] = useState(false);

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('all');

  // Filter receptoras when search or status changes
  const filterReceptoras = useCallback(() => {
    let filtered = receptoras;

    if (filtroStatus !== 'all') {
      filtered = filtered.filter((r) => r.status_calculado === filtroStatus);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.identificacao.toLowerCase().includes(term) ||
          r.nome?.toLowerCase().includes(term)
      );
    }

    setFilteredReceptoras(filtered);
  }, [receptoras, filtroStatus, searchTerm]);

  useEffect(() => {
    filterReceptoras();
  }, [filterReceptoras]);

  // Auto-load fazendas on mount
  useEffect(() => {
    loadFazendas();
  }, []);

  // Auto-load receptoras when fazenda changes
  useEffect(() => {
    if (selectedFazendaId) {
      loadReceptoras();
    }
  }, [selectedFazendaId]);

  // Load fazendas
  const loadFazendas = useCallback(async () => {
    try {
      setLoadingFazendas(true);
      const { data, error } = await supabase
        .from('fazendas')
        .select('id, nome, cliente_id')
        .order('nome', { ascending: true });

      if (error) throw error;
      setFazendas(data || []);
    } catch (error) {
      handleError(error, 'Erro ao carregar fazendas');
    } finally {
      setLoadingFazendas(false);
    }
  }, []);

  // Load receptoras for selected fazenda
  const loadReceptoras = useCallback(async () => {
    if (!selectedFazendaId) {
      setReceptoras([]);
      setFilteredReceptoras([]);
      setStatusDisponiveis([]);
      return;
    }

    try {
      setLoadingReceptoras(true);

      // Get receptora IDs from view
      const { data: viewData, error: viewError } = await supabase
        .from('vw_receptoras_fazenda_atual')
        .select('receptora_id, fazenda_nome_atual')
        .eq('fazenda_id_atual', selectedFazendaId);

      if (viewError) throw viewError;

      const receptoraIds = viewData?.map(v => v.receptora_id) || [];

      if (receptoraIds.length === 0) {
        setReceptoras([]);
        setFilteredReceptoras([]);
        setStatusDisponiveis([]);
        return;
      }

      // Get full receptora data
      const { data, error } = await supabase
        .from('receptoras')
        .select('*')
        .in('id', receptoraIds)
        .order('identificacao', { ascending: true });

      if (error) throw error;

      const fazendaMap = new Map(viewData?.map(v => [v.receptora_id, v.fazenda_nome_atual]) || []);

      const receptorasData = (data || []).map(r => ({
        ...r,
        fazenda_nome_atual: fazendaMap.get(r.id),
      }));

      const receptorasComStatus: ReceptoraComStatus[] = receptorasData.map(r => ({
        ...r,
        status_calculado: r.status_reprodutivo || 'VAZIA',
      }));

      // Get pregnancy count for pregnant receptoras
      const statusPrenhes = ['PRENHE', 'PRENHE_RETOQUE', 'PRENHE_FEMEA', 'PRENHE_MACHO', 'PRENHE_SEM_SEXO', 'PRENHE_2_SEXOS'];
      const receptorasPrenhes = receptorasComStatus.filter(r =>
        statusPrenhes.includes(r.status_calculado) ||
        r.status_calculado.includes('PRENHE')
      );

      if (receptorasPrenhes.length > 0) {
        const prenhesIds = receptorasPrenhes.map(r => r.id);

        const { data: diagnosticosData, error: diagnosticosError } = await supabase
          .from('diagnosticos_gestacao')
          .select('receptora_id, numero_gestacoes')
          .in('receptora_id', prenhesIds)
          .in('resultado', ['PRENHE', 'PRENHE_FEMEA', 'PRENHE_MACHO', 'PRENHE_SEM_SEXO', 'PRENHE_2_SEXOS'])
          .not('numero_gestacoes', 'is', null);

        if (!diagnosticosError && diagnosticosData) {
          const gestacoesMap = new Map<string, number>();

          diagnosticosData.forEach(dg => {
            if (dg.numero_gestacoes && dg.numero_gestacoes > 1) {
              const atual = gestacoesMap.get(dg.receptora_id) || 0;
              if (dg.numero_gestacoes > atual) {
                gestacoesMap.set(dg.receptora_id, dg.numero_gestacoes);
              }
            }
          });

          receptorasComStatus.forEach(r => {
            const numGestacoes = gestacoesMap.get(r.id);
            if (numGestacoes && numGestacoes > 1) {
              r.numero_gestacoes = numGestacoes;
            }
          });
        }
      }

      // Extract unique statuses for filter
      const statusUnicos = Array.from(new Set(receptorasComStatus.map(r => r.status_calculado)))
        .filter(s => s)
        .sort();

      setStatusDisponiveis(statusUnicos);
      setReceptoras(receptorasComStatus);
      setFilteredReceptoras(receptorasComStatus);
      setFiltroStatus('all');
    } catch (error) {
      handleError(error, 'Erro ao carregar receptoras');
    } finally {
      setLoadingReceptoras(false);
    }
  }, [selectedFazendaId]);

  // Reload receptoras
  const reloadReceptoras = useCallback(async () => {
    await loadReceptoras();
  }, [loadReceptoras]);

  // Update a single receptora in the list
  const updateReceptoraInList = useCallback((receptoraId: string, updates: Partial<ReceptoraComStatus>) => {
    setReceptoras(prev => prev.map(r =>
      r.id === receptoraId ? { ...r, ...updates } : r
    ));
  }, []);

  // Remove a receptora from the list
  const removeReceptoraFromList = useCallback((receptoraId: string) => {
    setReceptoras(prev => prev.filter(r => r.id !== receptoraId));
    setFilteredReceptoras(prev => prev.filter(r => r.id !== receptoraId));
  }, []);

  return {
    // Data
    fazendas,
    receptoras,
    filteredReceptoras,
    statusDisponiveis,

    // Loading states
    loadingFazendas,
    loadingReceptoras,

    // Filter state
    searchTerm,
    setSearchTerm,
    filtroStatus,
    setFiltroStatus,

    // Actions
    loadFazendas,
    loadReceptoras,
    reloadReceptoras,
    updateReceptoraInList,
    removeReceptoraFromList,
  };
}

export default useReceptorasData;
