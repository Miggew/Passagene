/**
 * Upload de banner com preview.
 */

import { useRef, useState } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import { useProfileUpload } from '@/hooks/useProfileUpload';
import { useUpdateProfile } from '@/hooks/useProfile';
import { useProfileUrl } from '@/hooks/useStorageUrl';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ProfileBannerUploadProps {
  currentPath?: string | null;
  className?: string;
}

export default function ProfileBannerUpload({ currentPath, className }: ProfileBannerUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { data: currentUrl } = useProfileUrl(currentPath);
  const upload = useProfileUpload();
  const updateProfile = useUpdateProfile();
  const isLoading = upload.isPending || updateProfile.isPending;

  const displayUrl = previewUrl || currentUrl;

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
        options: { folder: 'banners', upsert: true },
      });

      await updateProfile.mutateAsync({ banner_url: filePath });
      toast.success('Banner atualizado!');
    } catch {
      setPreviewUrl(null);
    }

    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div
      className={cn(
        'relative w-full aspect-[3/1] md:aspect-[4/1] rounded-xl overflow-hidden group cursor-pointer',
        className
      )}
      onClick={() => !isLoading && inputRef.current?.click()}
    >
      {/* Background */}
      {displayUrl ? (
        <img
          src={displayUrl}
          alt="Banner"
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-primary-100 via-primary-50 to-accent-50 dark:from-primary-900/30 dark:via-primary-950/20 dark:to-background" />
      )}

      {/* Overlay */}
      <div
        className={cn(
          'absolute inset-0 flex items-center justify-center transition-opacity',
          isLoading ? 'bg-black/40 opacity-100' : 'bg-black/20 opacity-0 group-hover:opacity-100'
        )}
      >
        {isLoading ? (
          <Loader2 className="w-8 h-8 text-white animate-spin" />
        ) : (
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-black/50 text-white text-sm font-medium">
            <ImagePlus className="w-4 h-4" />
            Alterar banner
          </div>
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
