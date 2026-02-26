import { MapPin } from 'lucide-react';
import type { FazendaHighlightContent } from '@/lib/types';

interface FazendaHighlightSectionProps {
  content: FazendaHighlightContent;
}

export default function FazendaHighlightSection({ content }: FazendaHighlightSectionProps) {
  return (
    <div className="space-y-2">
      {content.custom_description && (
        <p className="text-sm text-muted-foreground leading-relaxed">
          {content.custom_description}
        </p>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <MapPin className="w-3.5 h-3.5" />
        <span>Fazenda vinculada</span>
      </div>

      {content.show_animal_count && (
        <p className="text-xs text-muted-foreground">Contagem de animais exibida</p>
      )}
    </div>
  );
}
