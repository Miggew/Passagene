/**
 * Hook genérico para gerenciar estado de paginação
 * Reutilizável em qualquer tabela com paginação
 */

import { useState, useCallback, useMemo } from 'react';

export interface UsePaginationOptions {
  /** Tamanho da página (padrão: 20) */
  pageSize?: number;
  /** Página inicial (padrão: 1) */
  initialPage?: number;
  /** Total de itens (para cálculo de páginas) */
  totalItems?: number;
}

export interface UsePaginationReturn<T> {
  // Estado
  currentPage: number;
  pageSize: number;
  totalPages: number;

  // Funções de navegação
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  firstPage: () => void;
  lastPage: () => void;

  // Utilitários
  setPageSize: (size: number) => void;
  resetPage: () => void;

  // Paginação de dados
  paginatedData: T[];
  startIndex: number;
  endIndex: number;

  // Estado derivado
  hasNextPage: boolean;
  hasPrevPage: boolean;
  isFirstPage: boolean;
  isLastPage: boolean;
}

export function usePagination<T = unknown>(
  data: T[],
  options: UsePaginationOptions = {}
): UsePaginationReturn<T> {
  const {
    pageSize: initialPageSize = 20,
    initialPage = 1,
    totalItems,
  } = options;

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  // Calcular total de itens (usa totalItems se fornecido, senão usa data.length)
  const totalCount = totalItems ?? data.length;

  // Calcular total de páginas
  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(totalCount / pageSize));
  }, [totalCount, pageSize]);

  // Validar página atual (ajustar se necessário)
  const validPage = useMemo(() => {
    if (currentPage < 1) return 1;
    if (currentPage > totalPages) return totalPages;
    return currentPage;
  }, [currentPage, totalPages]);

  // Se a página válida é diferente da atual, atualizar
  useMemo(() => {
    if (validPage !== currentPage) {
      setCurrentPage(validPage);
    }
  }, [validPage, currentPage]);

  // Calcular índices de início e fim
  const startIndex = useMemo(() => {
    return (validPage - 1) * pageSize;
  }, [validPage, pageSize]);

  const endIndex = useMemo(() => {
    return Math.min(startIndex + pageSize, totalCount);
  }, [startIndex, pageSize, totalCount]);

  // Dados paginados
  const paginatedData = useMemo(() => {
    return data.slice(startIndex, startIndex + pageSize);
  }, [data, startIndex, pageSize]);

  // Estados derivados
  const hasNextPage = validPage < totalPages;
  const hasPrevPage = validPage > 1;
  const isFirstPage = validPage === 1;
  const isLastPage = validPage === totalPages;

  // Funções de navegação
  const goToPage = useCallback((page: number) => {
    const newPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(newPage);
  }, [totalPages]);

  const nextPage = useCallback(() => {
    if (hasNextPage) {
      setCurrentPage(prev => prev + 1);
    }
  }, [hasNextPage]);

  const prevPage = useCallback(() => {
    if (hasPrevPage) {
      setCurrentPage(prev => prev - 1);
    }
  }, [hasPrevPage]);

  const firstPage = useCallback(() => {
    setCurrentPage(1);
  }, []);

  const lastPage = useCallback(() => {
    setCurrentPage(totalPages);
  }, [totalPages]);

  const resetPage = useCallback(() => {
    setCurrentPage(initialPage);
  }, [initialPage]);

  const setPageSize = useCallback((size: number) => {
    const newSize = Math.max(1, size);
    setPageSizeState(newSize);
    // Reset para primeira página ao mudar tamanho
    setCurrentPage(1);
  }, []);

  return {
    // Estado
    currentPage: validPage,
    pageSize,
    totalPages,

    // Funções de navegação
    goToPage,
    nextPage,
    prevPage,
    firstPage,
    lastPage,

    // Utilitários
    setPageSize,
    resetPage,

    // Paginação de dados
    paginatedData,
    startIndex,
    endIndex,

    // Estado derivado
    hasNextPage,
    hasPrevPage,
    isFirstPage,
    isLastPage,
  };
}

export default usePagination;
