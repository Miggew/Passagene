/**
 * Seção de anúncios no perfil.
 * Dono: vê todos + botão criar. Visitante: vê apenas ativos.
 */

import { useState } from 'react';
import { Plus, Tag, MoreVertical, Pause, Play, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMeusAnuncios, useAtualizarAnuncio, useRemoverAnuncio } from '@/hooks/useAnuncios';
import { useProfileUrl } from '@/hooks/useStorageUrl';
import CriarAnuncioDialog from './CriarAnuncioDialog';
import type { AnuncioUsuario } from '@/lib/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ProfileAnunciosSectionProps {
  userId: string;
  isOwner: boolean;
}

const statusColors: Record<string, string> = {
  RASCUNHO: 'bg-slate-500/10 text-slate-600',
  ATIVO: 'bg-green-500/10 text-green-600',
  PAUSADO: 'bg-amber-500/10 text-amber-600',
  VENDIDO: 'bg-blue-500/10 text-blue-600',
};

const tipoLabels: Record<string, string> = {
  doadora: 'Doadora',
  touro: 'Touro',
  embriao: 'Embrião',
  dose: 'Dose',
  outro: 'Outro',
};

function AnuncioCard({ anuncio, isOwner }: { anuncio: AnuncioUsuario; isOwner: boolean }) {
  const { data: fotoUrl } = useProfileUrl(anuncio.foto_principal);
  const atualizar = useAtualizarAnuncio();
  const remover = useRemoverAnuncio();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleTogglePause = () => {
    const newStatus = anuncio.status === 'ATIVO' ? 'PAUSADO' : 'ATIVO';
    atualizar.mutate({ id: anuncio.id, status: newStatus }, {
      onSuccess: () => toast.success(newStatus === 'ATIVO' ? 'Anúncio ativado!' : 'Anúncio pausado'),
    });
    setMenuOpen(false);
  };

  const handleRemove = () => {
    if (confirm('Remover este anúncio?')) {
      remover.mutate(anuncio.id);
    }
    setMenuOpen(false);
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden hover:-translate-y-0.5 transition-all duration-200 hover:shadow-md">
      {/* Foto */}
      <div className="aspect-[4/3] bg-muted relative">
        {fotoUrl ? (
          <img src={fotoUrl} alt={anuncio.titulo} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Tag className="w-8 h-8" />
          </div>
        )}

        {/* Status badge */}
        <div className={cn('absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-semibold', statusColors[anuncio.status] || '')}>
          {anuncio.status}
        </div>

        {/* Owner menu */}
        {isOwner && (
          <div className="absolute top-2 right-2">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-7 h-7 rounded-full bg-black/30 text-white flex items-center justify-center hover:bg-black/50"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen && (
              <div className="absolute top-8 right-0 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[140px] z-20">
                <button
                  onClick={handleTogglePause}
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted flex items-center gap-2"
                >
                  {anuncio.status === 'ATIVO' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  {anuncio.status === 'ATIVO' ? 'Pausar' : 'Ativar'}
                </button>
                <button
                  onClick={handleRemove}
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted text-red-500 flex items-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remover
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold text-primary-600 uppercase">{tipoLabels[anuncio.tipo]}</span>
        </div>
        <p className="text-sm font-bold text-foreground line-clamp-2">{anuncio.titulo}</p>
        {anuncio.preco != null && (
          <p className="text-base font-extrabold text-foreground">
            R$ {anuncio.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            {anuncio.preco_negociavel && (
              <span className="text-[10px] font-medium text-muted-foreground ml-1">negociável</span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

export default function ProfileAnunciosSection({ userId, isOwner }: ProfileAnunciosSectionProps) {
  const { data: anuncios = [] } = useMeusAnuncios(isOwner ? userId : null);
  const [criarOpen, setCriarOpen] = useState(false);

  // Visitante: filtra apenas ativos
  const visibleAnuncios = isOwner
    ? anuncios.filter(a => a.status !== 'REMOVIDO')
    : anuncios.filter(a => a.status === 'ATIVO');

  return (
    <div className="px-4 md:px-6 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-foreground">Anúncios</h3>
        {isOwner && (
          <Button variant="outline" size="sm" onClick={() => setCriarOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Novo anúncio
          </Button>
        )}
      </div>

      {visibleAnuncios.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {visibleAnuncios.map(a => (
            <AnuncioCard key={a.id} anuncio={a} isOwner={isOwner} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {isOwner ? 'Você ainda não tem anúncios. Crie o primeiro!' : 'Nenhum anúncio disponível.'}
          </p>
        </div>
      )}

      {isOwner && (
        <CriarAnuncioDialog open={criarOpen} onOpenChange={setCriarOpen} />
      )}
    </div>
  );
}
