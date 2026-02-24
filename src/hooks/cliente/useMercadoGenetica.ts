/**
 * Hooks para o Mercado de Genética (Hub Cliente)
 * - Catálogo de doadoras e touros
 * - Reservas do cliente
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { handleError } from '@/lib/error-handler';
import type { CatalogoDoadora, CatalogoTouro } from '@/hooks/genetica/useCatalogoData';

// ==================== TIPOS ====================

export interface ReservaGenetica {
  id: string;
  cliente_id: string;
  user_id: string;
  catalogo_id: string;
  tipo: 'doadora' | 'touro';
  data_desejada: string | null;
  quantidade_embrioes: number | null;
  observacoes: string | null;
  status: 'PENDENTE' | 'CONFIRMADA' | 'RECUSADA' | 'CANCELADA' | 'CONCLUIDA';
  resposta_admin: string | null;
  respondido_em: string | null;
  created_at: string;
  // Dados do catálogo (join)
  animal_nome?: string;
  animal_registro?: string;
  animal_foto?: string;
  animal_raca?: string;
}

interface MercadoFilters {
  tipo?: 'doadora' | 'touro' | 'todos';
  raca?: string;
  busca?: string;
}

// ==================== CATÁLOGO ====================

export function useMercadoCatalogo(filters?: MercadoFilters) {
  return useQuery({
    queryKey: ['mercado-catalogo', filters],
    queryFn: async () => {
      const tipo = filters?.tipo || 'todos';
      const results: { doadoras: CatalogoDoadora[]; touros: CatalogoTouro[] } = {
        doadoras: [],
        touros: [],
      };

      // Carregar doadoras
      if (tipo === 'todos' || tipo === 'doadora') {
        let query = supabase
          .from('vw_catalogo_doadoras')
          .select('*')
          .order('destaque', { ascending: false })
          .order('ordem');

        if (filters?.raca) {
          query = query.eq('raca', filters.raca);
        }
        if (filters?.busca) {
          const safeBusca = filters.busca.replace(/[%,.*()]/g, '');
          query = query.or(`nome.ilike.%${safeBusca}%,registro.ilike.%${safeBusca}%`);
        }

        const { data, error } = await query;
        if (error) throw error;
        results.doadoras = (data as CatalogoDoadora[]) || [];
      }

      // Carregar touros
      if (tipo === 'todos' || tipo === 'touro') {
        let query = supabase
          .from('vw_catalogo_touros')
          .select('*')
          .order('destaque', { ascending: false })
          .order('ordem');

        if (filters?.raca) {
          query = query.eq('raca', filters.raca);
        }
        if (filters?.busca) {
          const safeBusca = filters.busca.replace(/[%,.*()]/g, '');
          query = query.or(`nome.ilike.%${safeBusca}%,registro.ilike.%${safeBusca}%`);
        }

        const { data, error } = await query;
        if (error) throw error;
        results.touros = (data as CatalogoTouro[]) || [];
      }

      return results;
    },
    staleTime: 2 * 60 * 1000,
  });
}

// ==================== RESERVAS ====================

export function useMinhasReservas(clienteId: string | null) {
  return useQuery({
    queryKey: ['minhas-reservas', clienteId],
    queryFn: async () => {
      if (!clienteId) return [];

      const { data, error } = await supabase
        .from('reservas_genetica')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Enriquecer com dados do catálogo
      const reservas = (data || []) as ReservaGenetica[];
      if (reservas.length === 0) return reservas;

      const catalogoIds = [...new Set(reservas.map(r => r.catalogo_id))];

      // Buscar nomes dos animais nas views do catálogo
      const [doadorasRes, tourosRes] = await Promise.all([
        supabase
          .from('vw_catalogo_doadoras')
          .select('catalogo_id, nome, registro, foto_principal, foto_url, raca')
          .in('catalogo_id', catalogoIds),
        supabase
          .from('vw_catalogo_touros')
          .select('catalogo_id, nome, registro, foto_principal, foto_url, raca')
          .in('catalogo_id', catalogoIds),
      ]);

      const catalogoMap = new Map<string, { nome: string; registro: string; foto: string | null; raca: string | null }>();

      for (const d of doadorasRes.data || []) {
        catalogoMap.set(d.catalogo_id, {
          nome: d.nome || d.registro,
          registro: d.registro,
          foto: d.foto_principal || d.foto_url,
          raca: d.raca,
        });
      }
      for (const t of tourosRes.data || []) {
        catalogoMap.set(t.catalogo_id, {
          nome: t.nome || t.registro,
          registro: t.registro,
          foto: t.foto_principal || t.foto_url,
          raca: t.raca,
        });
      }

      return reservas.map(r => ({
        ...r,
        animal_nome: catalogoMap.get(r.catalogo_id)?.nome,
        animal_registro: catalogoMap.get(r.catalogo_id)?.registro,
        animal_foto: catalogoMap.get(r.catalogo_id)?.foto,
        animal_raca: catalogoMap.get(r.catalogo_id)?.raca,
      }));
    },
    enabled: !!clienteId,
    staleTime: 30 * 1000,
  });
}

// ==================== MUTATIONS ====================

interface CriarReservaInput {
  cliente_id: string;
  catalogo_id: string;
  tipo: 'doadora' | 'touro';
  data_desejada?: string;
  quantidade_embrioes?: number;
  observacoes?: string;
}

export function useCriarReserva() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CriarReservaInput) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('reservas_genetica')
        .insert({
          ...input,
          user_id: user.id,
          status: 'PENDENTE',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['minhas-reservas', variables.cliente_id] });
      queryClient.invalidateQueries({ queryKey: ['mercado-catalogo'] });
    },
    onError: (error) => {
      handleError(error, 'Erro ao criar reserva');
    },
  });
}

export function useCancelarReserva() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, clienteId }: { id: string; clienteId: string }) => {
      const { error } = await supabase
        .from('reservas_genetica')
        .update({ status: 'CANCELADA', updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      return clienteId;
    },
    onSuccess: (clienteId) => {
      queryClient.invalidateQueries({ queryKey: ['minhas-reservas', clienteId] });
      queryClient.invalidateQueries({ queryKey: ['mercado-catalogo'] });
    },
    onError: (error) => {
      handleError(error, 'Erro ao cancelar reserva');
    },
  });
}
