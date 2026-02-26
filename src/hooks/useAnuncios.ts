/**
 * Hooks para o Marketplace C2C (anúncios de usuários).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { handleError } from '@/lib/error-handler';
import type { AnuncioUsuario, AnuncioTipo, AnuncioStatus } from '@/lib/types';

// ==================== QUERIES ====================

/** Anúncios do usuário logado */
export function useMeusAnuncios(userId: string | null) {
  return useQuery({
    queryKey: ['meus-anuncios', userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('anuncios_usuario')
        .select('*')
        .eq('user_id', userId)
        .neq('status', 'REMOVIDO')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as AnuncioUsuario[];
    },
    enabled: !!userId,
    staleTime: 60 * 1000,
  });
}

interface AnuncioFilters {
  tipo?: AnuncioTipo | 'todos';
  busca?: string;
}

/** Anúncios ativos de todos os usuários (feed público) */
export function useAnunciosAtivos(filters?: AnuncioFilters) {
  return useQuery({
    queryKey: ['anuncios-ativos', filters],
    queryFn: async () => {
      let query = supabase
        .from('anuncios_usuario')
        .select('*')
        .eq('status', 'ATIVO')
        .order('created_at', { ascending: false });

      if (filters?.tipo && filters.tipo !== 'todos') {
        query = query.eq('tipo', filters.tipo);
      }

      if (filters?.busca) {
        const safeBusca = filters.busca.replace(/[%,.*()]/g, '');
        query = query.or(`titulo.ilike.%${safeBusca}%,descricao.ilike.%${safeBusca}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const anuncios = (data || []) as AnuncioUsuario[];

      // Enriquecer com dados do vendedor (queries separadas conforme CLAUDE.md)
      if (anuncios.length === 0) return anuncios;

      const userIds = [...new Set(anuncios.map(a => a.user_id))];
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, nome, avatar_url, profile_slug, localizacao')
        .in('id', userIds);

      const profileMap = new Map(
        (profiles || []).map(p => [p.id, p])
      );

      return anuncios.map(a => ({
        ...a,
        vendedor_nome: profileMap.get(a.user_id)?.nome,
        vendedor_avatar: profileMap.get(a.user_id)?.avatar_url,
        vendedor_slug: profileMap.get(a.user_id)?.profile_slug,
        vendedor_localizacao: profileMap.get(a.user_id)?.localizacao,
      }));
    },
    staleTime: 2 * 60 * 1000,
  });
}

// ==================== MUTATIONS ====================

interface CriarAnuncioInput {
  tipo: AnuncioTipo;
  titulo: string;
  descricao?: string;
  preco?: number;
  preco_negociavel?: boolean;
  doadora_id?: string;
  touro_id?: string;
  foto_principal?: string;
  fotos_galeria?: string[];
  cliente_id?: string;
  status?: AnuncioStatus;
}

export function useCriarAnuncio() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CriarAnuncioInput) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('anuncios_usuario')
        .insert({
          ...input,
          user_id: user.id,
          status: input.status || 'RASCUNHO',
        })
        .select()
        .single();

      if (error) throw error;
      return data as AnuncioUsuario;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meus-anuncios', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['anuncios-ativos'] });
    },
    onError: (error) => {
      handleError(error, 'Erro ao criar anúncio');
    },
  });
}

export function useAtualizarAnuncio() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CriarAnuncioInput> & { id: string }) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('anuncios_usuario')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data as AnuncioUsuario;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meus-anuncios', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['anuncios-ativos'] });
    },
    onError: (error) => {
      handleError(error, 'Erro ao atualizar anúncio');
    },
  });
}

export function useRemoverAnuncio() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('anuncios_usuario')
        .update({ status: 'REMOVIDO', updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meus-anuncios', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['anuncios-ativos'] });
    },
    onError: (error) => {
      handleError(error, 'Erro ao remover anúncio');
    },
  });
}
