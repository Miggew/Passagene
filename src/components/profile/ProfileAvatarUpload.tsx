/**
 * Upload de avatar com preview — clique para trocar a foto.
 */

import { useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { useProfileUpload } from '@/hooks/useProfileUpload';
import { useUpdateProfile } from '@/hooks/useProfile';
import ProfileAvatar from './ProfileAvatar';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ProfileAvatarUploadProps {
  nome?: string;
  currentPath?: string | null;
  className?: string;
}

export default function ProfileAvatarUpload({ nome, currentPath, className }: ProfileAvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const upload = useProfileUpload();
  const updateProfile = useUpdateProfile();
  const isLoading = upload.isPending || updateProfile.isPending;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview local
    const reader = new FileReader();
    reader.onload = () => setPreviewUrl(reader.result as string);
    reader.readAsDataURL(file);

    try {
      const filePath = await upload.mutateAsync({
        file,
        options: { folder: 'avatars', upsert: true },
      });

      await updateProfile.mutateAsync({ avatar_url: filePath });
      toast.success('Avatar atualizado!');
    } catch {
      setPreviewUrl(null);
    }

    // Reset input
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className={cn('relative group', className)}>
      <ProfileAvatar
        nome={nome}
        avatarPath={currentPath}
        avatarUrl={previewUrl}
        size="xl"
        shape="square"
        onClick={() => !isLoading && inputRef.current?.click()}
      />

      {/* Overlay */}
      <div
        className={cn(
          'absolute inset-0 rounded-xl flex items-center justify-center transition-opacity',
          isLoading ? 'bg-black/40 opacity-100' : 'bg-black/30 opacity-0 group-hover:opacity-100 cursor-pointer'
        )}
        onClick={() => !isLoading && inputRef.current?.click()}
      >
        {isLoading ? (
          <Loader2 className="w-6 h-6 text-white animate-spin" />
        ) : (
          <Camera className="w-6 h-6 text-white" />
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
