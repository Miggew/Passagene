/**
 * Header do perfil de fazenda — foto, nome, localidade, link ao dono.
 */
import { MapPin, Pencil, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import ProfileAvatar from './ProfileAvatar';
import type { FazendaProfile, Fazenda } from '@/lib/types';

interface FazendaProfileHeaderProps {
  fazendaProfile: FazendaProfile;
  fazenda: Fazenda;
  ownerName?: string;
  ownerSlug?: string;
  isOwner: boolean;
  onEdit?: () => void;
}

export default function FazendaProfileHeader({
  fazendaProfile, fazenda, ownerName, ownerSlug, isOwner, onEdit,
}: FazendaProfileHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="px-4 md:px-6 pt-4">
      <div className="flex items-start gap-4">
        <div className="shrink-0">
          <ProfileAvatar
            nome={fazenda.nome}
            avatarPath={fazendaProfile.foto_url}
            size="xl"
            shape="square"
          />
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-xl md:text-2xl font-extrabold text-foreground tracking-tight truncate">
              {fazenda.nome}
            </h1>
            {isOwner && onEdit && (
              <Button variant="outline" size="sm" onClick={onEdit} className="shrink-0">
                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                Editar
              </Button>
            )}
          </div>

          {fazenda.localizacao && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="w-3.5 h-3.5" />
              <span>{fazenda.localizacao}</span>
            </div>
          )}

          {fazendaProfile.descricao && (
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 mt-1">
              {fazendaProfile.descricao}
            </p>
          )}

          {ownerName && (
            <button
              onClick={() => ownerSlug && navigate(`/perfil/${ownerSlug}`)}
              className="flex items-center gap-1 text-xs text-primary hover:underline mt-1"
            >
              {ownerName}
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
