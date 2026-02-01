import { useCallback, useMemo } from 'react';
import { usePermissions } from './usePermissions';

/**
 * Hook para filtrar dados baseado no cliente logado (multi-tenancy)
 *
 * IMPORTANTE: O banco de dados também aplica Row Level Security (RLS) automaticamente.
 * Este hook serve para:
 * 1. Evitar queries desnecessárias quando sabemos que serão filtradas
 * 2. Fornecer contexto do usuário para a UI
 * 3. Filtrar dados já carregados em memória
 *
 * A segurança real é garantida pelo RLS no Supabase (ver sql/rls_policies.sql)
 *
 * - Admin e Operacional: veem todos os dados
 * - Cliente: vê apenas dados vinculados ao seu cliente_id
 *
 * Uso:
 * ```typescript
 * const { clienteIdFilter, shouldFilterByCliente, applyClienteFilter } = useClienteFilter();
 *
 * // Em queries diretas
 * let query = supabase.from('fazendas').select('*');
 * if (clienteIdFilter) {
 *   query = query.eq('cliente_id', clienteIdFilter);
 * }
 *
 * // Ou usando o helper
 * const query = applyClienteFilter(
 *   supabase.from('fazendas').select('*'),
 *   'cliente_id'
 * );
 * ```
 */
export function useClienteFilter() {
  const { isCliente, clienteId, isAdmin, profile } = usePermissions();

  /**
   * Retorna o cliente_id para filtrar, ou null se não deve filtrar
   */
  const clienteIdFilter = useMemo(() => {
    // Admin e operacional veem tudo
    if (isAdmin || !isCliente) {
      return null;
    }
    // Cliente vê apenas seus dados
    return clienteId;
  }, [isAdmin, isCliente, clienteId]);

  /**
   * Indica se deve aplicar filtro por cliente
   */
  const shouldFilterByCliente = useMemo(() => {
    return clienteIdFilter !== null;
  }, [clienteIdFilter]);

  /**
   * Aplica filtro de cliente em uma query do Supabase
   *
   * @param query - Query do Supabase (ex: supabase.from('fazendas').select('*'))
   * @param column - Nome da coluna para filtrar (default: 'cliente_id')
   * @returns Query com filtro aplicado (se necessário)
   */
  const applyClienteFilter = useCallback(<T>(
    query: T,
    column: string = 'cliente_id'
  ): T => {
    if (!clienteIdFilter) {
      return query;
    }
    // @ts-expect-error - Query do Supabase tem método eq
    return query.eq(column, clienteIdFilter);
  }, [clienteIdFilter]);

  /**
   * Filtra um array de dados localmente pelo cliente_id
   * Útil para dados já carregados em memória
   *
   * @param data - Array de dados
   * @param getClienteId - Função para extrair cliente_id de cada item
   * @returns Array filtrado
   */
  const filterDataByCliente = useCallback(<T>(
    data: T[],
    getClienteId: (item: T) => string | undefined | null
  ): T[] => {
    if (!clienteIdFilter) {
      return data;
    }
    return data.filter(item => getClienteId(item) === clienteIdFilter);
  }, [clienteIdFilter]);

  /**
   * Verifica se um item pertence ao cliente logado
   * Retorna true se não há filtro ativo ou se o item pertence ao cliente
   */
  const belongsToCliente = useCallback((itemClienteId: string | undefined | null): boolean => {
    if (!clienteIdFilter) {
      return true; // Admin/operacional podem ver tudo
    }
    return itemClienteId === clienteIdFilter;
  }, [clienteIdFilter]);

  /**
   * Retorna informações do usuário logado para contexto
   */
  const userContext = useMemo(() => ({
    isAdmin,
    isCliente,
    clienteId,
    userName: profile?.nome ?? '',
    userType: profile?.user_type ?? 'operacional',
  }), [isAdmin, isCliente, clienteId, profile]);

  return {
    // Valores principais
    clienteIdFilter,
    shouldFilterByCliente,

    // Funções de filtro
    applyClienteFilter,
    filterDataByCliente,
    belongsToCliente,

    // Contexto do usuário
    userContext,
  };
}

/**
 * Tipos auxiliares para uso com o hook
 */
export interface ClienteFilterResult {
  clienteIdFilter: string | null;
  shouldFilterByCliente: boolean;
  applyClienteFilter: <T>(query: T, column?: string) => T;
  filterDataByCliente: <T>(data: T[], getClienteId: (item: T) => string | undefined | null) => T[];
  belongsToCliente: (itemClienteId: string | undefined | null) => boolean;
  userContext: {
    isAdmin: boolean;
    isCliente: boolean;
    clienteId: string | null;
    userName: string;
    userType: string;
  };
}
