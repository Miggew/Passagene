/**
 * Hook para gerenciar dados e filtros da lista de receptoras
 * - Usa React Query para caching automático
 * - Filtragem por busca e status
 */

import { useState, useMemo, useCallback } from 'react';
import { useFazendas, useReceptorasComStatusByFazenda, useInvalidateQueries } from '@/api';
import type { ReceptoraComStatus } from '@/api/supabaseQueries';
import { useDebounce } from '@/hooks/core';

export interface Fazenda {
  id: string;
  nome: string;
}

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
  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('all');

  // Debounce para evitar filtragens excessivas durante digitação
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Local state for optimistic updates
  const [localUpdates, setLocalUpdates] = useState<Map<string, Partial<ReceptoraComStatus>>>(new Map());
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());

  // React Query hooks - caching automático
  const {
    data: fazendas = [],
    isLoading: loadingFazendas,
    refetch: refetchFazendas,
  } = useFazendas();

  const {
    data: receptorasRaw = [],
    isLoading: loadingReceptoras,
    refetch: refetchReceptoras,
  } = useReceptorasComStatusByFazenda(selectedFazendaId || undefined);

  const { invalidateReceptoras } = useInvalidateQueries();

  // Apply local updates and removals
  const receptoras = useMemo(() => {
    return receptorasRaw
      .filter(r => !removedIds.has(r.id))
      .map(r => {
        const updates = localUpdates.get(r.id);
        return updates ? { ...r, ...updates } : r;
      });
  }, [receptorasRaw, localUpdates, removedIds]);

  // Extract unique statuses for filter
  const statusDisponiveis = useMemo(() => {
    return Array.from(new Set(receptoras.map(r => r.status_calculado)))
      .filter(s => s)
      .sort();
  }, [receptoras]);

  // Filtragem com useMemo (usando searchTerm debounced para evitar lag durante digitação)
  const filteredReceptoras = useMemo(() => {
    let filtered = receptoras;

    if (filtroStatus !== 'all') {
      filtered = filtered.filter(r => r.status_calculado === filtroStatus);
    }

    if (debouncedSearchTerm.trim()) {
      const term = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(
        r =>
          r.identificacao.toLowerCase().includes(term) ||
          r.nome?.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [receptoras, filtroStatus, debouncedSearchTerm]);

  // Compatibilidade com código existente
  const loadFazendas = async () => {
    await refetchFazendas();
  };

  const loadReceptoras = async () => {
    if (selectedFazendaId) {
      // Clear local state on reload
      setLocalUpdates(new Map());
      setRemovedIds(new Set());
      await refetchReceptoras();
    }
  };

  const reloadReceptoras = async () => {
    await loadReceptoras();
  };

  // Optimistic update for a single receptora
  const updateReceptoraInList = useCallback((receptoraId: string, updates: Partial<ReceptoraComStatus>) => {
    setLocalUpdates(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(receptoraId) || {};
      newMap.set(receptoraId, { ...existing, ...updates });
      return newMap;
    });
  }, []);

  // Optimistic removal of a receptora
  const removeReceptoraFromList = useCallback((receptoraId: string) => {
    setRemovedIds(prev => new Set(prev).add(receptoraId));
  }, []);

  return {
    // Data
    fazendas: fazendas as Fazenda[],
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
