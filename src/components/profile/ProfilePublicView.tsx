/**
 * ProfilePublicView — Wrapper do perfil público (visitante).
 * Rota: /perfil/:slug
 */

import { useParams } from 'react-router-dom';
import { usePublicProfile, useProfileSections } from '@/hooks/useProfile';
import { useAuth } from '@/contexts/AuthContext';
import ProfileHeader from './ProfileHeader';
import ProfileSectionsView from './ProfileSectionsView';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

export default function ProfilePublicView() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();

  const { data: profile, isLoading: profileLoading } = usePublicProfile(slug ?? null);
  const { data: sections = [], isLoading: sectionsLoading } = useProfileSections(
    profile?.id ?? null,
    true // publicOnly
  );

  const isOwner = user?.id === profile?.id;

  if (profileLoading || sectionsLoading) {
    return <LoadingSpinner />;
  }

  if (!profile) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-lg font-bold text-foreground">Perfil não encontrado</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Este perfil não existe ou é privado.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24 md:pb-8">
      {/* Header with inline avatar */}
      <ProfileHeader
        profile={profile}
        isOwner={isOwner}
      />

      {/* Seções públicas */}
      <ProfileSectionsView
        sections={sections}
        isOwner={false}
      />

      {sections.length === 0 && (
        <div className="px-4 md:px-6">
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Este perfil ainda não tem seções públicas.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
