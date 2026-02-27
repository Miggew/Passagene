/**
 * Hooks para o Perfil Pessoal
 * - Dados do perfil (próprio e público)
 * - Seções customizáveis
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { handleError } from '@/lib/error-handler';
import type { UserProfile, ProfileSection, ProfileSectionContent } from '@/lib/types';

// ==================== PERFIL ====================

/** Dados completos do perfil do usuário logado */
export function useProfileData(userId: string | null) {
  return useQuery({
    queryKey: ['profile-data', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      return data as UserProfile | null;
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  });
}

/** Perfil público por slug */
export function usePublicProfile(slug: string | null) {
  return useQuery({
    queryKey: ['public-profile', slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, nome, bio, avatar_url, banner_url, profile_slug, profile_public, localizacao, user_type, cliente_id, profile_roles, telefone, specialties, service_description')
        .eq('profile_slug', slug)
        .eq('profile_public', true)
        .maybeSingle();

      if (error) throw error;
      return data as (Pick<UserProfile, 'id' | 'nome' | 'bio' | 'avatar_url' | 'banner_url' | 'profile_slug' | 'profile_public' | 'localizacao' | 'user_type' | 'cliente_id' | 'profile_roles' | 'telefone' | 'specialties' | 'service_description'>) | null;
    },
    enabled: !!slug,
    staleTime: 2 * 60 * 1000,
  });
}

/** Atualizar dados do perfil */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (updates: Partial<Pick<UserProfile, 'nome' | 'bio' | 'avatar_url' | 'banner_url' | 'profile_slug' | 'profile_public' | 'telefone' | 'localizacao' | 'profile_roles' | 'specialties' | 'service_description'>>) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('user_profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data as UserProfile;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['profile-data', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['public-profile', data.profile_slug] });
    },
    onError: (error) => {
      handleError(error, 'Erro ao atualizar perfil');
    },
  });
}

// ==================== SEÇÕES ====================

/** Listar seções do perfil de um usuário */
export function useProfileSections(userId: string | null, publicOnly = false) {
  return useQuery({
    queryKey: ['profile-sections', userId, publicOnly],
    queryFn: async () => {
      if (!userId) return [];

      let query = supabase
        .from('profile_sections')
        .select('*')
        .eq('user_id', userId)
        .eq('active', true)
        .order('sort_order');

      if (publicOnly) {
        query = query.eq('is_public', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ProfileSection[];
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  });
}

/** Listar seções de um perfil de fazenda */
export function useFazendaSections(fazendaProfileId: string | null, publicOnly = false) {
  return useQuery({
    queryKey: ['fazenda-sections', fazendaProfileId, publicOnly],
    queryFn: async () => {
      if (!fazendaProfileId) return [];

      let query = supabase
        .from('profile_sections')
        .select('*')
        .eq('fazenda_profile_id', fazendaProfileId)
        .eq('active', true)
        .order('sort_order');

      if (publicOnly) {
        query = query.eq('is_public', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ProfileSection[];
    },
    enabled: !!fazendaProfileId,
    staleTime: 2 * 60 * 1000,
  });
}

/** Criar ou atualizar seção */
export function useUpsertSection() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (section: {
      id?: string;
      section_type: ProfileSection['section_type'];
      title: string;
      content: ProfileSectionContent;
      sort_order?: number;
      is_public?: boolean;
      fazenda_profile_id?: string;
    }) => {
      if (!user) throw new Error('Usuário não autenticado');

      if (section.id) {
        // Update
        const { data, error } = await supabase
          .from('profile_sections')
          .update({
            title: section.title,
            content: section.content,
            sort_order: section.sort_order,
            is_public: section.is_public,
            updated_at: new Date().toISOString(),
          })
          .eq('id', section.id)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) throw error;
        return data as ProfileSection;
      } else {
        // Insert
        const { data, error } = await supabase
          .from('profile_sections')
          .insert({
            user_id: user.id,
            section_type: section.section_type,
            title: section.title,
            content: section.content,
            sort_order: section.sort_order ?? 0,
            is_public: section.is_public ?? true,
            fazenda_profile_id: section.fazenda_profile_id || null,
          })
          .select()
          .single();

        if (error) throw error;
        return data as ProfileSection;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-sections', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['fazenda-sections'] });
    },
    onError: (error) => {
      handleError(error, 'Erro ao salvar seção');
    },
  });
}

/** Deletar seção (soft delete) */
export function useDeleteSection() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (sectionId: string) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('profile_sections')
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq('id', sectionId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-sections', user?.id] });
    },
    onError: (error) => {
      handleError(error, 'Erro ao remover seção');
    },
  });
}

/** Reordenar seções */
export function useReorderSections() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      if (!user) throw new Error('Usuário não autenticado');

      // Atualizar sort_order de cada seção
      const updates = orderedIds.map((id, index) =>
        supabase
          .from('profile_sections')
          .update({ sort_order: index, updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('user_id', user.id)
      );

      const results = await Promise.all(updates);
      const firstError = results.find(r => r.error);
      if (firstError?.error) throw firstError.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile-sections', user?.id] });
    },
    onError: (error) => {
      handleError(error, 'Erro ao reordenar seções');
    },
  });
}
