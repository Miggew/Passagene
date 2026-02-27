/**
 * Página do perfil de uma fazenda.
 * Rota: /fazenda/:slug
 */
import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFazendaProfileBySlug } from '@/hooks/useFazendaProfile';
import { useFazendaSections, useUpsertSection, useDeleteSection, useReorderSections } from '@/hooks/useProfile';
import { useAuth } from '@/contexts/AuthContext';
import FazendaProfileHeader from './FazendaProfileHeader';
import ProfileSectionsView from './ProfileSectionsView';
import ProfileSectionEditor from './ProfileSectionEditor';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import type { ProfileSection } from '@/lib/types';
import { toast } from 'sonner';

export default function FazendaProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();

  const { data: profileData, isLoading: profileLoading } = useFazendaProfileBySlug(slug ?? null);
  const isOwner = user?.id === profileData?.owner_id;

  const { data: sections = [], isLoading: sectionsLoading } = useFazendaSections(
    profileData?.id ?? null,
    !isOwner // publicOnly if not owner
  );

  const [sectionEditorOpen, setSectionEditorOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<ProfileSection | null>(null);

  const upsertSection = useUpsertSection();
  const deleteSection = useDeleteSection();
  const reorderSections = useReorderSections();

  const handleEditSection = useCallback((section: ProfileSection) => {
    setEditingSection(section);
    setSectionEditorOpen(true);
  }, []);

  const handleAddSection = useCallback(() => {
    setEditingSection(null);
    setSectionEditorOpen(true);
  }, []);

  const handleDeleteSection = useCallback((sectionId: string) => {
    if (confirm('Remover esta seção?')) {
      deleteSection.mutate(sectionId);
    }
  }, [deleteSection]);

  const handleTogglePublic = useCallback((section: ProfileSection) => {
    upsertSection.mutate({
      id: section.id,
      section_type: section.section_type,
      title: section.title,
      content: section.content,
      is_public: !section.is_public,
      fazenda_profile_id: profileData?.id,
    }, {
      onSuccess: () => toast.success(section.is_public ? 'Seção agora é privada' : 'Seção agora é pública'),
    });
  }, [upsertSection, profileData?.id]);

  const handleReorder = useCallback((sectionId: string, direction: 'up' | 'down') => {
    const idx = sections.findIndex(s => s.id === sectionId);
    if (idx === -1) return;
    const newOrder = [...sections];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= newOrder.length) return;
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
    reorderSections.mutate(newOrder.map(s => s.id));
  }, [sections, reorderSections]);

  if (profileLoading || sectionsLoading) return <LoadingSpinner />;

  if (!profileData) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-lg font-bold text-foreground">Fazenda não encontrada</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Este perfil não existe ou é privado.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24 md:pb-8">
      <FazendaProfileHeader
        fazendaProfile={profileData}
        fazenda={profileData.fazenda}
        isOwner={isOwner}
      />

      <ProfileSectionsView
        sections={sections}
        isOwner={isOwner}
        onEdit={isOwner ? handleEditSection : undefined}
        onDelete={isOwner ? handleDeleteSection : undefined}
        onTogglePublic={isOwner ? handleTogglePublic : undefined}
        onReorder={isOwner ? handleReorder : undefined}
      />

      {isOwner && (
        <div className="px-4 md:px-6">
          <Button variant="outline" className="w-full border-dashed" onClick={handleAddSection}>
            <Plus className="w-4 h-4 mr-2" />
            Adicionar seção
          </Button>
        </div>
      )}

      {!isOwner && sections.length === 0 && (
        <div className="px-4 md:px-6">
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Este perfil de fazenda ainda não tem seções.
            </p>
          </div>
        </div>
      )}

      {isOwner && (
        <ProfileSectionEditor
          open={sectionEditorOpen}
          onOpenChange={setSectionEditorOpen}
          section={editingSection}
          nextSortOrder={sections.length}
          fazendaProfileId={profileData?.id}
        />
      )}
    </div>
  );
}
