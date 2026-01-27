/**
 * React Query hooks para dados do Supabase
 * - Caching automático
 * - Deduplicação de requests
 * - Revalidação inteligente
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchFazendas,
  fetchFazendaById,
  fetchFazendasByClienteId,
  fetchTouros,
  fetchTouroById,
  fetchDoadorasByFazendaId,
  fetchDoadoraById,
  fetchReceptorasViewByFazenda,
  fetchReceptorasByIds,
  fetchReceptorasComStatusByFazenda,
  fetchDosesByClienteId,
  fetchClientes,
  fetchClienteById,
} from './supabaseQueries';

// ============================================
// QUERY KEYS - centralizadas para consistência
// ============================================

// Configurações de cache padrão
const CACHE_TIME = {
  STATIC: 10 * 60 * 1000, // 10 minutos para dados estáticos (fazendas, clientes)
  DYNAMIC: 5 * 60 * 1000, // 5 minutos para dados dinâmicos (doadoras, receptoras)
};

const STALE_TIME = {
  STATIC: 5 * 60 * 1000, // 5 minutos para dados estáticos
  DYNAMIC: 2 * 60 * 1000, // 2 minutos para dados dinâmicos
};

export const queryKeys = {
  // Fazendas
  fazendas: ['fazendas'] as const,
  fazenda: (id: string) => ['fazendas', id] as const,
  fazendasByCliente: (clienteId: string) => ['fazendas', 'cliente', clienteId] as const,

  // Touros
  touros: ['touros'] as const,
  touro: (id: string) => ['touros', id] as const,

  // Doadoras
  doadorasByFazenda: (fazendaId: string) => ['doadoras', 'fazenda', fazendaId] as const,
  doadora: (id: string) => ['doadoras', id] as const,

  // Receptoras
  receptorasViewByFazenda: (fazendaId: string) => ['receptoras-view', 'fazenda', fazendaId] as const,
  receptorasByIds: (ids: string[]) => ['receptoras', 'ids', ids.join(',')] as const,
  receptorasComStatusByFazenda: (fazendaId: string) => ['receptoras', 'fazenda', fazendaId, 'comStatus'] as const,

  // Doses
  dosesByCliente: (clienteId: string) => ['doses', 'cliente', clienteId] as const,

  // Clientes
  clientes: ['clientes'] as const,
  cliente: (id: string) => ['clientes', id] as const,
};

// ============================================
// FAZENDAS HOOKS
// ============================================

/**
 * Lista todas as fazendas (cache 5 min, gcTime 10 min)
 */
export function useFazendas() {
  return useQuery({
    queryKey: queryKeys.fazendas,
    queryFn: fetchFazendas,
    staleTime: STALE_TIME.STATIC,
    gcTime: CACHE_TIME.STATIC,
  });
}

/**
 * Busca fazenda por ID
 */
export function useFazenda(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.fazenda(id || ''),
    queryFn: () => fetchFazendaById(id!),
    enabled: !!id,
    staleTime: STALE_TIME.STATIC,
    gcTime: CACHE_TIME.STATIC,
  });
}

/**
 * Lista fazendas de um cliente específico
 */
export function useFazendasByCliente(clienteId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.fazendasByCliente(clienteId || ''),
    queryFn: () => fetchFazendasByClienteId(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE_TIME.STATIC,
    gcTime: CACHE_TIME.STATIC,
  });
}

// ============================================
// TOUROS HOOKS
// ============================================

/**
 * Lista todos os touros (cache 5 min, gcTime 10 min)
 */
export function useTouros() {
  return useQuery({
    queryKey: queryKeys.touros,
    queryFn: fetchTouros,
    staleTime: STALE_TIME.STATIC,
    gcTime: CACHE_TIME.STATIC,
  });
}

/**
 * Busca touro por ID
 */
export function useTouro(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.touro(id || ''),
    queryFn: () => fetchTouroById(id!),
    enabled: !!id,
    staleTime: STALE_TIME.STATIC,
    gcTime: CACHE_TIME.STATIC,
  });
}

// ============================================
// DOADORAS HOOKS
// ============================================

/**
 * Lista doadoras de uma fazenda (com última aspiração)
 */
export function useDoadorasByFazenda(fazendaId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.doadorasByFazenda(fazendaId || ''),
    queryFn: () => fetchDoadorasByFazendaId(fazendaId!),
    enabled: !!fazendaId,
    staleTime: STALE_TIME.DYNAMIC,
    gcTime: CACHE_TIME.DYNAMIC,
  });
}

/**
 * Busca doadora por ID
 */
export function useDoadora(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.doadora(id || ''),
    queryFn: () => fetchDoadoraById(id!),
    enabled: !!id,
    staleTime: STALE_TIME.DYNAMIC,
    gcTime: CACHE_TIME.DYNAMIC,
  });
}

// ============================================
// RECEPTORAS HOOKS
// ============================================

/**
 * Lista receptoras de uma fazenda (via view)
 */
export function useReceptorasViewByFazenda(fazendaId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.receptorasViewByFazenda(fazendaId || ''),
    queryFn: () => fetchReceptorasViewByFazenda(fazendaId!),
    enabled: !!fazendaId,
    staleTime: STALE_TIME.DYNAMIC,
    gcTime: CACHE_TIME.DYNAMIC,
  });
}

/**
 * Busca receptoras por lista de IDs
 */
export function useReceptorasByIds(ids: string[]) {
  return useQuery({
    queryKey: queryKeys.receptorasByIds(ids),
    queryFn: () => fetchReceptorasByIds(ids),
    enabled: ids.length > 0,
    staleTime: STALE_TIME.DYNAMIC,
    gcTime: CACHE_TIME.DYNAMIC,
  });
}

/**
 * Lista receptoras completas de uma fazenda (com status calculado)
 */
export function useReceptorasComStatusByFazenda(fazendaId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.receptorasComStatusByFazenda(fazendaId || ''),
    queryFn: () => fetchReceptorasComStatusByFazenda(fazendaId!),
    enabled: !!fazendaId,
    staleTime: STALE_TIME.DYNAMIC,
    gcTime: CACHE_TIME.DYNAMIC,
  });
}

// ============================================
// DOSES HOOKS
// ============================================

/**
 * Lista doses de um cliente
 */
export function useDosesByCliente(clienteId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.dosesByCliente(clienteId || ''),
    queryFn: () => fetchDosesByClienteId(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE_TIME.DYNAMIC,
    gcTime: CACHE_TIME.DYNAMIC,
  });
}

// ============================================
// CLIENTES HOOKS
// ============================================

/**
 * Lista todos os clientes
 */
export function useClientes() {
  return useQuery({
    queryKey: queryKeys.clientes,
    queryFn: fetchClientes,
    staleTime: STALE_TIME.STATIC,
    gcTime: CACHE_TIME.STATIC,
  });
}

/**
 * Busca cliente por ID
 */
export function useCliente(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.cliente(id || ''),
    queryFn: () => fetchClienteById(id!),
    enabled: !!id,
    staleTime: STALE_TIME.STATIC,
    gcTime: CACHE_TIME.STATIC,
  });
}

// ============================================
// INVALIDAÇÃO DE CACHE
// ============================================

/**
 * Hook para invalidar caches após mutations
 */
export function useInvalidateQueries() {
  const queryClient = useQueryClient();

  return {
    invalidateFazendas: () => queryClient.invalidateQueries({ queryKey: ['fazendas'] }),
    invalidateTouros: () => queryClient.invalidateQueries({ queryKey: ['touros'] }),
    invalidateDoadoras: (fazendaId?: string) => {
      if (fazendaId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.doadorasByFazenda(fazendaId) });
      } else {
        queryClient.invalidateQueries({ queryKey: ['doadoras'] });
      }
    },
    invalidateReceptoras: (fazendaId?: string) => {
      if (fazendaId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.receptorasViewByFazenda(fazendaId) });
      } else {
        queryClient.invalidateQueries({ queryKey: ['receptoras'] });
      }
    },
    invalidateClientes: () => queryClient.invalidateQueries({ queryKey: ['clientes'] }),
    invalidateDoses: (clienteId?: string) => {
      if (clienteId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.dosesByCliente(clienteId) });
      } else {
        queryClient.invalidateQueries({ queryKey: ['doses'] });
      }
    },
    invalidateAll: () => queryClient.invalidateQueries(),
  };
}
