/**
 * Header do perfil — nome, bio, localização, botão editar.
 */

import { MapPin, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { UserProfile } from '@/lib/types';

interface ProfileHeaderProps {
  profile: Pick<UserProfile, 'nome' | 'bio' | 'localizacao' | 'user_type'>;
  isOwner: boolean;
  onEdit?: () => void;
}

function getUserTypeLabel(type: string) {
  switch (type) {
    case 'admin': return 'Administrador';
    case 'operacional': return 'Equipe Técnica';
    case 'cliente': return 'Cliente';
    default: return type;
  }
}

export default function ProfileHeader({ profile, isOwner, onEdit }: ProfileHeaderProps) {
  return (
    <div className="pt-8 px-4 md:px-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <h1 className="text-xl md:text-2xl font-extrabold text-foreground tracking-tight truncate">
            {profile.nome}
          </h1>

          <p className="text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wider">
            {getUserTypeLabel(profile.user_type)}
          </p>

          {profile.bio && (
            <p className="text-sm text-muted-foreground leading-relaxed mt-2 line-clamp-3">
              {profile.bio}
            </p>
          )}

          {profile.localizacao && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
              <MapPin className="w-3.5 h-3.5" />
              <span>{profile.localizacao}</span>
            </div>
          )}
        </div>

        {isOwner && onEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            className="shrink-0"
          >
            <Pencil className="w-3.5 h-3.5 mr-1.5" />
            Editar
          </Button>
        )}
      </div>
    </div>
  );
}
