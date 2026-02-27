/**
 * ProfilePage — Container principal do perfil pessoal.
 * Substitui a Home como página inicial (/).
 * Admin/operacional: atalhos discretos colapsáveis abaixo do header.
 */

import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ChevronDown, ArrowRight, Syringe, FlaskConical, Users, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useProfileData, useProfileSections, useUpsertSection, useDeleteSection, useReorderSections } from '@/hooks/useProfile';
import ProfileHeader from './ProfileHeader';
import ProfileEditDrawer from './ProfileEditDrawer';
import ProfileSectionsView from './ProfileSectionsView';
import ProfileSectionEditor from './ProfileSectionEditor';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import ProfileAnunciosSection from './ProfileAnunciosSection';
import type { ProfileSection } from '@/lib/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { HUB_HOME_ROUTES, hubIcons, routeLabels } from '@/lib/nav-config';

export default function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isAdmin, isOperacional, getAccessibleHubs } = usePermissions();

  const { data: profile, isLoading: profileLoading } = useProfileData(user?.id ?? null);
  const { data: sections = [], isLoading: sectionsLoading } = useProfileSections(user?.id ?? null);

  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [sectionEditorOpen, setSectionEditorOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<ProfileSection | null>(null);
  const [hubMenuOpen, setHubMenuOpen] = useState(false);

  const upsertSection = useUpsertSection();
  const deleteSection = useDeleteSection();
  const reorderSections = useReorderSections();

  // Hub shortcuts para admin/operacional
  const hubShortcuts = useMemo(() => {
    if (!isAdmin && !isOperacional) return [];
    const hubs = getAccessibleHubs().filter(h => !(h.routes.length === 1 && h.routes[0] === '/'));
    return hubs.map(hub => ({
      code: hub.code,
      name: hub.name,
      route: HUB_HOME_ROUTES[hub.code] || hub.routes.find(r => r !== '/') || '/',
      icon: hubIcons[hub.code],
    }));
  }, [isAdmin, isOperacional, getAccessibleHubs]);

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
    }, {
      onSuccess: () => toast.success(section.is_public ? 'Seção agora é privada' : 'Seção agora é pública'),
    });
  }, [upsertSection]);

  const handleReorder = useCallback((sectionId: string, direction: 'up' | 'down') => {
    const idx = sections.findIndex(s => s.id === sectionId);
    if (idx === -1) return;

    const newOrder = [...sections];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= newOrder.length) return;

    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
    reorderSections.mutate(newOrder.map(s => s.id));
  }, [sections, reorderSections]);

  if (profileLoading || sectionsLoading) {
    return <LoadingSpinner />;
  }

  if (!profile) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Perfil não encontrado. Contate o administrador.
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24 md:pb-8">
      {/* Header with inline avatar */}
      <ProfileHeader
        profile={profile}
        isOwner={true}
        onEdit={() => setEditDrawerOpen(true)}
      />

      {/* Atalhos de Hub — menu discreto colapsável (admin/operacional) */}
      {hubShortcuts.length > 0 && (
        <div className="px-4 md:px-6">
          <button
            onClick={() => setHubMenuOpen(!hubMenuOpen)}
            className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className={cn('w-3.5 h-3.5 transition-transform duration-200', hubMenuOpen && 'rotate-180')} />
            Acesso rápido
          </button>

          {hubMenuOpen && (
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
              {hubShortcuts.map((hub) => {
                const Icon = hub.icon;
                return (
                  <button
                    key={hub.code}
                    onClick={() => navigate(hub.route)}
                    className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border/60 bg-card hover:bg-muted/50 hover:border-primary/30 transition-all text-left group"
                  >
                    {Icon && <Icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />}
                    <span className="text-xs font-medium text-foreground truncate">{hub.name}</span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Seções customizáveis */}
      <ProfileSectionsView
        sections={sections}
        isOwner={true}
        onEdit={handleEditSection}
        onDelete={handleDeleteSection}
        onTogglePublic={handleTogglePublic}
        onReorder={handleReorder}
      />

      {/* Anúncios do usuário */}
      {user?.id && (
        <ProfileAnunciosSection userId={user.id} isOwner={true} />
      )}

      {/* Botão adicionar seção */}
      <div className="px-4 md:px-6">
        <Button
          variant="outline"
          className="w-full border-dashed"
          onClick={handleAddSection}
        >
          <Plus className="w-4 h-4 mr-2" />
          Adicionar seção ao perfil
        </Button>
      </div>

      {/* Drawers/Dialogs */}
      <ProfileEditDrawer
        open={editDrawerOpen}
        onOpenChange={setEditDrawerOpen}
        profile={profile}
      />
      <ProfileSectionEditor
        open={sectionEditorOpen}
        onOpenChange={setSectionEditorOpen}
        section={editingSection}
        nextSortOrder={sections.length}
      />
    </div>
  );
}
