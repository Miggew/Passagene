import { useProfileUrl } from '@/hooks/useStorageUrl';
import type { AnimalShowcaseContent } from '@/lib/types';

interface AnimalShowcaseSectionProps {
  content: AnimalShowcaseContent;
}

function AnimalThumb({ animal }: { animal: AnimalShowcaseContent['animals'][number] }) {
  const { data: fotoUrl } = useProfileUrl(animal.foto_url);

  return (
    <div className="rounded-lg border border-border bg-muted/30 overflow-hidden hover:-translate-y-0.5 transition-all duration-200 hover:shadow-md">
      <div className="aspect-square bg-muted">
        {fotoUrl ? (
          <img src={fotoUrl} alt={animal.nome} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
            Sem foto
          </div>
        )}
      </div>
      <div className="p-2">
        <p className="text-sm font-semibold text-foreground truncate">{animal.nome}</p>
        <p className="text-[11px] text-muted-foreground capitalize">{animal.type === 'doadora' ? 'Doadora' : 'Touro'}</p>
      </div>
    </div>
  );
}

export default function AnimalShowcaseSection({ content }: AnimalShowcaseSectionProps) {
  if (!content.animals?.length) {
    return <p className="text-sm text-muted-foreground">Nenhum animal adicionado.</p>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {content.animals.map((animal) => (
        <AnimalThumb key={animal.id} animal={animal} />
      ))}
    </div>
  );
}
