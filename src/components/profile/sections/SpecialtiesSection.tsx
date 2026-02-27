/**
 * Secao de especialidades do prestador de servico.
 */
import { Badge } from '@/components/ui/badge';
import type { SpecialtiesContent } from '@/lib/types';

interface SpecialtiesSectionProps {
  content: SpecialtiesContent;
}

export default function SpecialtiesSection({ content }: SpecialtiesSectionProps) {
  const hasContent = content.description || (content.specialties?.length > 0);

  if (!hasContent) {
    return <p className="text-sm text-muted-foreground">Nenhuma especialidade configurada.</p>;
  }

  return (
    <div className="space-y-3">
      {content.description && (
        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
          {content.description}
        </p>
      )}
      {content.specialties?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {content.specialties.map(s => (
            <Badge key={s} variant="secondary" className="text-xs font-medium">
              {s}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
