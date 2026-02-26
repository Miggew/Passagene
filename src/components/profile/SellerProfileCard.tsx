/**
 * Card compacto do vendedor — avatar, nome, localização, link para perfil.
 */

import { useNavigate } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import ProfileAvatar from './ProfileAvatar';

interface SellerProfileCardProps {
  nome?: string;
  avatarPath?: string | null;
  slug?: string | null;
  localizacao?: string | null;
}

export default function SellerProfileCard({ nome, avatarPath, slug, localizacao }: SellerProfileCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (slug) {
      navigate(`/perfil/${slug}`);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={!slug}
      className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/50 transition-colors text-left w-full"
    >
      <ProfileAvatar nome={nome} avatarPath={avatarPath} size="sm" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{nome || 'Vendedor'}</p>
        {localizacao && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <MapPin className="w-3 h-3 shrink-0" />
            <span className="truncate">{localizacao}</span>
          </div>
        )}
      </div>
    </button>
  );
}
