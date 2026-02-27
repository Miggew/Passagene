/**
 * Hooks para Perfil de Fazenda e Stats
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { handleError } from '@/lib/error-handler';
import type { FazendaProfile, FazendaStats, ProviderStats, PlatformStats, Fazenda } from '@/lib/types';

/** Perfil da fazenda por slug (público) */
export function useFazendaProfileBySlug(slug: string | null) {
  return useQuery({
    queryKey: ['fazenda-profile', slug],
    queryFn: async () => {
      if (!slug) return null;
      // Query separada para evitar nested join issues
      const { data: fp, error: fpErr } = await supabase
        .from('fazenda_profiles')
        .select('*')
        .eq('slug', slug)
        .eq('is_public', true)
        .maybeSingle();
      if (fpErr) throw fpErr;
      if (!fp) return null;

      // Buscar fazenda separadamente
      const { data: fazenda, error: fErr } = await supabase
        .from('fazendas')
        .select('*')
        .eq('id', fp.fazenda_id)
        .single();
      if (fErr) throw fErr;

      return { ...fp, fazenda } as FazendaProfile & { fazenda: Fazenda };
    },
    enabled: !!slug,
    staleTime: 2 * 60 * 1000,
  });
}

/** Perfis de fazenda do usuário (via cliente_id → fazendas) */
export function useMyFazendaProfiles(clienteId: string | null) {
  return useQuery({
    queryKey: ['my-fazenda-profiles', clienteId],
    queryFn: async () => {
      if (!clienteId) return [];

      // Buscar fazendas do cliente
      const { data: fazendas, error: fErr } = await supabase
        .from('fazendas')
        .select('id, nome, sigla, localizacao')
        .eq('cliente_id', clienteId);
      if (fErr) throw fErr;
      if (!fazendas?.length) return [];

      // Buscar perfis existentes (queries separadas — nested joins falham)
      const fazendaIds = fazendas.map(f => f.id);
      const { data: profiles, error: pErr } = await supabase
        .from('fazenda_profiles')
        .select('*')
        .in('fazenda_id', fazendaIds);
      if (pErr) throw pErr;

      return fazendas.map(f => ({
        fazenda: f as Pick<Fazenda, 'id' | 'nome' | 'sigla' | 'localizacao'>,
        profile: (profiles || []).find(p => p.fazenda_id === f.id) as FazendaProfile | undefined,
      }));
    },
    enabled: !!clienteId,
    staleTime: 2 * 60 * 1000,
  });
}

/** Criar ou atualizar perfil de fazenda */
export function useUpsertFazendaProfile() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      id?: string;
      fazenda_id: string;
      descricao?: string;
      foto_url?: string;
      is_public?: boolean;
    }) => {
      if (!user) throw new Error('Não autenticado');

      if (data.id) {
        const { data: result, error } = await supabase
          .from('fazenda_profiles')
          .update({
            descricao: data.descricao,
            foto_url: data.foto_url,
            is_public: data.is_public,
            updated_at: new Date().toISOString(),
          })
          .eq('id', data.id)
          .eq('owner_id', user.id)
          .select()
          .single();
        if (error) throw error;
        return result as FazendaProfile;
      } else {
        const { data: result, error } = await supabase
          .from('fazenda_profiles')
          .insert({
            fazenda_id: data.fazenda_id,
            owner_id: user.id,
            descricao: data.descricao,
            foto_url: data.foto_url,
            is_public: data.is_public ?? true,
          })
          .select()
          .single();
        if (error) throw error;
        return result as FazendaProfile;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-fazenda-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['fazenda-profile'] });
    },
    onError: (error) => handleError(error, 'Erro ao salvar perfil da fazenda'),
  });
}

/** Stats de produção por fazenda (RPC retorna JSON direto) */
export function useFazendaStats(fazendaId: string | null) {
  return useQuery({
    queryKey: ['fazenda-stats', fazendaId],
    queryFn: async () => {
      if (!fazendaId) return null;
      const { data, error } = await supabase.rpc('get_fazenda_stats', {
        p_fazenda_id: fazendaId,
      });
      if (error) throw error;
      return data as FazendaStats | null;
    },
    enabled: !!fazendaId,
    staleTime: 5 * 60 * 1000,
  });
}

/** Stats do prestador de serviço (RPC retorna JSON direto) */
export function useProviderStats(userId: string | null) {
  return useQuery({
    queryKey: ['provider-stats', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase.rpc('get_provider_stats', {
        p_user_id: userId,
      });
      if (error) throw error;
      return data as ProviderStats | null;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

/** Stats agregadas da plataforma (admin) */
export function usePlatformStats() {
  return useQuery({
    queryKey: ['platform-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_platform_stats');
      if (error) throw error;
      return data as PlatformStats | null;
    },
    staleTime: 5 * 60 * 1000,
  });
}
