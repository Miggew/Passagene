import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ReceptoraComStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { LoaderDNA } from '@/components/ui/LoaderDNA';
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
import { Plus, Edit, History, ArrowRight, Baby, Filter, X } from 'lucide-react';
import SearchInput from '@/components/shared/SearchInput';
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
            <LoaderDNA size={48} variant="premium" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Barra de Filtros Premium */}
      <div className="rounded-xl border border-border bg-gradient-to-r from-card via-card to-muted/30 p-4">
        <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-center md:justify-between">
          <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end md:gap-6">
            {/* Grupo: Busca */}
            <div className="flex items-end gap-3">
              <div className="w-1 h-6 rounded-full bg-primary/40 self-center hidden md:block" />
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground self-center hidden md:flex">
                <Filter className="w-3.5 h-3.5" />
                <span>Busca</span>
              </div>
              <div className="flex-1 min-w-0 md:min-w-[200px]">
                <SearchInput
                  placeholder="Buscar por brinco ou nome..."
                  value={searchTerm}
                  onChange={setSearchTerm}
                />
              </div>
            </div>

            {/* Separador */}
            <div className="h-10 w-px bg-border hidden md:block" />

            {/* Grupo: Status */}
            <div className="flex items-end gap-3">
              <div className="w-1 h-6 rounded-full bg-emerald-500/40 self-center hidden md:block" />
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground self-center hidden md:flex">
                <span>Status</span>
              </div>
              <div className="w-full md:w-[180px]">
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger className="h-11 md:h-9">
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
                className="h-11 md:h-9 w-full md:w-auto"
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
            <>
              {/* Mobile: Cards */}
              <div className="md:hidden space-y-3">
                {filteredReceptoras.map((receptora) => (
                  <div key={receptora.id} className="rounded-xl border border-border/60 glass-panel shadow-sm p-3.5">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-base font-medium text-foreground">{receptora.identificacao}</span>
                        {receptora.nome && (
                          <span className="text-sm text-muted-foreground ml-2">{receptora.nome}</span>
                        )}
                      </div>
                      <StatusBadge status={receptora.status_calculado || receptora.status_reprodutivo || 'DISPONIVEL'} />
                    </div>
                    {receptora.data_provavel_parto && (
                      <p className="text-xs text-muted-foreground mb-2">
                        Parto previsto: <span className="font-medium text-foreground">{formatDate(receptora.data_provavel_parto)}</span>
                      </p>
                    )}
                    <div className="flex gap-2 pt-2 border-t border-border/50">
                      <Button variant="outline" size="sm" className="flex-1 h-11" onClick={() => handleEdit(receptora)}>
                        <Edit className="w-4 h-4 mr-1.5" />Editar
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 h-11" onClick={() => navigate(`/receptoras/${receptora.id}/historico`)}>
                        <History className="w-4 h-4 mr-1.5" />Histórico
                      </Button>
                      <Button variant="outline" size="sm" className="h-11" onClick={() => openMoverDialog(receptora)}>
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                      {(receptora.status_calculado || '').includes('PRENHE') && (
                        <Button variant="outline" size="sm" className="h-11" onClick={() => handleAbrirNascimento(receptora)}>
                          <Baby className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: Table */}
              <div className="hidden md:block">
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
              </div>
            </>
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
