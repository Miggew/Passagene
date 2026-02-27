/**
 * Portfolio de servicos — galeria de trabalhos notaveis.
 */
import { useProfileUrl } from '@/hooks/useStorageUrl';
import type { ServicePortfolioContent } from '@/lib/types';

interface ServicePortfolioSectionProps {
  content: ServicePortfolioContent;
}

function PortfolioItem({ item }: { item: ServicePortfolioContent['items'][number] }) {
  const { data: url } = useProfileUrl(item.foto_url);

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-card">
      <div className="aspect-square bg-muted">
        {url ? (
          <img
            src={url}
            alt={item.caption || 'Portfolio'}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
            Carregando...
          </div>
        )}
      </div>
      {(item.caption || item.resultado) && (
        <div className="p-2.5">
          {item.caption && (
            <p className="text-xs font-medium text-foreground line-clamp-2">{item.caption}</p>
          )}
          {item.resultado && (
            <p className="text-[11px] text-muted-foreground mt-0.5">{item.resultado}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function ServicePortfolioSection({ content }: ServicePortfolioSectionProps) {
  if (!content.items?.length) {
    return <p className="text-sm text-muted-foreground">Nenhum trabalho adicionado ainda.</p>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {content.items.map((item, i) => (
        <PortfolioItem key={i} item={item} />
      ))}
    </div>
  );
}
