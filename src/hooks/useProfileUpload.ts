/**
 * Hook para upload de arquivos do perfil (avatar, banner, fotos de seções, anúncios).
 * Usa o bucket 'profiles' com signed URLs.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { handleError } from '@/lib/error-handler';

interface UploadOptions {
  /** Pasta dentro do bucket (ex: 'avatars', 'banners', 'sections', 'anuncios') */
  folder: string;
  /** Subfolder opcional (ex: user_id, section_id) */
  subfolder?: string;
  /** Substituir arquivo existente com mesmo nome */
  upsert?: boolean;
}

export function useProfileUpload() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, options }: { file: File; options: UploadOptions }) => {
      if (!user) throw new Error('Usuário não autenticado');

      // Validar tipo
      if (!file.type.startsWith('image/')) {
        throw new Error('Apenas imagens são permitidas');
      }

      // Validar tamanho (5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Arquivo deve ter no máximo 5MB');
      }

      // Gerar nome do arquivo
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const timestamp = Date.now();
      const subfolder = options.subfolder || user.id;
      const filePath = `${options.folder}/${subfolder}/${timestamp}.${ext}`;

      // Upload
      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: options.upsert ?? true,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      return filePath;
    },
    onSuccess: () => {
      // Invalidar URLs em cache
      queryClient.invalidateQueries({ queryKey: ['profile-url'] });
    },
    onError: (error) => {
      handleError(error, 'Erro ao fazer upload');
    },
  });
}

/** Deletar arquivo do bucket profiles */
export function useProfileFileDelete() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (filePath: string) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase.storage
        .from('profiles')
        .remove([filePath]);

      if (error) throw error;
    },
    onError: (error) => {
      handleError(error, 'Erro ao remover arquivo');
    },
  });
}
