/**
 * Hook para gerenciar preferências do cliente
 * Usa React Query para cache e auto-save via upsert no Supabase
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// ==================== TIPOS ====================

export interface ClientePreferences {
  id?: string;
  cliente_id: string;
  default_fazenda_id: string | null;
  font_size: 'normal' | 'grande';
  notif_dg: boolean;
  notif_sexagem: boolean;
  notif_parto: boolean;
  notif_te: boolean;
  email_reports: boolean;
  report_frequency: 'semanal' | 'quinzenal' | 'mensal';
  notification_email: string | null;
}

const DEFAULT_PREFERENCES: Omit<ClientePreferences, 'cliente_id'> = {
  default_fazenda_id: null,
  font_size: 'normal',
  notif_dg: true,
  notif_sexagem: true,
  notif_parto: true,
  notif_te: true,
  email_reports: false,
  report_frequency: 'mensal',
  notification_email: null,
};

// ==================== HOOK ====================

export function useClientePreferences(clienteId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['cliente-preferences', clienteId];

  // Carregar preferências
  const { data: preferences, isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<ClientePreferences> => {
      if (!clienteId) throw new Error('clienteId required');

      const { data, error } = await supabase
        .from('cliente_preferences')
        .select('*')
        .eq('cliente_id', clienteId)
        .maybeSingle();

      if (error) throw error;

      // Retorna dados do DB ou defaults
      if (data) return data as ClientePreferences;
      return { ...DEFAULT_PREFERENCES, cliente_id: clienteId };
    },
    enabled: !!clienteId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Mutation para upsert
  const mutation = useMutation({
    mutationFn: async (updates: Partial<ClientePreferences>) => {
      if (!clienteId) throw new Error('clienteId required');

      const { error } = await supabase
        .from('cliente_preferences')
        .upsert(
          { ...updates, cliente_id: clienteId, updated_at: new Date().toISOString() },
          { onConflict: 'cliente_id' }
        );

      if (error) throw error;
    },
    onMutate: async (updates) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ClientePreferences>(queryKey);
      queryClient.setQueryData<ClientePreferences>(queryKey, (old) => {
        if (!old) return { ...DEFAULT_PREFERENCES, cliente_id: clienteId!, ...updates };
        return { ...old, ...updates };
      });
      return { previous };
    },
    onError: (_err, _updates, context) => {
      // Rollback
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Função genérica de update
  const updatePreference = <K extends keyof ClientePreferences>(
    field: K,
    value: ClientePreferences[K]
  ) => {
    mutation.mutate({ [field]: value } as Partial<ClientePreferences>);
  };

  // Aplicar font_size no <html>
  useEffect(() => {
    const root = document.documentElement;
    if (preferences?.font_size === 'grande') {
      root.classList.add('font-grande');
    } else {
      root.classList.remove('font-grande');
    }
  }, [preferences?.font_size]);

  return {
    preferences: preferences ?? { ...DEFAULT_PREFERENCES, cliente_id: clienteId || '' },
    isLoading,
    updatePreference,
    isSaving: mutation.isPending,
  };
}
