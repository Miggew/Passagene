/**
 * Página do 2º Passo do Protocolo de Sincronização
 * Revisão e confirmação das receptoras
 */

import { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import { Lock } from 'lucide-react';

// Components
import {
  ProtocoloStepHeader,
  ProtocoloInfoCard,
  ProtocoloStatsCards,
  ProtocoloResumoDialog,
  ConfirmExitDialog,
  Passo2FormCard,
  ReceptorasPasso2Table,
} from '@/components/protocolos';

// Hooks
import {
  useProtocoloPasso2Data,
  useProtocoloPasso2Actions,
} from '@/hooks/protocoloPasso2';

export default function ProtocoloPasso2() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Form state
  const [passo2Form, setPasso2Form] = useState({
    data: new Date().toISOString().split('T')[0],
    tecnico: '',
  });
  const [motivosInapta, setMotivosInapta] = useState<Record<string, string>>({});
  const [showCancelarDialog, setShowCancelarDialog] = useState(false);

  // Data hook
  const {
    loading,
    protocolo,
    setProtocolo,
    fazendaNome,
    receptoras,
    setReceptoras,
    loadData,
  } = useProtocoloPasso2Data();

  // Actions hook
  const {
    submitting,
    showResumo,
    setShowResumo,
    handleStatusChange,
    handleMotivoChange,
    handleFinalizarPasso2,
    handleCloseResumo,
  } = useProtocoloPasso2Actions({
    protocoloId: id || '',
    protocolo,
    receptoras,
    setReceptoras,
    setProtocolo,
    passo2Form,
    motivosInapta,
  });

  // Navigation blocking
  const navigationBlockedRef = useRef(false);

  // Calculate stats
  const stats = useMemo(() => ({
    pendentes: receptoras.filter((r) => r.pr_status === 'INICIADA').length,
    confirmadas: receptoras.filter((r) => r.pr_status === 'APTA').length,
    descartadas: receptoras.filter((r) => r.pr_status === 'INAPTA').length,
  }), [receptoras]);

  const hasPendingChanges = useMemo(() => {
    const camposPreenchidos = passo2Form.data && passo2Form.tecnico.trim();
    return (stats.pendentes > 0 || !camposPreenchidos) && protocolo?.status !== 'SINCRONIZADO';
  }, [stats.pendentes, passo2Form, protocolo]);

  const isFinalized = protocolo?.status === 'SINCRONIZADO';

  // Load data
  useEffect(() => {
    if (id) {
      loadData(id);
    }
  }, [id, loadData]);

  // Update form from protocolo data
  useEffect(() => {
    if (protocolo) {
      if (protocolo.passo2_data || protocolo.passo2_tecnico_responsavel) {
        setPasso2Form({
          data: protocolo.passo2_data || new Date().toISOString().split('T')[0],
          tecnico: protocolo.passo2_tecnico_responsavel || '',
        });
      }

      // Load motivos inapta
      const motivosInaptaLocal: Record<string, string> = {};
      receptoras
        .filter((r) => r.pr_status === 'INAPTA' && r.pr_motivo_inapta)
        .forEach((r) => {
          motivosInaptaLocal[r.id] = r.pr_motivo_inapta || '';
        });
      setMotivosInapta(motivosInaptaLocal);
    }
  }, [protocolo, receptoras]);

  // Navigation blocking
  useEffect(() => {
    if (!hasPendingChanges) {
      navigationBlockedRef.current = false;
      return;
    }

    navigationBlockedRef.current = true;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Você tem receptoras pendentes de revisão. Deseja sair?';
      return e.returnValue;
    };

    const handlePopState = (e: PopStateEvent) => {
      if (hasPendingChanges) {
        e.preventDefault();
        window.history.pushState(null, '', window.location.href);
        setShowCancelarDialog(true);
      }
    };

    window.history.pushState(null, '', window.location.href);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [hasPendingChanges]);

  // Handlers
  const handleVoltarClick = () => {
    if (hasPendingChanges) {
      setShowCancelarDialog(true);
    } else {
      navigationBlockedRef.current = false;
      navigate('/protocolos');
    }
  };

  const handleCancelarPasso2 = () => {
    setShowCancelarDialog(false);
    navigationBlockedRef.current = false;
    navigate('/protocolos');
  };

  const handleLocalStatusChange = (receptoraId: string, status: 'APTA' | 'INAPTA' | 'INICIADA') => {
    handleStatusChange(receptoraId, status);
    if (status === 'APTA' || status === 'INICIADA') {
      setMotivosInapta((prev) => {
        const updated = { ...prev };
        delete updated[receptoraId];
        return updated;
      });
    }
  };

  const handleLocalMotivoChange = (receptoraId: string, motivo: string) => {
    handleMotivoChange(receptoraId, motivo);
    setMotivosInapta((prev) => ({
      ...prev,
      [receptoraId]: motivo.trim(),
    }));
  };

  // Loading state
  if (loading) {
    return <LoadingSpinner />;
  }

  // Not found
  if (!protocolo) {
    return (
      <div className="space-y-6">
        <EmptyState
          title="Protocolo não encontrado"
          description="Volte para a lista e selecione outro protocolo."
          action={
            <Button onClick={() => navigate('/protocolos')} variant="outline">
              Voltar para Protocolos
            </Button>
          }
        />
      </div>
    );
  }

  // No receptoras
  if (receptoras.length === 0 && !loading) {
    return (
      <div className="space-y-6">
        <ProtocoloStepHeader
          currentStep={2}
          title={`2º Passo - ${fazendaNome}`}
          subtitle="Revisar e confirmar receptoras"
          onBack={handleVoltarClick}
          showExit={false}
        />
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700">Protocolo Inconsistente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-red-800">
              Este protocolo não possui receptoras vinculadas.
            </p>
            <Button onClick={() => navigate('/protocolos')} variant="outline">
              Voltar para Protocolos
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canFinalize = stats.pendentes === 0 && passo2Form.data && passo2Form.tecnico.trim();

  return (
    <div className="space-y-6">
      {/* Header */}
      <ProtocoloStepHeader
        currentStep={2}
        title={`2º Passo - ${fazendaNome}`}
        subtitle="Revisar e confirmar receptoras"
        onBack={handleVoltarClick}
        onExit={handleVoltarClick}
        showExit={!isFinalized}
      />

      {/* Passo 2 Form */}
      {!isFinalized && (
        <Passo2FormCard
          data={passo2Form.data}
          tecnico={passo2Form.tecnico}
          onDataChange={(value) => setPasso2Form((prev) => ({ ...prev, data: value }))}
          onTecnicoChange={(value) => setPasso2Form((prev) => ({ ...prev, tecnico: value }))}
        />
      )}

      {/* Protocol Info */}
      <ProtocoloInfoCard
        fazendaNome={fazendaNome}
        dataInicio={protocolo.data_inicio}
        veterinario={protocolo.responsavel_inicio}
        tecnico={protocolo.tecnico_responsavel}
        passo2Data={protocolo.passo2_data || passo2Form.data}
        passo2Tecnico={protocolo.passo2_tecnico_responsavel || passo2Form.tecnico}
        showPasso2={true}
      />

      {/* Stats */}
      <ProtocoloStatsCards
        pendentes={stats.pendentes}
        confirmadas={stats.confirmadas}
        descartadas={stats.descartadas}
      />

      {/* Receptoras Table */}
      <ReceptorasPasso2Table
        receptoras={receptoras}
        motivosInapta={motivosInapta}
        isFinalized={isFinalized}
        onStatusChange={handleLocalStatusChange}
        onMotivoChange={handleLocalMotivoChange}
      />

      {/* Action Button */}
      {!isFinalized && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {!canFinalize && (
              <span>
                {!passo2Form.data || !passo2Form.tecnico.trim()
                  ? 'Preencha a data e o técnico responsável'
                  : `${stats.pendentes} receptora(s) aguardando avaliação`}
              </span>
            )}
          </div>
          <Button
            onClick={handleFinalizarPasso2}
            disabled={!canFinalize || submitting}
            size="lg"
          >
            <Lock className="w-4 h-4 mr-2" />
            {submitting ? 'Finalizando...' : 'Finalizar 2º Passo'}
          </Button>
        </div>
      )}

      {/* Resumo Dialog */}
      <ProtocoloResumoDialog
        open={showResumo}
        onClose={handleCloseResumo}
        step={2}
        fazendaNome={fazendaNome}
        dataInicio={protocolo.data_inicio}
        totalReceptoras={receptoras.length}
        receptorasConfirmadas={stats.confirmadas}
        receptorasDescartadas={stats.descartadas}
      />

      {/* Confirm Exit Dialog */}
      <ConfirmExitDialog
        open={showCancelarDialog}
        onOpenChange={setShowCancelarDialog}
        onConfirm={handleCancelarPasso2}
        title="Cancelar 2º Passo?"
        description="Você tem mudanças pendentes. Ao sair, as alterações não serão salvas."
      />
    </div>
  );
}
