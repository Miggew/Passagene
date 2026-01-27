/**
 * Hook genérico para filtragem de listas
 * - Elimina duplicação de código de filtragem
 * - Usa useMemo para performance
 * - Suporta múltiplos filtros
 */

import { useState, useMemo, useCallback } from 'react';
import { useDebounce } from './useDebounce';

export interface UseListFilterOptions<T> {
  /** Dados originais da lista */
  data: T[];
  /** Função que determina se item passa no filtro de busca */
  searchFn?: (item: T, searchTerm: string) => boolean;
  /** Filtros adicionais (ex: por status, raça, etc) */
  extraFilters?: Record<string, (item: T, filterValue: string) => boolean>;
  /** Delay do debounce em ms (padrão: 300) */
  debounceMs?: number;
}

export interface UseListFilterReturn<T> {
  /** Lista filtrada */
  filtered: T[];
  /** Termo de busca atual */
  searchTerm: string;
  /** Atualiza termo de busca */
  setSearchTerm: (term: string) => void;
  /** Valores dos filtros extras */
  filterValues: Record<string, string>;
  /** Atualiza um filtro extra */
  setFilterValue: (key: string, value: string) => void;
  /** Limpa todos os filtros */
  clearFilters: () => void;
  /** Indica se há filtros ativos */
  hasActiveFilters: boolean;
}

/**
 * Hook para filtrar listas de forma genérica
 *
 * @example
 * ```tsx
 * const { filtered, searchTerm, setSearchTerm } = useListFilter({
 *   data: touros,
 *   searchFn: (t, term) =>
 *     t.nome?.toLowerCase().includes(term) ||
 *     t.registro?.toLowerCase().includes(term),
 *   extraFilters: {
 *     raca: (t, raca) => !raca || t.raca === raca
 *   }
 * });
 * ```
 */
export function useListFilter<T>({
  data,
  searchFn,
  extraFilters = {},
  debounceMs = 300,
}: UseListFilterOptions<T>): UseListFilterReturn<T> {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

  // Debounce no termo de busca para evitar filtragens excessivas durante digitação
  const debouncedSearchTerm = useDebounce(searchTerm, debounceMs);

  // Atualiza um filtro específico
  const setFilterValue = useCallback((key: string, value: string) => {
    setFilterValues(prev => ({ ...prev, [key]: value }));
  }, []);

  // Limpa todos os filtros
  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setFilterValues({});
  }, []);

  // Filtragem com useMemo para performance (usa searchTerm debounced)
  const filtered = useMemo(() => {
    let result = [...data];

    // Aplica filtro de busca (debounced para evitar lag)
    if (debouncedSearchTerm.trim() && searchFn) {
      const term = debouncedSearchTerm.toLowerCase();
      result = result.filter(item => searchFn(item, term));
    }

    // Aplica filtros extras
    Object.entries(extraFilters).forEach(([key, filterFn]) => {
      const value = filterValues[key];
      if (value) {
        result = result.filter(item => filterFn(item, value));
      }
    });

    return result;
  }, [data, debouncedSearchTerm, searchFn, extraFilters, filterValues]);

  // Verifica se há filtros ativos
  const hasActiveFilters = useMemo(() => {
    return searchTerm.trim() !== '' || Object.values(filterValues).some(v => v !== '');
  }, [searchTerm, filterValues]);

  return {
    filtered,
    searchTerm,
    setSearchTerm,
    filterValues,
    setFilterValue,
    clearFilters,
    hasActiveFilters,
  };
}

export default useListFilter;
