/**
 * Hook para gerenciar dados e filtros da lista de doadoras
 * - Usa React Query para caching automático
 * - Usa useListFilter para filtragem genérica
 * - Carregamento de fazendas e doadoras com JOIN (sem N+1)
 */

import { useState, useMemo } from 'react';
import { useFazendas, useDoadorasByFazenda } from '@/api';
import { useListFilter } from '@/hooks/core';
import type { DoadoraComUltimaAspiracao } from '@/api/supabaseQueries';

export interface Fazenda {
  id: string;
  nome: string;
}

export type DoadoraComAspiracao = DoadoraComUltimaAspiracao;

export type SortOrder = 'asc' | 'desc' | 'none';

export interface UseDoadorasDataReturn {
  // Loading state
  loading: boolean;

  // Data
  fazendas: Fazenda[];
  doadoras: DoadoraComAspiracao[];
  filteredDoadoras: DoadoraComAspiracao[];

  // Selection
  selectedFazendaId: string;
  setSelectedFazendaId: (id: string) => void;

  // Filters
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;

  // Sorting
  sortByDate: SortOrder;
  setSortByDate: (order: SortOrder) => void;

  // Historico dialog
  historicoDoadoraId: string | null;
  setHistoricoDoadoraId: (id: string | null) => void;

  // Actions
  loadFazendas: () => Promise<void>;
  loadDoadoras: () => Promise<void>;
}

// Função de busca para doadoras
const searchDoadora = (doadora: DoadoraComAspiracao, term: string): boolean =>
  doadora.nome?.toLowerCase().includes(term) ||
  doadora.registro?.toLowerCase().includes(term) ||
  doadora.raca?.toLowerCase().includes(term) ||
  false;

export function useDoadorasData(): UseDoadorasDataReturn {
  // Selection
  const [selectedFazendaId, setSelectedFazendaId] = useState<string>('');

  // Sorting
  const [sortByDate, setSortByDate] = useState<SortOrder>('none');

  // Historico dialog
  const [historicoDoadoraId, setHistoricoDoadoraId] = useState<string | null>(null);

  // React Query hooks - caching automático
  const {
    data: fazendas = [],
    isLoading: loadingFazendas,
    refetch: refetchFazendas,
  } = useFazendas();

  const {
    data: doadoras = [],
    isLoading: loadingDoadoras,
    refetch: refetchDoadoras,
  } = useDoadorasByFazenda(selectedFazendaId || undefined);

  // Filtragem genérica com useListFilter
  const {
    filtered: filteredDoadorasBase,
    searchTerm,
    setSearchTerm,
    clearFilters: clearFiltersBase,
    hasActiveFilters: hasActiveFiltersBase,
  } = useListFilter({
    data: doadoras,
    searchFn: searchDoadora,
  });

  // Aplicar ordenação após filtragem
  const filteredDoadoras = useMemo(() => {
    if (sortByDate === 'none') {
      return filteredDoadorasBase;
    }

    return [...filteredDoadorasBase].sort((a, b) => {
      const dateA = a.ultima_aspiracao_data ? new Date(a.ultima_aspiracao_data).getTime() : 0;
      const dateB = b.ultima_aspiracao_data ? new Date(b.ultima_aspiracao_data).getTime() : 0;

      // Itens sem data vão para o final
      if (!a.ultima_aspiracao_data && !b.ultima_aspiracao_data) return 0;
      if (!a.ultima_aspiracao_data) return 1;
      if (!b.ultima_aspiracao_data) return -1;

      return sortByDate === 'asc' ? dateA - dateB : dateB - dateA;
    });
  }, [filteredDoadorasBase, sortByDate]);

  // Clear filters incluindo ordenação
  const clearFilters = () => {
    clearFiltersBase();
    setSortByDate('none');
  };

  const hasActiveFilters = hasActiveFiltersBase || sortByDate !== 'none';

  // Compatibilidade com código existente
  const loadFazendas = async () => {
    await refetchFazendas();
  };

  const loadDoadoras = async () => {
    if (selectedFazendaId) {
      await refetchDoadoras();
    }
  };

  // Loading combinado
  const loading = loadingFazendas || (selectedFazendaId ? loadingDoadoras : false);

  return {
    // Loading state
    loading,

    // Data
    fazendas: fazendas as Fazenda[],
    doadoras,
    filteredDoadoras,

    // Selection
    selectedFazendaId,
    setSelectedFazendaId,

    // Filters
    searchTerm,
    setSearchTerm,
    clearFilters,
    hasActiveFilters,

    // Sorting
    sortByDate,
    setSortByDate,

    // Historico dialog
    historicoDoadoraId,
    setHistoricoDoadoraId,

    // Actions
    loadFazendas,
    loadDoadoras,
  };
}

export default useDoadorasData;
