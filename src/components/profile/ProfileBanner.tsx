/**
 * Banner hero do perfil com avatar overlay.
 * aspect-[3/1] mobile, aspect-[4/1] desktop.
 */

import { useProfileUrl } from '@/hooks/useStorageUrl';
import ProfileAvatar from './ProfileAvatar';
import { cn } from '@/lib/utils';

interface ProfileBannerProps {
  nome?: string;
  avatarPath?: string | null;
  bannerPath?: string | null;
  size?: 'sm' | 'md' | 'lg';
  showAvatar?: boolean;
  className?: string;
}

export default function ProfileBanner({
  nome,
  avatarPath,
  bannerPath,
  size = 'md',
  showAvatar = true,
  className,
}: ProfileBannerProps) {
  const { data: bannerUrl } = useProfileUrl(bannerPath);

  return (
    <div className={cn('relative', className)}>
      {/* Banner */}
      <div
        className={cn(
          'w-full rounded-xl overflow-hidden',
          size === 'sm' && 'aspect-[4/1]',
          size === 'md' && 'aspect-[3/1] md:aspect-[4/1]',
          size === 'lg' && 'aspect-[2.5/1] md:aspect-[3.5/1]',
        )}
      >
        {bannerUrl ? (
          <img
            src={bannerUrl}
            alt="Banner"
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary-100 via-primary-50 to-accent-50 dark:from-primary-900/30 dark:via-primary-950/20 dark:to-background" />
        )}
      </div>

      {/* Avatar overlay */}
      {showAvatar && (
        <div className="absolute -bottom-6 left-4 md:left-6">
          <div className="ring-4 ring-background rounded-full">
            <ProfileAvatar
              nome={nome}
              avatarPath={avatarPath}
              size="xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
