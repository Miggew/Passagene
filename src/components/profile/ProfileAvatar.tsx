/**
 * Avatar reutilizável — imagem ou iniciais com gradiente.
 * Usado na TopBar, perfil, marketplace, seções.
 */

import { useProfileUrl } from '@/hooks/useStorageUrl';
import { cn } from '@/lib/utils';

interface ProfileAvatarProps {
  nome?: string;
  avatarPath?: string | null;
  /** URL direta (signed) — quando já temos a URL pronta */
  avatarUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** circle = rounded-full (TopBar, cards), square = rounded-xl (perfil, logos) */
  shape?: 'circle' | 'square';
  className?: string;
  onClick?: () => void;
}

const sizeMap = {
  xs: 'w-7 h-7 text-[10px]',
  sm: 'w-9 h-9 text-xs',
  md: 'w-12 h-12 text-sm',
  lg: 'w-16 h-16 text-lg',
  xl: 'w-24 h-24 text-2xl',
};

function getInitials(nome?: string): string {
  if (!nome) return '?';
  const parts = nome.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Gradiente determinístico baseado no nome
function getGradient(nome?: string): string {
  const gradients = [
    'from-primary-500 to-primary-700',
    'from-emerald-500 to-teal-700',
    'from-blue-500 to-indigo-700',
    'from-violet-500 to-purple-700',
    'from-amber-500 to-orange-700',
    'from-rose-500 to-pink-700',
    'from-cyan-500 to-sky-700',
    'from-lime-500 to-green-700',
  ];
  const hash = (nome || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return gradients[hash % gradients.length];
}

export default function ProfileAvatar({
  nome,
  avatarPath,
  avatarUrl: directUrl,
  size = 'md',
  shape = 'square',
  className,
  onClick,
}: ProfileAvatarProps) {
  const { data: signedUrl } = useProfileUrl(avatarPath);
  const imageUrl = directUrl || signedUrl;

  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-xl';
  const imgFit = shape === 'circle' ? 'object-cover' : 'object-contain';

  return (
    <div
      className={cn(
        sizeMap[size],
        shapeClass,
        'overflow-hidden flex-shrink-0 flex items-center justify-center font-bold text-white select-none',
        !imageUrl && `bg-gradient-to-br ${getGradient(nome)}`,
        imageUrl && 'bg-muted',
        onClick && 'cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all',
        className
      )}
      onClick={onClick}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={nome || 'Avatar'}
          className={cn('w-full h-full', imgFit)}
          loading="lazy"
        />
      ) : (
        getInitials(nome)
      )}
    </div>
  );
}
