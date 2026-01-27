/**
 * Hook para gerenciar dados e filtros da lista de touros
 * - Usa React Query para caching automático
 * - Usa useListFilter para filtragem genérica
 */

import { useMemo } from 'react';
import { useTouros, useInvalidateQueries } from '@/api';
import { useListFilter } from '@/hooks/core';
import type { Touro } from '@/lib/types';

export const racasBovinas = [
  'Holandesa',
  'Jersey',
  'Gir',
  'Girolando',
  'Nelore',
  'Angus',
  'Brahman',
  'Hereford',
  'Simmental',
  'Tabapuã',
  'Sindi',
  'Caracu',
  'Canchim',
  'Senepol',
  'Brangus',
  'Gir Leiteiro',
  'Guzerá',
];

export interface UseTourosDataReturn {
  // Loading state
  loading: boolean;
  error: Error | null;

  // Data
  touros: Touro[];
  filteredTouros: Touro[];

  // Filters
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filtroRaca: string;
  setFiltroRaca: (raca: string) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;

  // Actions
  loadTouros: () => Promise<void>;
  refetch: () => void;
}

// Função de busca para touros
const searchTouro = (touro: Touro, term: string): boolean =>
  touro.nome?.toLowerCase().includes(term) ||
  touro.registro?.toLowerCase().includes(term) ||
  touro.raca?.toLowerCase().includes(term) ||
  false;

// Filtros extras
const extraFilters = {
  raca: (touro: Touro, raca: string) => touro.raca === raca,
};

export function useTourosData(): UseTourosDataReturn {
  // React Query hook - caching automático
  const { data: touros = [], isLoading, error, refetch } = useTouros();
  const { invalidateTouros } = useInvalidateQueries();

  // Filtragem genérica com useListFilter
  const {
    filtered: filteredTouros,
    searchTerm,
    setSearchTerm,
    filterValues,
    setFilterValue,
    clearFilters,
    hasActiveFilters,
  } = useListFilter({
    data: touros,
    searchFn: searchTouro,
    extraFilters,
  });

  // Wrapper para filtro de raça (compatibilidade)
  const filtroRaca = filterValues.raca || '';
  const setFiltroRaca = (raca: string) => setFilterValue('raca', raca);

  // Compatibilidade com código existente
  const loadTouros = async () => {
    await refetch();
  };

  return {
    // Loading state
    loading: isLoading,
    error: error as Error | null,

    // Data
    touros,
    filteredTouros,

    // Filters
    searchTerm,
    setSearchTerm,
    filtroRaca,
    setFiltroRaca,
    clearFilters,
    hasActiveFilters,

    // Actions
    loadTouros,
    refetch: () => refetch(),
  };
}

export default useTourosData;
