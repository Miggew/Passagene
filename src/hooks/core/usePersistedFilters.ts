/**
 * Hook genérico para gerenciar filtros com persistência em localStorage
 * Reutilizável em listas, tabelas e páginas com filtros
 */

import { useState, useCallback, useEffect, useMemo } from 'react';

export interface UsePersistedFiltersOptions<T> {
  /** Chave para persistência no localStorage */
  storageKey: string;
  /** Valores iniciais dos filtros */
  initialFilters: T;
  /** Se deve persistir automaticamente (padrão: true) */
  autoPersist?: boolean;
  /** Debounce em ms para persistência (padrão: 500) */
  persistDebounce?: number;
  /** Função para validar filtros ao restaurar */
  validateFilters?: (filters: unknown) => filters is T;
}

export interface UsePersistedFiltersReturn<T> {
  // Estado
  filters: T;

  // Funções de manipulação
  setFilter: <K extends keyof T>(key: K, value: T[K]) => void;
  setFilters: (newFilters: Partial<T>) => void;
  resetFilters: () => void;
  clearFilters: () => void;

  // Persistência
  saveFilters: () => void;
  loadFilters: () => T | null;
  clearPersistedFilters: () => void;

  // Estado derivado
  hasActiveFilters: boolean;
  activeFilterCount: number;
}

export function usePersistedFilters<T extends Record<string, unknown>>(
  options: UsePersistedFiltersOptions<T>
): UsePersistedFiltersReturn<T> {
  const {
    storageKey,
    initialFilters,
    autoPersist = true,
    persistDebounce = 500,
    validateFilters,
  } = options;

  const [filters, setFiltersState] = useState<T>(() => {
    // Tentar restaurar do localStorage no carregamento inicial
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (validateFilters) {
          return validateFilters(parsed) ? parsed : initialFilters;
        }
        // Validação básica: verificar se tem as mesmas chaves
        const storedKeys = Object.keys(parsed);
        const initialKeys = Object.keys(initialFilters);
        const hasAllKeys = initialKeys.every(key => storedKeys.includes(key));
        if (hasAllKeys) {
          return { ...initialFilters, ...parsed };
        }
      }
    } catch {
      // Se falhar, usar valores iniciais
    }
    return initialFilters;
  });

  // Persistir com debounce
  useEffect(() => {
    if (!autoPersist) return;

    const timeoutId = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(filters));
      } catch {
        // Silenciar erros de localStorage
      }
    }, persistDebounce);

    return () => clearTimeout(timeoutId);
  }, [filters, storageKey, autoPersist, persistDebounce]);

  // Definir um filtro individual
  const setFilter = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setFiltersState(prev => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  // Definir múltiplos filtros de uma vez
  const setFilters = useCallback((newFilters: Partial<T>) => {
    setFiltersState(prev => ({
      ...prev,
      ...newFilters,
    }));
  }, []);

  // Resetar para valores iniciais
  const resetFilters = useCallback(() => {
    setFiltersState(initialFilters);
  }, [initialFilters]);

  // Limpar todos os filtros (valores vazios)
  const clearFilters = useCallback(() => {
    const clearedFilters = Object.keys(initialFilters).reduce((acc, key) => {
      const initialValue = initialFilters[key as keyof T];
      // Determinar valor "vazio" baseado no tipo do valor inicial
      if (typeof initialValue === 'string') {
        (acc as Record<string, unknown>)[key] = '';
      } else if (typeof initialValue === 'number') {
        (acc as Record<string, unknown>)[key] = 0;
      } else if (typeof initialValue === 'boolean') {
        (acc as Record<string, unknown>)[key] = false;
      } else if (Array.isArray(initialValue)) {
        (acc as Record<string, unknown>)[key] = [];
      } else if (initialValue === null) {
        (acc as Record<string, unknown>)[key] = null;
      } else {
        (acc as Record<string, unknown>)[key] = initialValue;
      }
      return acc;
    }, {} as T);
    setFiltersState(clearedFilters);
  }, [initialFilters]);

  // Salvar manualmente no localStorage
  const saveFilters = useCallback(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(filters));
    } catch {
      // Silenciar erros
    }
  }, [filters, storageKey]);

  // Carregar do localStorage
  const loadFilters = useCallback((): T | null => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (validateFilters) {
          return validateFilters(parsed) ? parsed : null;
        }
        return parsed as T;
      }
    } catch {
      // Silenciar erros
    }
    return null;
  }, [storageKey, validateFilters]);

  // Limpar persistência
  const clearPersistedFilters = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Silenciar erros
    }
  }, [storageKey]);

  // Verificar se há filtros ativos
  const hasActiveFilters = useMemo(() => {
    return Object.entries(filters).some(([key, value]) => {
      const initialValue = initialFilters[key as keyof T];
      // Considerar ativo se diferente do valor inicial
      if (typeof value === 'string') return value !== '' && value !== initialValue;
      if (typeof value === 'number') return value !== 0 && value !== initialValue;
      if (typeof value === 'boolean') return value !== false && value !== initialValue;
      if (Array.isArray(value)) return value.length > 0;
      return value !== null && value !== undefined && value !== initialValue;
    });
  }, [filters, initialFilters]);

  // Contar filtros ativos
  const activeFilterCount = useMemo(() => {
    return Object.entries(filters).filter(([key, value]) => {
      const initialValue = initialFilters[key as keyof T];
      if (typeof value === 'string') return value !== '' && value !== initialValue;
      if (typeof value === 'number') return value !== 0 && value !== initialValue;
      if (typeof value === 'boolean') return value !== false && value !== initialValue;
      if (Array.isArray(value)) return value.length > 0;
      return value !== null && value !== undefined && value !== initialValue;
    }).length;
  }, [filters, initialFilters]);

  return {
    // Estado
    filters,

    // Funções de manipulação
    setFilter,
    setFilters,
    resetFilters,
    clearFilters,

    // Persistência
    saveFilters,
    loadFilters,
    clearPersistedFilters,

    // Estado derivado
    hasActiveFilters,
    activeFilterCount,
  };
}

export default usePersistedFilters;
