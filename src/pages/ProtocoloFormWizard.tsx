import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import PageHeader from '@/components/shared/PageHeader';
import { ArrowLeft, Plus, UserPlus, Lock, X, Search } from 'lucide-react';
import CiclandoBadge from '@/components/shared/CiclandoBadge';
import QualidadeSemaforo from '@/components/shared/QualidadeSemaforo';
import ClassificacoesCicloInline from '@/components/shared/ClassificacoesCicloInline';
import DatePickerBR from '@/components/shared/DatePickerBR';

// Hooks
import {
  useProtocoloWizardData,
  useProtocoloWizardReceptoras,
  useProtocoloWizardSubmit,
} from '@/hooks/protocolos';

export default function ProtocoloFormWizard() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<'form' | 'receptoras'>('form');

  // Data hook
  const {
    loading,
    loadingReceptoras,
    fazendas,
    allReceptoras,
    receptorasComStatus,
    protocoloData,
    setProtocoloData,
    loadFazendas,
    loadAllReceptoras,
    getSelectedIds,
    getReceptorasFiltradas,
    getFazendaNome,
  } = useProtocoloWizardData();

  // Receptoras hook
  const selectedIds = useMemo(
    () => getSelectedIds(receptorasLocais),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [receptorasLocais]
  );

  const {
    receptorasLocais,
    setReceptorasLocais,
    showAddReceptora,
    setShowAddReceptora,
    showCreateReceptora,
    setShowCreateReceptora,
    buscaReceptora,
    setBuscaReceptora,
    popoverAberto,
    setPopoverAberto,
    addReceptoraForm,
    setAddReceptoraForm,
    createReceptoraForm,
    setCreateReceptoraForm,
    submitting: receptorasSubmitting,
    handleAddReceptora,
    handleCreateReceptora,
    handleRemoveReceptora,
    handleUpdateCiclando,
    handleUpdateQualidade,
    resetAddForm,
    resetCreateForm,
  } = useProtocoloWizardReceptoras({
    fazendaId: protocoloData.fazenda_id,
    allReceptoras,
    receptorasComStatus,
    selectedIds: getSelectedIds([]), // Will be recalculated
    onReceptorasReload: () => loadAllReceptoras(protocoloData.fazenda_id),
  });

  // Submit hook
  const {
    submitting: submitSubmitting,
    showConfirmExit,
    setShowConfirmExit,
    handleFinalizarPasso1,
    handleConfirmExit,
    validateProtocoloForm,
  } = useProtocoloWizardSubmit({
    protocoloData,
    receptorasLocais,
  });

  // Combined submitting state
  const submitting = receptorasSubmitting || submitSubmitting;

  // Recalculate selectedIds with actual data
  const actualSelectedIds = useMemo(
    () => getSelectedIds(receptorasLocais),
    [getSelectedIds, receptorasLocais]
  );

  // Get filtered receptoras for search
  const receptorasFiltradas = useMemo(
    () => getReceptorasFiltradas(buscaReceptora, actualSelectedIds),
    [getReceptorasFiltradas, buscaReceptora, actualSelectedIds]
  );

  // Load fazendas on mount
  useEffect(() => {
    loadFazendas();
  }, [loadFazendas]);

  // Load receptoras when entering step 2
  useEffect(() => {
    if (currentStep === 'receptoras' && protocoloData.fazenda_id) {
      loadAllReceptoras(protocoloData.fazenda_id);
    }
  }, [currentStep, protocoloData.fazenda_id, loadAllReceptoras]);

  // Continue to receptoras step
  const handleContinueToReceptoras = () => {
    if (validateProtocoloForm()) {
      setCurrentStep('receptoras');
    }
  };

  // Navigation handlers
  const handleVoltar = () => {
    if (currentStep === 'form') {
      navigate('/protocolos');
    } else {
      setCurrentStep('form');
    }
  };

  const handleSair = () => {
    if (protocoloData.fazenda_id || receptorasLocais.length > 0) {
      setShowConfirmExit(true);
    } else {
      navigate('/protocolos');
    }
  };

  // Step 1: Form
  if (currentStep === 'form') {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Novo Protocolo"
          description="Primeira visita - Cadastrar novo protocolo de sincronização"
          actions={
            <Button variant="outline" size="icon" onClick={handleSair}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
          }
        />

        <Card>
          <CardHeader>
            <CardTitle>Informações do Protocolo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fazenda_id">Fazenda *</Label>
                <Select
                  value={protocoloData.fazenda_id}
                  onValueChange={(value) =>
                    setProtocoloData({ ...protocoloData, fazenda_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a fazenda" />
                  </SelectTrigger>
                  <SelectContent>
                    {fazendas.map((fazenda) => (
                      <SelectItem key={fazenda.id} value={fazenda.id}>
                        {fazenda.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="data_inicio">Data de Início *</Label>
                <DatePickerBR
                  id="data_inicio"
                  value={protocoloData.data_inicio}
                  onChange={(value) =>
                    setProtocoloData({ ...protocoloData, data_inicio: value || '' })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="veterinario">Veterinário Responsável *</Label>
                <Input
                  id="veterinario"
                  value={protocoloData.veterinario}
                  onChange={(e) =>
                    setProtocoloData({ ...protocoloData, veterinario: e.target.value })
                  }
                  placeholder="Nome do veterinário"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tecnico">Técnico Responsável *</Label>
                <Input
                  id="tecnico"
                  value={protocoloData.tecnico}
                  onChange={(e) =>
                    setProtocoloData({ ...protocoloData, tecnico: e.target.value })
                  }
                  placeholder="Nome do técnico/funcionário"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={protocoloData.observacoes}
                  onChange={(e) =>
                    setProtocoloData({ ...protocoloData, observacoes: e.target.value })
                  }
                  placeholder="Observações sobre o protocolo"
                  rows={3}
                />
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  onClick={handleContinueToReceptoras}
                  className="bg-green-600 hover:bg-green-700"
                  disabled={loading}
                >
                  Continuar para Receptoras
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSair}
                  disabled={loading}
                >
                  Sair
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <ConfirmExitDialog
          open={showConfirmExit}
          onOpenChange={setShowConfirmExit}
          onConfirm={handleConfirmExit}
        />
      </div>
    );
  }

  // Step 2: Receptoras
  return (
    <div className="space-y-6">
      <PageHeader
        title="Adicionar Receptoras"
        description="Selecione as receptoras para este protocolo"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handleVoltar}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" onClick={handleSair}>
              <X className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        }
      />

      {/* Protocol Info Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Informações do Protocolo</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500">Fazenda</p>
            <p className="text-base text-slate-900">
              {getFazendaNome(protocoloData.fazenda_id)}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Data Início</p>
            <p className="text-base text-slate-900">{protocoloData.data_inicio}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Veterinário</p>
            <p className="text-base text-slate-900">{protocoloData.veterinario}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Técnico</p>
            <p className="text-base text-slate-900">{protocoloData.tecnico}</p>
          </div>
        </CardContent>
      </Card>

      {/* Receptoras List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Receptoras do Protocolo ({receptorasLocais.length})</CardTitle>
            <div className="flex gap-2">
              {/* Add Existing Receptora Dialog */}
              <Dialog
                open={showAddReceptora}
                onOpenChange={(open) => {
                  setShowAddReceptora(open);
                  if (!open) resetAddForm();
                }}
              >
                <DialogTrigger asChild>
                  <Button className="bg-green-600 hover:bg-green-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Receptora
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Adicionar Receptora ao Protocolo</DialogTitle>
                    <DialogDescription>
                      Busque por identificação ou nome. Receptoras adequadas aparecerão como
                      disponíveis.
                    </DialogDescription>
                  </DialogHeader>
                  <AddReceptoraForm
                    addReceptoraForm={addReceptoraForm}
                    setAddReceptoraForm={setAddReceptoraForm}
                    buscaReceptora={buscaReceptora}
                    setBuscaReceptora={setBuscaReceptora}
                    popoverAberto={popoverAberto}
                    setPopoverAberto={setPopoverAberto}
                    receptorasFiltradas={receptorasFiltradas}
                    receptorasComStatus={receptorasComStatus}
                    loadingReceptoras={loadingReceptoras}
                    onAdd={handleAddReceptora}
                  />
                </DialogContent>
              </Dialog>

              {/* Create New Receptora Dialog */}
              <Dialog
                open={showCreateReceptora}
                onOpenChange={(open) => {
                  setShowCreateReceptora(open);
                  if (!open) resetCreateForm();
                }}
              >
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Cadastrar Nova
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Cadastrar Nova Receptora</DialogTitle>
                    <DialogDescription>
                      Preencha os dados da nova receptora para cadastrá-la e adicioná-la ao
                      protocolo.
                    </DialogDescription>
                  </DialogHeader>
                  <CreateReceptoraForm
                    createReceptoraForm={createReceptoraForm}
                    setCreateReceptoraForm={setCreateReceptoraForm}
                    submitting={submitting}
                    onCreate={handleCreateReceptora}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {receptorasLocais.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              Nenhuma receptora adicionada. Adicione pelo menos uma antes de finalizar.
            </div>
          ) : (
            <ReceptorasTable
              receptorasLocais={receptorasLocais}
              onRemove={handleRemoveReceptora}
              onUpdateCiclando={handleUpdateCiclando}
              onUpdateQualidade={handleUpdateQualidade}
            />
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Button
          onClick={handleFinalizarPasso1}
          disabled={receptorasLocais.length === 0 || submitting}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Lock className="w-4 h-4 mr-2" />
          {submitting ? 'Finalizando...' : 'Finalizar 1º Passo'}
        </Button>
        <Button variant="outline" onClick={handleVoltar} disabled={submitting}>
          Voltar
        </Button>
      </div>

      <ConfirmExitDialog
        open={showConfirmExit}
        onOpenChange={setShowConfirmExit}
        onConfirm={handleConfirmExit}
      />
    </div>
  );
}

// Sub-components

interface ConfirmExitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

function ConfirmExitDialog({ open, onOpenChange, onConfirm }: ConfirmExitDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sair sem finalizar?</AlertDialogTitle>
          <AlertDialogDescription>
            Se você sair agora, nenhum protocolo será criado. Todos os dados preenchidos serão
            perdidos.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Sim, sair</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface AddReceptoraFormProps {
  addReceptoraForm: {
    receptora_id: string;
    observacoes: string;
    ciclando_classificacao: 'N' | 'CL' | null;
    qualidade_semaforo: 1 | 2 | 3 | null;
  };
  setAddReceptoraForm: React.Dispatch<React.SetStateAction<{
    receptora_id: string;
    observacoes: string;
    ciclando_classificacao: 'N' | 'CL' | null;
    qualidade_semaforo: 1 | 2 | 3 | null;
  }>>;
  buscaReceptora: string;
  setBuscaReceptora: (busca: string) => void;
  popoverAberto: boolean;
  setPopoverAberto: (open: boolean) => void;
  receptorasFiltradas: Array<{
    id: string;
    identificacao: string;
    nome?: string | null;
    status: string;
    motivoIndisponivel?: string;
    disponivel: boolean;
  }>;
  receptorasComStatus: Array<{
    id: string;
    identificacao: string;
    nome?: string | null;
  }>;
  loadingReceptoras: boolean;
  onAdd: () => Promise<void>;
}

function AddReceptoraForm({
  addReceptoraForm,
  setAddReceptoraForm,
  buscaReceptora,
  setBuscaReceptora,
  popoverAberto,
  setPopoverAberto,
  receptorasFiltradas,
  receptorasComStatus,
  loadingReceptoras,
  onAdd,
}: AddReceptoraFormProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Receptora *</Label>
        <Popover open={popoverAberto} onOpenChange={setPopoverAberto}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={popoverAberto}
              className="w-full justify-between"
              onClick={() => setPopoverAberto(!popoverAberto)}
            >
              {addReceptoraForm.receptora_id
                ? (() => {
                    const selecionada = receptorasComStatus.find(
                      (r) => String(r.id).trim() === addReceptoraForm.receptora_id.trim()
                    );
                    return selecionada
                      ? `${selecionada.identificacao}${selecionada.nome ? ` - ${selecionada.nome}` : ''}`
                      : 'Selecione uma receptora';
                  })()
                : 'Buscar receptora...'}
              <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Buscar por identificação ou nome..."
                value={buscaReceptora}
                onValueChange={setBuscaReceptora}
              />
              <CommandList>
                {loadingReceptoras ? (
                  <div className="p-4 text-sm text-center text-slate-500">
                    Carregando receptoras...
                  </div>
                ) : receptorasFiltradas.length === 0 ? (
                  <CommandEmpty>
                    {buscaReceptora.trim()
                      ? 'Nenhuma receptora encontrada'
                      : 'Nenhuma receptora disponível'}
                  </CommandEmpty>
                ) : (
                  <CommandGroup>
                    {receptorasFiltradas.map((r) => {
                      const rId = r.id ? String(r.id).trim() : '';
                      if (!rId) return null;

                      const displayText = `${r.identificacao} ${r.nome || ''}`.trim();

                      return (
                        <CommandItem
                          key={r.id}
                          value={`${displayText} ${rId}`}
                          onSelect={() => {
                            if (r.disponivel) {
                              setAddReceptoraForm({ ...addReceptoraForm, receptora_id: rId });
                              setBuscaReceptora('');
                              setPopoverAberto(false);
                            }
                          }}
                          disabled={!r.disponivel}
                          className={!r.disponivel ? 'opacity-60 cursor-not-allowed' : ''}
                        >
                          <div className="flex flex-col w-full">
                            <div className="flex items-center justify-between gap-2">
                              <span className="flex-1">
                                {r.identificacao}
                                {r.nome ? ` - ${r.nome}` : ''}
                              </span>
                              {r.disponivel ? (
                                <Badge
                                  variant="outline"
                                  className="bg-green-50 text-green-700 border-green-200 shrink-0"
                                >
                                  Disponível
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="bg-red-50 text-red-700 border-red-200 shrink-0"
                                >
                                  Indisponível
                                </Badge>
                              )}
                            </div>
                            {!r.disponivel && (
                              <span className="text-xs text-red-600 mt-1">
                                {r.motivoIndisponivel?.includes('Status atual:')
                                  ? r.motivoIndisponivel.split('Status atual:')[1]?.trim() ||
                                    r.status
                                  : r.status}
                              </span>
                            )}
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      <div className="space-y-2">
        <ClassificacoesCicloInline
          ciclandoValue={addReceptoraForm.ciclando_classificacao}
          qualidadeValue={addReceptoraForm.qualidade_semaforo}
          onChangeCiclando={(value) =>
            setAddReceptoraForm({ ...addReceptoraForm, ciclando_classificacao: value })
          }
          onChangeQualidade={(value) =>
            setAddReceptoraForm({ ...addReceptoraForm, qualidade_semaforo: value })
          }
          size="sm"
        />
      </div>
      <div className="space-y-2">
        <Label>Observações</Label>
        <Textarea
          value={addReceptoraForm.observacoes}
          onChange={(e) =>
            setAddReceptoraForm({ ...addReceptoraForm, observacoes: e.target.value })
          }
          placeholder="Observações sobre a inclusão"
          rows={2}
        />
      </div>
      <Button
        onClick={onAdd}
        className="w-full bg-green-600 hover:bg-green-700"
        disabled={loadingReceptoras || !addReceptoraForm.receptora_id}
      >
        Adicionar
      </Button>
    </div>
  );
}

interface CreateReceptoraFormProps {
  createReceptoraForm: {
    identificacao: string;
    nome: string;
    observacoes: string;
    ciclando_classificacao?: 'N' | 'CL' | null;
    qualidade_semaforo?: 1 | 2 | 3 | null;
  };
  setCreateReceptoraForm: React.Dispatch<React.SetStateAction<{
    identificacao: string;
    nome: string;
    observacoes: string;
    ciclando_classificacao?: 'N' | 'CL' | null;
    qualidade_semaforo?: 1 | 2 | 3 | null;
  }>>;
  submitting: boolean;
  onCreate: () => Promise<void>;
}

function CreateReceptoraForm({
  createReceptoraForm,
  setCreateReceptoraForm,
  submitting,
  onCreate,
}: CreateReceptoraFormProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Identificação (Brinco) *</Label>
        <Input
          value={createReceptoraForm.identificacao}
          onChange={(e) =>
            setCreateReceptoraForm({
              ...createReceptoraForm,
              identificacao: e.target.value,
            })
          }
          placeholder="Número do brinco"
        />
      </div>
      <div className="space-y-2">
        <Label>Nome</Label>
        <Input
          value={createReceptoraForm.nome}
          onChange={(e) =>
            setCreateReceptoraForm({ ...createReceptoraForm, nome: e.target.value })
          }
          placeholder="Nome da receptora (opcional)"
        />
      </div>
      <div className="space-y-2">
        <ClassificacoesCicloInline
          ciclandoValue={createReceptoraForm.ciclando_classificacao || null}
          qualidadeValue={createReceptoraForm.qualidade_semaforo || null}
          onChangeCiclando={(value) =>
            setCreateReceptoraForm({ ...createReceptoraForm, ciclando_classificacao: value })
          }
          onChangeQualidade={(value) =>
            setCreateReceptoraForm({ ...createReceptoraForm, qualidade_semaforo: value })
          }
          size="sm"
        />
      </div>
      <div className="space-y-2">
        <Label>Observações</Label>
        <Textarea
          value={createReceptoraForm.observacoes}
          onChange={(e) =>
            setCreateReceptoraForm({
              ...createReceptoraForm,
              observacoes: e.target.value,
            })
          }
          placeholder="Observações sobre a receptora"
          rows={2}
        />
      </div>
      <Button
        onClick={onCreate}
        className="w-full bg-blue-600 hover:bg-blue-700"
        disabled={submitting}
      >
        <UserPlus className="w-4 h-4 mr-2" />
        {submitting ? 'Criando...' : 'Criar e Adicionar'}
      </Button>
    </div>
  );
}

interface ReceptorasTableProps {
  receptorasLocais: Array<{
    id?: string;
    identificacao: string;
    nome?: string;
    observacoes?: string;
    ciclando_classificacao?: 'N' | 'CL' | null;
    qualidade_semaforo?: 1 | 2 | 3 | null;
  }>;
  onRemove: (index: number) => void;
  onUpdateCiclando: (index: number, value: 'N' | 'CL' | null) => void;
  onUpdateQualidade: (index: number, value: 1 | 2 | 3 | null) => void;
}

function ReceptorasTable({
  receptorasLocais,
  onRemove,
  onUpdateCiclando,
  onUpdateQualidade,
}: ReceptorasTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Brinco</TableHead>
          <TableHead>Nome</TableHead>
          <TableHead>Ciclando</TableHead>
          <TableHead>Qualidade</TableHead>
          <TableHead>Observações</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {receptorasLocais.map((r, index) => {
          const rowKey = r.id && r.id.trim() !== '' ? r.id : `new-${index}`;

          return (
            <TableRow key={rowKey}>
              <TableCell className="font-medium">{r.identificacao}</TableCell>
              <TableCell>{r.nome || '-'}</TableCell>
              <TableCell>
                <CiclandoBadge
                  value={r.ciclando_classificacao}
                  onChange={(value) => onUpdateCiclando(index, value)}
                  variant="editable"
                />
              </TableCell>
              <TableCell>
                <QualidadeSemaforo
                  value={r.qualidade_semaforo}
                  onChange={(value) => onUpdateQualidade(index, value)}
                  variant="row"
                />
              </TableCell>
              <TableCell>{r.observacoes || '-'}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" onClick={() => onRemove(index)}>
                  <X className="w-4 h-4" />
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
