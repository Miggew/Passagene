/**
 * Seção de links para perfis de fazendas do produtor.
 */
import { useNavigate } from 'react-router-dom';
import { MapPin, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useProfileData } from '@/hooks/useProfile';
import { useMyFazendaProfiles, useFazendaStats } from '@/hooks/useFazendaProfile';
import type { FazendaLinksContent } from '@/lib/types';

interface FazendaLinksSectionProps {
  content: FazendaLinksContent;
  clienteId?: string;
}

function FazendaCard({ fazenda, profile, showStats }: {
  fazenda: { id: string; nome: string; localizacao?: string };
  profile?: { slug?: string };
  showStats: boolean;
}) {
  const navigate = useNavigate();
  const { data: stats } = useFazendaStats(showStats ? fazenda.id : null);
  const slug = profile?.slug;

  return (
    <button
      onClick={() => slug ? navigate(`/fazenda/${slug}`) : undefined}
      disabled={!slug}
      className="rounded-xl border border-border bg-card p-4 text-left hover:border-primary/30 hover:bg-muted/50 transition-all group disabled:opacity-60 disabled:cursor-default"
    >
      <h4 className="text-sm font-bold text-foreground truncate">{fazenda.nome}</h4>
      {fazenda.localizacao && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
          <MapPin className="w-3 h-3 shrink-0" />
          <span className="truncate">{fazenda.localizacao}</span>
        </p>
      )}
      {showStats && stats && (
        <div className="grid grid-cols-2 gap-2 mt-3 text-center">
          <div>
            <p className="text-sm font-bold text-foreground">{stats.total_doadoras}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Doadoras</p>
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">{stats.total_embrioes}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Embrioes</p>
          </div>
        </div>
      )}
      {slug && (
        <div className="flex items-center gap-1 text-xs text-primary mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
          Ver perfil <ArrowRight className="w-3 h-3" />
        </div>
      )}
    </button>
  );
}

export default function FazendaLinksSection({ content, clienteId }: FazendaLinksSectionProps) {
  const { user } = useAuth();
  const { data: profile } = useProfileData(user?.id ?? null);
  const resolvedClienteId = clienteId || profile?.cliente_id;

  const { data: fazendaProfiles = [], isLoading } = useMyFazendaProfiles(resolvedClienteId ?? null);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[1, 2].map(i => (
          <div key={i} className="rounded-xl border border-border bg-muted/30 p-4 h-24 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!fazendaProfiles.length) {
    return <p className="text-sm text-muted-foreground">Nenhuma fazenda cadastrada.</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {fazendaProfiles.map(({ fazenda, profile: fp }) => (
        <FazendaCard
          key={fazenda.id}
          fazenda={fazenda}
          profile={fp}
          showStats={content.show_stats !== false}
        />
      ))}
    </div>
  );
}
