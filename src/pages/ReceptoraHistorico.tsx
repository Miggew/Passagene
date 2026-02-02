/**
 * Página de Histórico da Receptora
 * Padrão visual do Hub Campo (DG, TE, Aspiração)
 */

import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus } from 'lucide-react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import StatusBadge from '@/components/shared/StatusBadge';
import CountBadge from '@/components/shared/CountBadge';
import { useReceptoraHistoricoData, useReceptoraHistoricoActions } from '@/hooks/receptoraHistorico';
import {
  CioLivreCard,
  ReceptoraAdminHistoricoCard,
  ReceptoraTimelineTable,
  CioLivreDialog,
} from '@/components/receptoraHistorico';

export default function ReceptoraHistorico() {
  const { id: receptoraId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Hook de dados
  const {
    loading,
    receptora,
    historico,
    historicoAdmin,
    estatisticas,
    loadData,
  } = useReceptoraHistoricoData();

  // Hook de ações
  const {
    submitting,
    showCioLivreDialog,
    setShowCioLivreDialog,
    cioLivreForm,
    setCioLivreForm,
    handleRegistrarCioLivre,
    handleRejeitarCioLivre,
  } = useReceptoraHistoricoActions({
    receptora,
    onSuccess: async () => {
      if (receptoraId) {
        await loadData(receptoraId);
      }
    },
  });

  // Carregar dados
  useEffect(() => {
    if (receptoraId) {
      loadData(receptoraId);
    }
  }, [receptoraId, loadData]);

  // Calcular taxa de sucesso
  const taxaSucesso = estatisticas.totalCiclos > 0
    ? Math.round((estatisticas.totalGestacoes / estatisticas.totalCiclos) * 100)
    : 0;

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!receptora) {
    return (
      <EmptyState
        title="Receptora não encontrada"
        description="Não foi possível carregar os dados da receptora."
        action={
          <Button onClick={() => navigate(-1)} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header compacto */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-xl font-semibold text-foreground">Histórico da Receptora</h1>
        </div>

        {/* Ação: Registrar Cio Livre */}
        {!receptora.is_cio_livre && (
          <Button
            size="sm"
            onClick={() => setShowCioLivreDialog(true)}
            className="bg-primary hover:bg-primary/90"
          >
            <Plus className="w-4 h-4 mr-1" />
            Cio Livre
          </Button>
        )}
      </div>

      {/* Card principal com informações da receptora */}
      <Card>
        <CardContent className="pt-4 pb-4">
          {/* Linha 1: Identificação + Status + Resumo */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-xs font-medium text-muted-foreground">Brinco</span>
                <p className="text-base font-semibold text-foreground">{receptora.identificacao}</p>
              </div>
              {receptora.nome && (
                <>
                  <div className="h-8 w-px bg-border" />
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Nome</span>
                    <p className="text-sm text-foreground">{receptora.nome}</p>
                  </div>
                </>
              )}
              <div className="h-8 w-px bg-border" />
              <div>
                <span className="text-xs font-medium text-muted-foreground">Status</span>
                <div className="mt-0.5">
                  <StatusBadge status={receptora.status_reprodutivo || 'VAZIA'} />
                </div>
              </div>
              {receptora.raca && (
                <>
                  <div className="h-8 w-px bg-border" />
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Raça</span>
                    <p className="text-sm text-foreground">{receptora.raca}</p>
                  </div>
                </>
              )}
            </div>

            {/* Resumo inline - Estatísticas */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Ciclos:</span>
                <CountBadge value={estatisticas.totalCiclos} variant="default" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Gestações:</span>
                <CountBadge value={estatisticas.totalGestacoes} variant="success" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Desde última:</span>
                <CountBadge value={estatisticas.ciclosDesdeUltimaGestacao} variant="warning" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Taxa:</span>
                <CountBadge
                  value={taxaSucesso}
                  suffix="%"
                  variant={taxaSucesso >= 50 ? 'primary' : 'warning'}
                />
              </div>
            </div>
          </div>

          {/* Linha 2: Detalhes adicionais se houver cio livre */}
          {receptora.is_cio_livre && (
            <div className="pt-3 border-t border-border">
              <CioLivreCard
                receptora={receptora}
                submitting={submitting}
                onRejeitar={handleRejeitarCioLivre}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico Administrativo */}
      <ReceptoraAdminHistoricoCard historicoAdmin={historicoAdmin} />

      {/* Timeline Reprodutiva */}
      <ReceptoraTimelineTable historico={historico} />

      {/* Dialog de cio livre */}
      <CioLivreDialog
        open={showCioLivreDialog}
        onOpenChange={setShowCioLivreDialog}
        receptora={receptora}
        cioLivreForm={cioLivreForm}
        setCioLivreForm={setCioLivreForm}
        submitting={submitting}
        onSubmit={handleRegistrarCioLivre}
      />
    </div>
  );
}
