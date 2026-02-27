/**
 * Showcase de funcionalidades do PassaGene.
 */
import * as LucideIcons from 'lucide-react';
import type { FeatureShowcaseContent } from '@/lib/types';

interface FeatureShowcaseSectionProps {
  content: FeatureShowcaseContent;
}

function getIcon(iconName: string): React.ComponentType<{ className?: string }> | null {
  // Convert kebab-case to PascalCase for Lucide
  const pascalName = iconName
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

  const icon = (LucideIcons as any)[pascalName];
  return icon || null;
}

export default function FeatureShowcaseSection({ content }: FeatureShowcaseSectionProps) {
  if (!content.features?.length) {
    return <p className="text-sm text-muted-foreground">Nenhuma funcionalidade adicionada.</p>;
  }

  const isGrid = content.layout !== 'list';

  return (
    <div className={isGrid ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : 'space-y-3'}>
      {content.features.map((feature, i) => {
        const Icon = getIcon(feature.icon);
        return (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-4 hover:border-primary/20 transition-colors"
          >
            <div className="flex items-start gap-3">
              {Icon && (
                <div className="shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="w-4.5 h-4.5 text-primary" />
                </div>
              )}
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-foreground">{feature.title}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                  {feature.description}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
