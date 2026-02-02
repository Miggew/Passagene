import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface Cliente {
  id: string;
  nome: string;
}

/**
 * Hook para buscar os clientes que o usuario atual tem acesso.
 *
 * - Admin: retorna todos os clientes
 * - Cliente: retorna apenas o cliente vinculado (via user_profiles.cliente_id)
 * - Operacional: retorna os clientes vinculados (via tabela user_clientes)
 */
export function useUserClientes() {
  const { permissions } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteIds, setClienteIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = permissions?.isAdmin ?? false;
  const isCliente = permissions?.isCliente ?? false;
  const userId = permissions?.profile?.id;
  const userClienteId = permissions?.profile?.cliente_id;

  const loadClientes = useCallback(async () => {
    if (!permissions) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Admin: todos os clientes
      if (isAdmin) {
        const { data, error } = await supabase
          .from('clientes')
          .select('id, nome')
          .order('nome');

        if (error) throw error;

        setClientes(data || []);
        setClienteIds((data || []).map(c => c.id));
        return;
      }

      // Cliente: apenas o cliente vinculado
      if (isCliente && userClienteId) {
        const { data, error } = await supabase
          .from('clientes')
          .select('id, nome')
          .eq('id', userClienteId)
          .single();

        if (error) throw error;

        setClientes(data ? [data] : []);
        setClienteIds(data ? [data.id] : []);
        return;
      }

      // Operacional: clientes vinculados via user_clientes
      if (userId) {
        const { data: vinculos, error: vinculosError } = await supabase
          .from('user_clientes')
          .select('cliente_id')
          .eq('user_id', userId);

        if (vinculosError) throw vinculosError;

        const ids = (vinculos || []).map(v => v.cliente_id);

        if (ids.length === 0) {
          setClientes([]);
          setClienteIds([]);
          return;
        }

        const { data: clientesData, error: clientesError } = await supabase
          .from('clientes')
          .select('id, nome')
          .in('id', ids)
          .order('nome');

        if (clientesError) throw clientesError;

        setClientes(clientesData || []);
        setClienteIds((clientesData || []).map(c => c.id));
      }
    } catch (error) {
      console.error('[useUserClientes] Erro ao carregar clientes:', error);
      setClientes([]);
      setClienteIds([]);
    } finally {
      setLoading(false);
    }
  }, [permissions, isAdmin, isCliente, userId, userClienteId]);

  useEffect(() => {
    loadClientes();
  }, [loadClientes]);

  return {
    clientes,
    clienteIds,
    loading,
    reload: loadClientes,
    // Helpers
    hasAccess: clienteIds.length > 0 || isAdmin,
    isSingleCliente: clienteIds.length === 1,
  };
}
