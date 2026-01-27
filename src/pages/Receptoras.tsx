/**
 * Pagina de Receptoras - Gerenciar receptoras por fazenda
 */

import { useEffect, useState } from 'react';
import type { Receptora, ReceptoraComStatus } from '@/lib/types';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import FazendaSelector from '@/components/shared/FazendaSelector';
import ReceptoraHistorico from './ReceptoraHistorico';

// Hooks
import { useReceptorasData } from '@/hooks/receptoras/useReceptorasData';
import { useReceptoraForm } from '@/hooks/receptoras/useReceptoraForm';
import { useMoverReceptora } from '@/hooks/receptoras/useMoverReceptora';
import { useNascimento } from '@/hooks/receptoras/useNascimento';

// Components
import {
  ReceptorasTable,
  ReceptorasFilters,
  ReceptoraFormDialog,
  ReceptoraEditDialog,
  MoverReceptoraDialog,
  NascimentoDialog,
} from '@/components/receptoras';

export default function Receptoras() {
  // Fazenda selection
  const [selectedFazendaId, setSelectedFazendaId] = useState<string>('');
  const [showHistorico, setShowHistorico] = useState(false);
  const [selectedReceptoraId, setSelectedReceptoraId] = useState('');

  // Data hook
  const {
    fazendas,
    filteredReceptoras,
    statusDisponiveis,
    loadingFazendas,
    loadingReceptoras,
    searchTerm,
    setSearchTerm,
    filtroStatus,
    setFiltroStatus,
    loadFazendas,
    loadReceptoras,
    reloadReceptoras,
    removeReceptoraFromList,
  } = useReceptorasData({ selectedFazendaId });

  // Form hook
  const {
    formData,
    setFormData,
    showDialog,
    setShowDialog,
    editFormData,
    setEditFormData,
    editingReceptora,
    showEditDialog,
    setShowEditDialog,
    submitting,
    handleSubmit,
    handleEditSubmit,
    handleEdit,
  } = useReceptoraForm({
    selectedFazendaId,
    onSuccess: reloadReceptoras,
  });

  // Mover hook
  const {
    showMoverFazendaDialog,
    setShowMoverFazendaDialog,
    novaFazendaId,
    setNovaFazendaId,
    novoBrincoProposto,
    temConflitoBrinco,
    temConflitoNome,
    submittingMover,
    fazendasDisponiveis,
    handleMoverFazenda,
    resetMoverState,
  } = useMoverReceptora({
    fazendas,
    selectedFazendaId,
    editingReceptora,
    onSuccess: reloadReceptoras,
    onClose: () => setShowEditDialog(false),
  });

  // Nascimento hook
  const {
    showNascimentoDialog,
    setShowNascimentoDialog,
    nascimentoForm,
    setNascimentoForm,
    nascimentoEmbrioes,
    nascimentoLoading,
    submitting: nascimentoSubmitting,
    handleAbrirNascimento,
    handleRegistrarNascimento,
  } = useNascimento({
    selectedFazendaId,
    fazendas,
    onSuccess: reloadReceptoras,
  });

  // Load fazendas on mount
  useEffect(() => {
    loadFazendas();
  }, [loadFazendas]);

  // Load receptoras when fazenda changes
  useEffect(() => {
    if (selectedFazendaId) {
      loadReceptoras();
    }
  }, [selectedFazendaId, loadReceptoras]);

  // Handle cio livre confirmation
  const handleCioLivreConfirmado = async () => {
    if (selectedReceptoraId) {
      removeReceptoraFromList(selectedReceptoraId);
    }
    await reloadReceptoras();
  };

  // Handle mover fazenda button click
  const handleMoverFazendaClick = () => {
    setShowMoverFazendaDialog(true);
    setNovaFazendaId('');
  };

  if (loadingFazendas) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Receptoras" description="Gerenciar receptoras por fazenda" />

      <div className="space-y-6">
        {/* Fazenda Selection */}
        <FazendaSelector
          fazendas={fazendas}
          selectedFazendaId={selectedFazendaId}
          onFazendaChange={setSelectedFazendaId}
          title="Selecione a Fazenda"
          placeholder="Selecione uma fazenda para listar receptoras"
          required
        />

        {!selectedFazendaId ? (
          <EmptyState
            title="Selecione uma fazenda"
            description="Escolha uma fazenda para listar receptoras e aplicar filtros."
          />
        ) : (
          <>
            {/* Filters */}
            <ReceptorasFilters
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              filtroStatus={filtroStatus}
              onStatusChange={setFiltroStatus}
              statusDisponiveis={statusDisponiveis}
            />

            {/* New Receptora Button */}
            <div className="flex items-center justify-end">
              <ReceptoraFormDialog
                open={showDialog}
                onOpenChange={setShowDialog}
                formData={formData}
                onFormChange={setFormData}
                onSubmit={handleSubmit}
                submitting={submitting}
              />
            </div>

            {/* Receptoras Table */}
            <ReceptorasTable
              receptoras={filteredReceptoras}
              loading={loadingReceptoras}
              searchTerm={searchTerm}
              onEdit={(receptora) => handleEdit(receptora)}
              onHistorico={(id) => {
                setSelectedReceptoraId(id);
                setShowHistorico(true);
              }}
              onNascimento={handleAbrirNascimento}
            />
          </>
        )}

        {/* Nascimento Dialog */}
        <NascimentoDialog
          open={showNascimentoDialog}
          onOpenChange={setShowNascimentoDialog}
          nascimentoForm={nascimentoForm}
          onFormChange={setNascimentoForm}
          nascimentoEmbrioes={nascimentoEmbrioes}
          nascimentoLoading={nascimentoLoading}
          submitting={nascimentoSubmitting}
          onRegistrar={handleRegistrarNascimento}
          onCancelar={() => setShowNascimentoDialog(false)}
        />

        {/* Edit Dialog */}
        <ReceptoraEditDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          formData={editFormData}
          onFormChange={setEditFormData}
          onSubmit={handleEditSubmit}
          submitting={submitting}
          onMoverFazenda={handleMoverFazendaClick}
        />

        {/* Mover Fazenda Dialog */}
        <MoverReceptoraDialog
          open={showMoverFazendaDialog}
          onOpenChange={setShowMoverFazendaDialog}
          receptora={editingReceptora}
          fazendasDisponiveis={fazendasDisponiveis}
          novaFazendaId={novaFazendaId}
          onFazendaChange={setNovaFazendaId}
          temConflitoBrinco={temConflitoBrinco}
          temConflitoNome={temConflitoNome}
          novoBrincoProposto={novoBrincoProposto}
          submitting={submittingMover}
          onConfirmar={handleMoverFazenda}
          onCancelar={() => {
            setShowMoverFazendaDialog(false);
            resetMoverState();
          }}
        />

        {/* Historico Sheet */}
        <ReceptoraHistorico
          receptoraId={selectedReceptoraId}
          open={showHistorico}
          onClose={() => setShowHistorico(false)}
          onUpdated={handleCioLivreConfirmado}
        />
      </div>
    </div>
  );
}
