import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ReceptoraComStatus } from '@/lib/types';
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
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import { Plus, Edit, Search, History, ArrowRight, Baby, Filter, X } from 'lucide-react';
import { formatStatusLabel } from '@/lib/statusLabels';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { useReceptorasData } from '@/hooks/receptoras/useReceptorasData';
import { useReceptoraForm } from '@/hooks/receptoras/useReceptoraForm';
import { useMoverReceptora } from '@/hooks/receptoras/useMoverReceptora';
import { useNascimento } from '@/hooks/receptoras/useNascimento';

import { MoverReceptoraDialog } from '@/components/receptoras/MoverReceptoraDialog';
import { NascimentoDialog } from '@/components/receptoras/NascimentoDialog';

interface FazendaReceptorasTabProps {
  fazendaId: string;
  fazendaNome: string;
}

export function FazendaReceptorasTab({ fazendaId, fazendaNome }: FazendaReceptorasTabProps) {
  const navigate = useNavigate();

  // Data hook - já filtrado pela fazenda
  const {
    fazendas,
    filteredReceptoras,
    statusDisponiveis,
    loadingReceptoras,
    searchTerm,
    setSearchTerm,
    filtroStatus,
    setFiltroStatus,
    reloadReceptoras,
    removeReceptoraFromList,
  } = useReceptorasData({ selectedFazendaId: fazendaId });

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
    selectedFazendaId: fazendaId,
    onSuccess: reloadReceptoras,
  });

  // Estado para receptora sendo movida
  const [receptoraParaMover, setReceptoraParaMover] = useState<ReceptoraComStatus | null>(null);

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
    selectedFazendaId: fazendaId,
    editingReceptora: receptoraParaMover,
    onSuccess: () => {
      if (receptoraParaMover) {
        removeReceptoraFromList(receptoraParaMover.id);
      }
      setReceptoraParaMover(null);
    },
    onClose: () => {
      setReceptoraParaMover(null);
    },
  });

  const openMoverDialog = (receptora: ReceptoraComStatus) => {
    setReceptoraParaMover(receptora);
    resetMoverState();
    setShowMoverFazendaDialog(true);
  };

  // Nascimento hook
  const {
    showNascimentoDialog,
    setShowNascimentoDialog,
    nascimentoForm,
    setNascimentoForm,
    nascimentoEmbrioes,
    nascimentoLoading,
    submitting: submittingNascimento,
    handleAbrirNascimento,
    handleRegistrarNascimento,
  } = useNascimento({
    selectedFazendaId: fazendaId,
    fazendas,
    onSuccess: reloadReceptoras,
  });

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    try {
      return format(parseISO(dateStr), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return '-';
    }
  };

  if (loadingReceptoras) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Barra de Filtros Premium */}
      <div className="rounded-xl border border-border bg-gradient-to-r from-card via-card to-muted/30 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-end gap-6">
            {/* Grupo: Busca */}
            <div className="flex items-end gap-3">
              <div className="w-1 h-6 rounded-full bg-primary/40 self-center" />
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground self-center">
                <Filter className="w-3.5 h-3.5" />
                <span>Busca</span>
              </div>
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por brinco ou nome..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
            </div>

            {/* Separador */}
            <div className="h-10 w-px bg-border hidden lg:block" />

            {/* Grupo: Status */}
            <div className="flex items-end gap-3">
              <div className="w-1 h-6 rounded-full bg-emerald-500/40 self-center" />
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground self-center">
                <span>Status</span>
              </div>
              <div className="w-[180px]">
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Filtrar status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os status</SelectItem>
                    {statusDisponiveis.map((status) => (
                      <SelectItem key={status} value={status}>
                        {formatStatusLabel(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Botão Limpar */}
            {(searchTerm || filtroStatus !== 'todos') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setFiltroStatus('todos');
                }}
                className="h-9"
              >
                <X className="w-4 h-4 mr-2" />
                Limpar
              </Button>
            )}
          </div>

          {/* Botão Nova Receptora */}
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nova Receptora
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar Receptora</DialogTitle>
              <DialogDescription>
                Adicionar receptora em {fazendaNome}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="identificacao">Brinco/Identificação *</Label>
                <Input
                  id="identificacao"
                  value={formData.identificacao}
                  onChange={(e) => setFormData({ ...formData, identificacao: e.target.value })}
                  placeholder="Ex: 001, A123"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nome">Nome (opcional)</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Nome da receptora"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={submitting}
                >
                  {submitting ? 'Salvando...' : 'Cadastrar'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDialog(false)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>Receptoras ({filteredReceptoras.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredReceptoras.length === 0 ? (
            <EmptyState
              title="Nenhuma receptora encontrada"
              description={searchTerm || filtroStatus !== 'todos'
                ? "Tente ajustar os filtros"
                : "Cadastre a primeira receptora desta fazenda"
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Brinco</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data Provável Parto</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReceptoras.map((receptora) => (
                  <TableRow key={receptora.id}>
                    <TableCell className="font-medium">
                      {receptora.identificacao}
                    </TableCell>
                    <TableCell>{receptora.nome || '-'}</TableCell>
                    <TableCell>
                      <StatusBadge status={receptora.status_calculado || receptora.status_reprodutivo || 'DISPONIVEL'} />
                    </TableCell>
                    <TableCell>
                      {formatDate(receptora.data_provavel_parto)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(receptora)}
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/receptoras/${receptora.id}/historico`)}
                          title="Histórico"
                        >
                          <History className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openMoverDialog(receptora)}
                          title="Mover para outra fazenda"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                        {(receptora.status_calculado || '').includes('PRENHE') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAbrirNascimento(receptora)}
                            title="Registrar nascimento"
                          >
                            <Baby className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog de edição */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Receptora</DialogTitle>
            <DialogDescription>
              Editando {editingReceptora?.identificacao}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-identificacao">Brinco/Identificação *</Label>
              <Input
                id="edit-identificacao"
                value={editFormData.identificacao}
                onChange={(e) => setEditFormData({ ...editFormData, identificacao: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-nome">Nome</Label>
              <Input
                id="edit-nome"
                value={editFormData.nome}
                onChange={(e) => setEditFormData({ ...editFormData, nome: e.target.value })}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                type="submit"
                className="flex-1"
                disabled={submitting}
              >
                {submitting ? 'Salvando...' : 'Salvar'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEditDialog(false)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de mover fazenda */}
      <MoverReceptoraDialog
        open={showMoverFazendaDialog}
        onOpenChange={setShowMoverFazendaDialog}
        receptora={receptoraParaMover}
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
          setReceptoraParaMover(null);
          resetMoverState();
        }}
      />

      {/* Dialog de nascimento */}
      <NascimentoDialog
        open={showNascimentoDialog}
        onOpenChange={setShowNascimentoDialog}
        nascimentoForm={nascimentoForm}
        onFormChange={setNascimentoForm}
        nascimentoEmbrioes={nascimentoEmbrioes}
        nascimentoLoading={nascimentoLoading}
        submitting={submittingNascimento}
        onRegistrar={handleRegistrarNascimento}
        onCancelar={() => setShowNascimentoDialog(false)}
      />
    </div>
  );
}
