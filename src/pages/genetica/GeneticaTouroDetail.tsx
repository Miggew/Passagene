/**
 * Página de detalhes do touro no catálogo
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCatalogoData, CatalogoTouro } from '@/hooks/genetica';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/shared/PageHeader';
import GenealogiaTreeSimple from '@/components/shared/GenealogiaTreeSimple';
import {
  Star,
  User,
  Dna,
  MessageCircle,
  ArrowLeft,
  ExternalLink,
  Package,
} from 'lucide-react';
import { CowIcon } from '@/components/icons/CowIcon';

export default function GeneticaTouroDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { loadTouroById } = useCatalogoData();
  const [loading, setLoading] = useState(true);
  const [touro, setTouro] = useState<CatalogoTouro | null>(null);

  useEffect(() => {
    if (id) {
      setLoading(true);
      loadTouroById(id).then((data) => {
        setTouro(data);
        setLoading(false);
      });
    }
  }, [id, loadTouroById]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-xl" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!touro) {
    return (
      <div className="space-y-6">
        <PageHeader title="Touro não encontrado" backTo="/genetica/touros" />
        <div className="rounded-xl border border-border p-12 text-center">
          <p className="text-muted-foreground">Este touro não está mais disponível no catálogo.</p>
          <Button onClick={() => navigate('/genetica/touros')} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao catálogo
          </Button>
        </div>
      </div>
    );
  }

  const foto = touro.foto_principal || touro.foto_url;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={touro.nome}
        description={touro.registro}
        backTo="/genetica/touros"
      >
        <div className="flex items-center gap-2">
          {touro.destaque && (
            <Badge className="bg-amber-500/90 text-white border-0">
              <Star className="w-3 h-3 mr-1 fill-current" />
              Destaque
            </Badge>
          )}
          {touro.doses_disponiveis > 0 && (
            <Badge className="bg-emerald-500/90 text-white border-0">
              <Package className="w-3 h-3 mr-1" />
              {touro.doses_disponiveis} doses disponíveis
            </Badge>
          )}
        </div>
      </PageHeader>

      {/* Conteúdo principal */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Lado esquerdo: Foto */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border overflow-hidden bg-card">
            {foto ? (
              <img
                src={foto}
                alt={touro.nome}
                className="w-full aspect-[4/3] object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full aspect-[4/3] bg-muted flex items-center justify-center">
                <CowIcon className="w-24 h-24 text-muted-foreground/30" />
              </div>
            )}
          </div>

          {/* Galeria de fotos (se houver) */}
          {touro.fotos_galeria && touro.fotos_galeria.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {touro.fotos_galeria.map((fotoUrl, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-border overflow-hidden aspect-square"
                >
                  <img
                    src={fotoUrl}
                    alt={`${touro.nome} - Foto ${index + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lado direito: Informações */}
        <div className="space-y-6">
          {/* Card de informações */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-blue-600 border-blue-500/30">
                <CowIcon className="w-3 h-3 mr-1" />
                Touro
              </Badge>
              {touro.raca && (
                <Badge variant="outline">
                  <Dna className="w-3 h-3 mr-1" />
                  {touro.raca}
                </Badge>
              )}
            </div>

            {/* Proprietário */}
            {touro.proprietario && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="w-4 h-4" />
                <span>Proprietário: {touro.proprietario}</span>
              </div>
            )}

            {/* Descrição */}
            {touro.descricao && (
              <div className="pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {touro.descricao}
                </p>
              </div>
            )}

            {/* Preço */}
            <div className="pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Dose de sêmen a partir de
                  </p>
                  {touro.preco ? (
                    <p className="text-2xl font-bold text-primary">
                      {touro.preco.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </p>
                  ) : (
                    <p className="text-lg text-muted-foreground">Consultar</p>
                  )}
                  {touro.preco_negociavel && (
                    <p className="text-xs text-muted-foreground">Preço negociável</p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Button size="lg" className="bg-primary hover:bg-primary/90">
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Solicitar Orçamento
                  </Button>
                  {touro.touro_id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/touros/${touro.touro_id}`)}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Ver ficha completa
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Genealogia */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-muted/50 to-transparent">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Dna className="w-4 h-4 text-primary" />
                Genealogia
              </h3>
            </div>
            <div className="p-4">
              <GenealogiaTreeSimple
                pai={{ nome: touro.pai_nome, registro: touro.pai_registro }}
                mae={{ nome: touro.mae_nome, registro: touro.mae_registro }}
              />
            </div>
          </div>

          {/* Genealogia texto */}
          {touro.genealogia_texto && (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {touro.genealogia_texto}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
