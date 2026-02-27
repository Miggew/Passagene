/**
 * Dispatcher por tipo de seção — renderiza o componente correto.
 */

import type { ProfileSection } from '@/lib/types';
import TextSection from './sections/TextSection';
import AnimalShowcaseSection from './sections/AnimalShowcaseSection';
import PhotoGallerySection from './sections/PhotoGallerySection';
import StatsSection from './sections/StatsSection';
import FazendaHighlightSection from './sections/FazendaHighlightSection';
import ProductionStatsSection from './sections/ProductionStatsSection';
import ServiceStatsSection from './sections/ServiceStatsSection';
import SpecialtiesSection from './sections/SpecialtiesSection';
import ServicePortfolioSection from './sections/ServicePortfolioSection';
import FazendaLinksSection from './sections/FazendaLinksSection';

interface ProfileSectionCardProps {
  section: ProfileSection;
}

export default function ProfileSectionCard({ section }: ProfileSectionCardProps) {
  const content = section.content;

  return (
    <div className="rounded-xl border border-border bg-card p-4 md:p-5 shadow-sm">
      {section.title && (
        <h3 className="text-base font-bold text-foreground mb-3">{section.title}</h3>
      )}

      {section.section_type === 'text' && (
        <TextSection content={content as any} />
      )}
      {section.section_type === 'animal_showcase' && (
        <AnimalShowcaseSection content={content as any} />
      )}
      {section.section_type === 'photo_gallery' && (
        <PhotoGallerySection content={content as any} />
      )}
      {section.section_type === 'stats' && (
        <StatsSection content={content as any} />
      )}
      {section.section_type === 'fazenda_highlight' && (
        <FazendaHighlightSection content={content as any} />
      )}
      {section.section_type === 'production_stats' && (
        <ProductionStatsSection content={content as any} />
      )}
      {section.section_type === 'service_stats' && (
        <ServiceStatsSection content={content as any} />
      )}
      {section.section_type === 'specialties' && (
        <SpecialtiesSection content={content as any} />
      )}
      {section.section_type === 'service_portfolio' && (
        <ServicePortfolioSection content={content as any} />
      )}
      {section.section_type === 'fazenda_links' && (
        <FazendaLinksSection content={content as any} />
      )}
    </div>
  );
}
