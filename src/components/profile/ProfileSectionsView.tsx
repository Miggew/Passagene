/**
 * Lista de seções do perfil, ordenadas.
 * Mostra controles de reordenar/toggle/editar/deletar para o dono.
 */

import { ArrowUp, ArrowDown, Eye, EyeOff, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ProfileSectionCard from './ProfileSectionCard';
import type { ProfileSection } from '@/lib/types';

interface ProfileSectionsViewProps {
  sections: ProfileSection[];
  isOwner: boolean;
  onEdit?: (section: ProfileSection) => void;
  onDelete?: (sectionId: string) => void;
  onTogglePublic?: (section: ProfileSection) => void;
  onReorder?: (sectionId: string, direction: 'up' | 'down') => void;
}

export default function ProfileSectionsView({
  sections,
  isOwner,
  onEdit,
  onDelete,
  onTogglePublic,
  onReorder,
}: ProfileSectionsViewProps) {
  if (sections.length === 0) return null;

  return (
    <div className="space-y-4 px-4 md:px-6">
      {sections.map((section, index) => (
        <div key={section.id} className="relative group">
          {/* Controls */}
          {isOwner && (
            <div className="absolute -top-2 right-2 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-background/90 backdrop-blur rounded-lg border border-border shadow-sm px-1 py-0.5">
              {index > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7"
                  onClick={() => onReorder?.(section.id, 'up')}
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </Button>
              )}
              {index < sections.length - 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7"
                  onClick={() => onReorder?.(section.id, 'down')}
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="w-7 h-7"
                onClick={() => onTogglePublic?.(section)}
              >
                {section.is_public ? (
                  <Eye className="w-3.5 h-3.5 text-primary-500" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="w-7 h-7"
                onClick={() => onEdit?.(section)}
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="w-7 h-7 text-red-500 hover:text-red-600"
                onClick={() => onDelete?.(section.id)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}

          {/* Indicador de seção privada */}
          {isOwner && !section.is_public && (
            <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-semibold">
              <EyeOff className="w-3 h-3" />
              Privado
            </div>
          )}

          <ProfileSectionCard section={section} />
        </div>
      ))}
    </div>
  );
}
