/**
 * Componente de Histórico da Receptora
 * Exibe timeline reprodutiva, estatísticas e permite registro de cio livre
 */

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { useReceptoraHistoricoData, useReceptoraHistoricoActions } from '@/hooks/receptoraHistorico';
import {
  ReceptoraInfoCard,
  ReceptoraEstatisticasCard,
  CioLivreCard,
  ReceptoraAdminHistoricoCard,
  ReceptoraTimelineTable,
  CioLivreDialog,
} from '@/components/receptoraHistorico';

interface ReceptoraHistoricoProps {
  receptoraId: string;
  open: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

export default function ReceptoraHistorico({
  receptoraId,
  open,
  onClose,
  onUpdated,
}: ReceptoraHistoricoProps) {
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
      await loadData(receptoraId);
      onUpdated?.();
    },
  });

  // Carregar dados quando abrir
  useEffect(() => {
    if (open && receptoraId) {
      loadData(receptoraId);
    }
  }, [open, receptoraId, loadData]);

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Histórico da Receptora</SheetTitle>
          <SheetDescription>
            {receptora
              ? `Brinco ${receptora.identificacao} ${receptora.nome ? `- ${receptora.nome}` : ''}`
              : 'Carregando...'}
          </SheetDescription>
        </SheetHeader>

        {/* Botão de registrar cio livre */}
        {receptora && !receptora.is_cio_livre && (
          <div className="mt-4 flex justify-end">
            <Button type="button" onClick={() => setShowCioLivreDialog(true)}>
              Registrar Cio Livre
            </Button>
          </div>
        )}

        {loading ? (
          <div className="py-8">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {receptora && (
              <>
                {/* Informações básicas */}
                <ReceptoraInfoCard receptora={receptora} />

                {/* Card de cio livre (se aplicável) */}
                {receptora.is_cio_livre && (
                  <CioLivreCard
                    receptora={receptora}
                    submitting={submitting}
                    onRejeitar={handleRejeitarCioLivre}
                  />
                )}

                {/* Estatísticas */}
                <ReceptoraEstatisticasCard estatisticas={estatisticas} />
              </>
            )}

            {/* Histórico administrativo */}
            <ReceptoraAdminHistoricoCard historicoAdmin={historicoAdmin} />

            {/* Timeline reprodutiva */}
            <ReceptoraTimelineTable historico={historico} />
          </div>
        )}
      </SheetContent>

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
    </Sheet>
  );
}
