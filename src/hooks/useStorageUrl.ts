/**
 * Hook para gerar signed URLs do Supabase Storage.
 * Suporta múltiplos buckets (embryo-videos, embryoscore).
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * Signed URL para arquivo no bucket embryoscore.
 * Retorna null se path é null/undefined.
 */
export function useEmbryoscoreUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ['embryoscore-url', path],
    queryFn: async () => {
      if (!path) return null;
      const { data, error } = await supabase.storage
        .from('embryoscore')
        .createSignedUrl(path, 60 * 60); // 1h
      if (error || !data?.signedUrl) return null;
      return data.signedUrl;
    },
    enabled: !!path,
    staleTime: 30 * 60 * 1000, // 30min
  });
}

/**
 * Signed URL para arquivo no bucket embryo-videos (legacy).
 */
export function useEmbryoVideoUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ['embryo-video-url', path],
    queryFn: async () => {
      if (!path) return null;
      const { data, error } = await supabase.storage
        .from('embryo-videos')
        .createSignedUrl(path, 60 * 60);
      if (error || !data?.signedUrl) return null;
      return data.signedUrl;
    },
    enabled: !!path,
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * Signed URL para arquivo no bucket profiles (avatars, banners, etc.).
 */
export function useProfileUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ['profile-url', path],
    queryFn: async () => {
      if (!path) return null;
      const { data, error } = await supabase.storage
        .from('profiles')
        .createSignedUrl(path, 60 * 60); // 1h
      if (error || !data?.signedUrl) return null;
      return data.signedUrl;
    },
    enabled: !!path,
    staleTime: 30 * 60 * 1000, // 30min
  });
}
