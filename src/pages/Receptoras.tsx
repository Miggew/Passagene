import { useEffect, useState } from 'react';
import type { Receptora, ReceptoraComStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import StatusBadge from '@/components/shared/StatusBadge';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { Plus, Edit, Search, History, ArrowRight, Baby } from 'lucide-react';
import ReceptoraHistorico from './ReceptoraHistorico';
import { formatStatusLabel } from '@/lib/statusLabels';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Hooks
import { useReceptorasData } from '@/hooks/receptoras/useReceptorasData';
import { useReceptoraForm } from '@/hooks/receptoras/useReceptoraForm';
import { useMoverReceptora } from '@/hooks/receptoras/useMoverReceptora';
import { useNascimento } from '@/hooks/receptoras/useNascimento';

// Components
import { MoverReceptoraDialog } from '@/components/receptoras/MoverReceptoraDialog';
import { NascimentoDialog } from '@/components/receptoras/NascimentoDialog';

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

  // Format date
  const formatarDataBR = (iso?: string | null) => {
    if (!iso) return '';
    try {
      const d = parseISO(iso);
      if (Number.isNaN(d.getTime())) return '';
      return format(d, 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return '';
    }
  };

  // Check if birth button should show
  const shouldShowBirthButton = (receptora: ReceptoraComStatus) => {
    if (!receptora.status_calculado.includes('PRENHE') || !receptora.data_provavel_parto) {
      return false;
    }
    const partoDate = new Date(receptora.data_provavel_parto);
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + 20);
    return partoDate <= threshold;
  };

  if (loadingFazendas) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Receptoras" description="Gerenciar receptoras por fazenda" />

      <div className="space-y-6">
        {/* Fazenda Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Selecione a Fazenda *</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedFazendaId} onValueChange={setSelectedFazendaId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione uma fazenda para listar receptoras" />
              </SelectTrigger>
              <SelectContent>
                {fazendas.map((fazenda) => (
                  <SelectItem key={fazenda.id} value={fazenda.id}>
                    {fazenda.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {!selectedFazendaId ? (
          <EmptyState
            title="Selecione uma fazenda"
            description="Escolha uma fazenda para listar receptoras e aplicar filtros."
          />
        ) : (
          <>
            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle>Filtros</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 max-w-md">
                    <Label htmlFor="filtro-status">Status</Label>
                    <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                      <SelectTrigger id="filtro-status">
                        <SelectValue placeholder="Todas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {statusDisponiveis.map((status) => (
                          <SelectItem key={status} value={status}>
                            {formatStatusLabel(status)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 max-w-md">
                    <Label htmlFor="busca">Buscar por brinco ou nome</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <Input
                        id="busca"
                        placeholder="Buscar por brinco ou nome..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* New Receptora Button */}
            <div className="flex items-center justify-end">
              <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-green-600 hover:bg-green-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Receptora
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Criar Nova Receptora</DialogTitle>
                    <DialogDescription>
                      Criar receptora na fazenda selecionada
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="identificacao">Identificação (Brinco) *</Label>
                      <Input
                        id="identificacao"
                        value={formData.identificacao}
                        onChange={(e) => setFormData({ ...formData, identificacao: e.target.value })}
                        placeholder="Número do brinco"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nome">Nome</Label>
                      <Input
                        id="nome"
                        value={formData.nome}
                        onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                        placeholder="Nome da receptora (opcional)"
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        type="submit"
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        disabled={submitting}
                      >
                        {submitting ? 'Salvando...' : 'Salvar'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowDialog(false)}
                        disabled={submitting}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {/* Receptoras Table */}
            <Card>
              <CardHeader>
                <CardTitle>Lista de Receptoras ({filteredReceptoras.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingReceptoras ? (
                  <div className="py-8">
                    <LoadingSpinner />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Brinco</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Status Atual</TableHead>
                        <TableHead>Data de parto</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredReceptoras.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-slate-500">
                            {searchTerm ? 'Nenhuma receptora encontrada' : 'Nenhuma receptora cadastrada nesta fazenda'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredReceptoras.map((receptora) => (
                          <TableRow key={receptora.id}>
                            <TableCell className="font-medium">{receptora.identificacao}</TableCell>
                            <TableCell>{receptora.nome || '-'}</TableCell>
                            <TableCell>
                              <StatusBadge status={receptora.status_calculado} count={receptora.numero_gestacoes} />
                            </TableCell>
                            <TableCell>
                              {receptora.status_calculado.includes('PRENHE') && receptora.data_provavel_parto
                                ? formatarDataBR(receptora.data_provavel_parto)
                                : '—'}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-1 justify-end">
                                {shouldShowBirthButton(receptora) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleAbrirNascimento(receptora)}
                                    title="Registrar nascimento"
                                  >
                                    <Baby className="w-4 h-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(receptora as Receptora)}
                                  title="Editar"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedReceptoraId(receptora.id);
                                    setShowHistorico(true);
                                  }}
                                  title="Ver histórico"
                                >
                                  <History className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
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
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Editar Receptora</DialogTitle>
              <DialogDescription>
                Atualizar dados da receptora
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit_identificacao">Identificação (Brinco) *</Label>
                <Input
                  id="edit_identificacao"
                  value={editFormData.identificacao}
                  onChange={(e) => setEditFormData({ ...editFormData, identificacao: e.target.value })}
                  placeholder="Número do brinco"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_nome">Nome</Label>
                <Input
                  id="edit_nome"
                  value={editFormData.nome}
                  onChange={(e) => setEditFormData({ ...editFormData, nome: e.target.value })}
                  placeholder="Nome da receptora (opcional)"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  type="submit"
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={submitting}
                >
                  {submitting ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowEditDialog(false)}
                  disabled={submitting}
                >
                  Cancelar
                </Button>
              </div>
            </form>

            {/* Move to another fazenda */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-500">Ou</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => {
                setShowMoverFazendaDialog(true);
                setNovaFazendaId('');
              }}
              disabled={submitting}
            >
              <ArrowRight className="w-4 h-4 mr-2" />
              Mover para outra fazenda
            </Button>
          </DialogContent>
        </Dialog>

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
