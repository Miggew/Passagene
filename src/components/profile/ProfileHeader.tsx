/**
 * Header do perfil — avatar inline, nome, role badges, bio, localização, telefone.
 */

import { MapPin, Pencil, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ProfileAvatar from './ProfileAvatar';
import ProfileAvatarUpload from './ProfileAvatarUpload';
import type { UserProfile } from '@/lib/types';

interface ProfileHeaderProps {
  profile: Pick<UserProfile, 'nome' | 'bio' | 'localizacao' | 'user_type' | 'avatar_url' | 'profile_roles' | 'telefone'>;
  isOwner: boolean;
  onEdit?: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  cliente: 'Produtor',
  prestador: 'Prestador de Serviço',
  admin: 'Administrador',
};

function getRoleBadges(profile: Pick<UserProfile, 'profile_roles' | 'user_type'>): string[] {
  if (profile.profile_roles && profile.profile_roles.length > 0) {
    return profile.profile_roles.map(r => ROLE_LABELS[r] || r);
  }
  // Fallback baseado no user_type
  if (profile.user_type === 'cliente') return ['Produtor'];
  return ['Prestador de Serviço'];
}

export default function ProfileHeader({ profile, isOwner, onEdit }: ProfileHeaderProps) {
  const badges = getRoleBadges(profile);

  return (
    <div className="px-4 md:px-6 pt-4">
      <div className="flex items-start gap-4">
        {/* Avatar / Logo */}
        <div className="shrink-0">
          {isOwner ? (
            <ProfileAvatarUpload nome={profile.nome} currentPath={profile.avatar_url} />
          ) : (
            <ProfileAvatar
              nome={profile.nome}
              avatarPath={profile.avatar_url}
              size="xl"
              shape="square"
            />
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-xl md:text-2xl font-extrabold text-foreground tracking-tight truncate">
              {profile.nome}
            </h1>

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

          {/* Role badges */}
          <div className="flex flex-wrap gap-1.5">
            {badges.map(label => (
              <Badge key={label} variant="secondary" className="text-[11px] font-semibold">
                {label}
              </Badge>
            ))}
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
              {profile.bio}
            </p>
          )}

          {/* Location + Phone */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {profile.localizacao && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                <span>{profile.localizacao}</span>
              </div>
            )}
            {profile.telefone && (
              <div className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" />
                <span>{profile.telefone}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
