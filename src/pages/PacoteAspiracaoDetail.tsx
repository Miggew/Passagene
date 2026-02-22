import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import CountBadge from '@/components/shared/CountBadge';
import { useToast } from '@/hooks/use-toast';
import { formatDateBR as formatDate } from '@/lib/dateUtils';
import { DataTable } from '@/components/shared/DataTable';
import { ArrowLeft, Plus, Lock, Edit } from 'lucide-react';

import { OocitosCountingForm } from '@/components/aspiracoes/OocitosCountingForm';
import {
  usePacoteAspiracaoData,
  useAddDoadoraForm,
  useCreateDoadoraForm,
  useEditAspiracaoForm,
} from '@/hooks/aspiracoes';
import type { AddDoadoraFormData } from '@/hooks/aspiracoes/useAddDoadoraForm';
import type { EditAspiracaoFormData } from '@/hooks/aspiracoes/useEditAspiracaoForm';

export default function PacoteAspiracaoDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Dialog states
  const [showAddDoadora, setShowAddDoadora] = useState(false);
  const [showFinalizarDialog, setShowFinalizarDialog] = useState(false);
  const [showEditPacote, setShowEditPacote] = useState(false);
  const [editPacoteForm, setEditPacoteForm] = useState({
    veterinario_responsavel: '',
    tecnico_responsavel: '',
  });
  const [submittingPacote, setSubmittingPacote] = useState(false);

  // Data hook
  const {
    loading,
    pacote,
    fazendaNome,
    fazendasDestinoNomes,
    aspiracoes,
    doadorasDisponiveis,
    totalOocitos,
    horarioFim,
    isFinalizado,
    loadData,
    reloadDoadorasDisponiveis,
    updatePacoteTotal,
  } = usePacoteAspiracaoData({ pacoteId: id });

  // Add doadora hook
  const addDoadoraHook = useAddDoadoraForm({
    pacoteId: id,
    pacote,
    aspiracoes,
    totalOocitos,
    onSuccess: () => {
      setShowAddDoadora(false);
      loadData();
    },
    updatePacoteTotal,
  });

  // Create doadora hook
  const createDoadoraHook = useCreateDoadoraForm({
    pacoteId: id,
    pacote,
    addDoadoraForm: addDoadoraHook.formData,
    totalOocitos,
    onSuccess: () => {
      setShowAddDoadora(false);
      addDoadoraHook.resetForm();
      loadData();
    },
    updatePacoteTotal,
    setPendingAction: addDoadoraHook.setPendingAction,
    setShowConfirmZeroOocitos: addDoadoraHook.setShowConfirmZeroOocitos,
  });

  // Edit aspiration hook
  const editAspiracaoHook = useEditAspiracaoForm({
    totalOocitos,
    onSuccess: loadData,
    updatePacoteTotal,
  });

  // Load data on mount
  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id, loadData]);

  // Initialize form when dialog opens
  useEffect(() => {
    if (showAddDoadora && pacote) {
      reloadDoadorasDisponiveis();
      addDoadoraHook.initializeHorario();
    }
  }, [showAddDoadora]);

  // Update edit pacote form when pacote changes
  useEffect(() => {
    if (pacote) {
      setEditPacoteForm({
        veterinario_responsavel: pacote.veterinario_responsavel || '',
        tecnico_responsavel: pacote.tecnico_responsavel || '',
      });
    }
  }, [pacote]);

  const handleSaveEditPacote = async () => {
    if (!editPacoteForm.veterinario_responsavel.trim()) {
      toast({
        title: 'Erro de validação',
        description: 'Veterinário responsável é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    if (!editPacoteForm.tecnico_responsavel.trim()) {
      toast({
        title: 'Erro de validação',
        description: 'Técnico responsável é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmittingPacote(true);

      const { error } = await supabase
        .from('pacotes_aspiracao')
        .update({
          veterinario_responsavel: editPacoteForm.veterinario_responsavel.trim(),
          tecnico_responsavel: editPacoteForm.tecnico_responsavel.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Aspiração atualizada',
        description: 'Informações da aspiração atualizadas com sucesso',
      });

      setShowEditPacote(false);
      loadData();
    } catch (error) {
      toast({
        title: 'Erro ao atualizar aspiração',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmittingPacote(false);
    }
  };

  const handleFinalizar = async () => {
    try {
      setSubmittingPacote(true);

      const { error } = await supabase
        .from('pacotes_aspiracao')
        .update({ status: 'FINALIZADO', updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Aspiração finalizada',
        description: 'Aspiração finalizada com sucesso',
      });

      setShowFinalizarDialog(false);
      navigate('/aspiracoes');
    } catch (error) {
      toast({
        title: 'Erro ao finalizar aspiração',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmittingPacote(false);
    }
  };

  const handleConfirmZeroOocitos = async () => {
    addDoadoraHook.setShowConfirmZeroOocitos(false);
    if (addDoadoraHook.pendingAction === 'add') {
      await addDoadoraHook.executeAddDoadora();
    } else if (addDoadoraHook.pendingAction === 'create') {
      await createDoadoraHook.executeCreateDoadora();
    }
    addDoadoraHook.setPendingAction(null);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!pacote) {
    return (
      <EmptyState
        title="Aspiração não encontrada"
        description="Volte para a lista e selecione outra aspiração."
        action={
          <Button onClick={() => navigate('/aspiracoes')} variant="outline">
            Voltar para Aspirações
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header compacto */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-xl font-semibold text-foreground">Relatório da Aspiração</h1>
        </div>
        {!isFinalizado && (
          <Button
            className="h-11 md:h-9 w-full md:w-auto"
            onClick={() => setShowFinalizarDialog(true)}
            disabled={submittingPacote || aspiracoes.length === 0}
          >
            <Lock className="w-4 h-4 mr-2" />
            {submittingPacote ? 'Finalizando...' : 'Finalizar Pacote'}
          </Button>
        )}
      </div>

      {/* Informações da Aspiração - Compacto */}
      <Card>
        <CardContent className="pt-4 pb-4">
          {/* Mobile layout */}
          <div className="md:hidden space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-muted-foreground">Fazenda</span>
                <p className="text-base font-semibold text-foreground">{fazendaNome}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={isFinalizado ? 'default' : 'outline'}
                  className={isFinalizado
                    ? 'bg-primary hover:bg-primary-dark'
                    : 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400'}
                >
                  {isFinalizado ? 'Finalizado' : 'Em Andamento'}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div>
                <span className="text-xs font-medium text-muted-foreground">Data</span>
                <p className="text-sm text-foreground">{formatDate(pacote.data_aspiracao)}</p>
              </div>
              {!isFinalizado && (
                <Button variant="outline" size="sm" className="h-9" onClick={() => setShowEditPacote(true)}>
                  <Edit className="w-3.5 h-3.5 mr-1" />
                  Editar
                </Button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-border">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Doadoras:</span>
                <CountBadge value={aspiracoes.length} variant="default" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Oocitos:</span>
                <CountBadge value={totalOocitos} variant="primary" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Media:</span>
                <CountBadge value={aspiracoes.length > 0 ? Math.round(totalOocitos / aspiracoes.length) : 0} variant="info" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
              <div className="space-y-1">
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Inicio</h4>
                <p className="text-xs text-foreground">{pacote.horario_inicio || '—'}</p>
              </div>
              <div className="space-y-1">
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Fim</h4>
                <p className="text-xs text-foreground">{horarioFim || '—'}</p>
              </div>
              <div className="space-y-1">
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Veterinario</h4>
                <p className="text-xs text-foreground">{pacote.veterinario_responsavel || '—'}</p>
              </div>
              <div className="space-y-1">
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Tecnico</h4>
                <p className="text-xs text-foreground">{pacote.tecnico_responsavel || '—'}</p>
              </div>
              <div className="space-y-1 col-span-2">
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Fazendas Destino</h4>
                <div className="flex flex-wrap gap-1">
                  {fazendasDestinoNomes.length > 0 ? (
                    fazendasDestinoNomes.map((nome, idx) => (
                      <Badge key={idx} variant="outline" className="text-[10px] px-1.5 py-0">
                        {nome}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Desktop layout */}
          <div className="hidden md:block">
            {/* Linha 1: Fazenda + Status + Resumo */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Fazenda</span>
                  <p className="text-base font-semibold text-foreground">{fazendaNome}</p>
                </div>
                <div className="h-8 w-px bg-border" />
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Data</span>
                  <p className="text-sm text-foreground">{formatDate(pacote.data_aspiracao)}</p>
                </div>
                <div className="h-8 w-px bg-border" />
                <div>
                  <Badge
                    variant={isFinalizado ? 'default' : 'outline'}
                    className={isFinalizado
                      ? 'bg-primary hover:bg-primary-dark'
                      : 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400'}
                  >
                    {isFinalizado ? 'Finalizado' : 'Em Andamento'}
                  </Badge>
                </div>
                {!isFinalizado && (
                  <Button variant="outline" size="sm" className="h-7" onClick={() => setShowEditPacote(true)}>
                    <Edit className="w-3.5 h-3.5 mr-1" />
                    Editar
                  </Button>
                )}
              </div>

              {/* Resumo inline */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Doadoras:</span>
                  <CountBadge value={aspiracoes.length} variant="default" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Oócitos:</span>
                  <CountBadge value={totalOocitos} variant="primary" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Média:</span>
                  <CountBadge value={aspiracoes.length > 0 ? Math.round(totalOocitos / aspiracoes.length) : 0} variant="info" />
                </div>
              </div>
            </div>

            {/* Linha 2: Grid com detalhes */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 pt-3 border-t border-border">
              <div className="space-y-1">
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Início</h4>
                <p className="text-xs text-foreground">{pacote.horario_inicio || '—'}</p>
              </div>
              <div className="space-y-1">
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Fim</h4>
                <p className="text-xs text-foreground">{horarioFim || '—'}</p>
              </div>
              <div className="space-y-1">
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Veterinário</h4>
                <p className="text-xs text-foreground">{pacote.veterinario_responsavel || '—'}</p>
              </div>
              <div className="space-y-1">
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Técnico</h4>
                <p className="text-xs text-foreground">{pacote.tecnico_responsavel || '—'}</p>
              </div>
              <div className="space-y-1 lg:col-span-2">
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Fazendas Destino</h4>
                <div className="flex flex-wrap gap-1">
                  {fazendasDestinoNomes.length > 0 ? (
                    fazendasDestinoNomes.map((nome, index) => (
                      <Badge key={index} variant="outline" className="text-[10px] px-1.5 py-0">
                        {nome}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Doadoras */}
      <Card>
        <CardHeader className="pb-2 pt-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-base">Doadoras Aspiradas ({aspiracoes.length})</CardTitle>
            {!isFinalizado && (
              <Dialog
                open={showAddDoadora}
                onOpenChange={(open) => {
                  setShowAddDoadora(open);
                  if (!open) {
                    addDoadoraHook.resetForm();
                    createDoadoraHook.resetForm();
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button size="sm" className="h-11 md:h-9 w-full md:w-auto">
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Doadora
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Adicionar Doadora à Aspiração</DialogTitle>
                    <DialogDescription>
                      Selecione uma doadora existente ou cadastre uma nova
                    </DialogDescription>
                  </DialogHeader>
                  <Tabs defaultValue="existing" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="existing">Doadora Existente</TabsTrigger>
                      <TabsTrigger value="new">Cadastrar Nova</TabsTrigger>
                    </TabsList>

                    {/* Tab: Doadora Existente */}
                    <TabsContent value="existing" className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label>Doadora *</Label>
                        <Select
                          value={addDoadoraHook.formData.doadora_id}
                          onValueChange={(value) => addDoadoraHook.updateField('doadora_id', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma doadora" />
                          </SelectTrigger>
                          <SelectContent>
                            {doadorasDisponiveis.length === 0 ? (
                              <div className="p-2 text-sm text-muted-foreground">
                                Nenhuma doadora disponível nesta fazenda
                              </div>
                            ) : (
                              doadorasDisponiveis.map((d) => (
                                <SelectItem key={d.id} value={d.id}>
                                  {d.registro} {d.nome ? `- ${d.nome}` : ''}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Horário de Aspiração</Label>
                          <Input
                            type="time"
                            value={addDoadoraHook.formData.horario_aspiracao}
                            onChange={(e) => addDoadoraHook.updateField('horario_aspiracao', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Hora Final *</Label>
                          <Input
                            type="time"
                            value={addDoadoraHook.formData.hora_final}
                            onChange={(e) => addDoadoraHook.updateField('hora_final', e.target.value)}
                            required
                          />
                        </div>
                      </div>

                      <OocitosCountingForm
                        data={addDoadoraHook.formData}
                        onChange={(field, value) => addDoadoraHook.updateField(field as keyof AddDoadoraFormData, value)}
                      />

                      <div className="space-y-2">
                        <Label>Recomendação de Touro</Label>
                        <Input
                          value={addDoadoraHook.formData.recomendacao_touro}
                          onChange={(e) => addDoadoraHook.updateField('recomendacao_touro', e.target.value)}
                          placeholder="Recomendação de touro para esta doadora"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Observações</Label>
                        <Textarea
                          value={addDoadoraHook.formData.observacoes}
                          onChange={(e) => addDoadoraHook.updateField('observacoes', e.target.value)}
                          placeholder="Observações sobre esta aspiração"
                          rows={2}
                        />
                      </div>

                      <Button
                        onClick={addDoadoraHook.handleAddDoadora}
                        className="w-full"
                        disabled={addDoadoraHook.submitting || doadorasDisponiveis.length === 0}
                      >
                        {addDoadoraHook.submitting ? 'Adicionando...' : 'Adicionar'}
                      </Button>
                    </TabsContent>

                    {/* Tab: Cadastrar Nova */}
                    <TabsContent value="new" className="space-y-4 mt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Registro *</Label>
                          <Input
                            value={createDoadoraHook.formData.registro}
                            onChange={(e) =>
                              createDoadoraHook.setFormData({ ...createDoadoraHook.formData, registro: e.target.value })
                            }
                            placeholder="Registro da doadora"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Raça *</Label>
                          <Select
                            value={createDoadoraHook.racaSelecionada}
                            onValueChange={createDoadoraHook.handleRacaChange}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a raça" />
                            </SelectTrigger>
                            <SelectContent>
                              {createDoadoraHook.racasPredefinidas.map((raca) => (
                                <SelectItem key={raca} value={raca}>
                                  {raca}
                                </SelectItem>
                              ))}
                              <SelectItem value="Outra">Outra</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {createDoadoraHook.racaSelecionada === 'Outra' && (
                          <div className="space-y-2">
                            <Label>Raça Customizada *</Label>
                            <Input
                              value={createDoadoraHook.formData.racaCustom}
                              onChange={(e) =>
                                createDoadoraHook.setFormData({ ...createDoadoraHook.formData, racaCustom: e.target.value })
                              }
                              placeholder="Digite a raça"
                            />
                          </div>
                        )}
                      </div>

                      <OocitosCountingForm
                        data={addDoadoraHook.formData}
                        onChange={(field, value) => addDoadoraHook.updateField(field as keyof AddDoadoraFormData, value)}
                      />

                      <div className="space-y-2">
                        <Label>Recomendação de Touro</Label>
                        <Input
                          value={addDoadoraHook.formData.recomendacao_touro}
                          onChange={(e) => addDoadoraHook.updateField('recomendacao_touro', e.target.value)}
                          placeholder="Recomendação de touro para esta doadora"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Horário de Aspiração</Label>
                          <Input
                            type="time"
                            value={addDoadoraHook.formData.horario_aspiracao}
                            onChange={(e) => addDoadoraHook.updateField('horario_aspiracao', e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Hora Final *</Label>
                          <Input
                            type="time"
                            value={addDoadoraHook.formData.hora_final}
                            onChange={(e) => addDoadoraHook.updateField('hora_final', e.target.value)}
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Observações</Label>
                        <Textarea
                          value={addDoadoraHook.formData.observacoes}
                          onChange={(e) => addDoadoraHook.updateField('observacoes', e.target.value)}
                          placeholder="Observações sobre esta aspiração"
                          rows={2}
                        />
                      </div>

                      <Button
                        onClick={createDoadoraHook.handleCreateDoadora}
                        className="w-full"
                        disabled={createDoadoraHook.submitting}
                      >
                        {createDoadoraHook.submitting ? 'Criando...' : 'Criar e Adicionar'}
                      </Button>
                    </TabsContent>
                  </Tabs>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0 pb-2">
          {aspiracoes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma doadora adicionada à aspiração
            </div>
          ) : (
            <>
              {/* Mobile card layout */}
              <div className="md:hidden space-y-2">
                {aspiracoes.map((row, index) => (
                  <div key={row.id} className="rounded-xl border border-border/60 bg-card shadow-sm p-3.5">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-muted-foreground shrink-0">{index + 1}.</span>
                        <div className="min-w-0">
                          <p className="text-base font-medium text-foreground truncate">{row.doadora_nome || '—'}</p>
                          {row.doadora_registro && (
                            <p className="text-xs text-muted-foreground truncate">{row.doadora_registro}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">Viav.</span>
                          <CountBadge value={row.viaveis || 0} variant="primary" />
                        </div>
                        {!isFinalizado && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-11 w-11 p-0"
                            onClick={() => editAspiracaoHook.openEdit(row)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Total: <span className="text-foreground font-medium">{row.total_oocitos || 0}</span></span>
                      {row.horario_aspiracao && (
                        <span>
                          {row.horario_aspiracao}{row.hora_final ? `-${row.hora_final}` : ''}
                        </span>
                      )}
                    </div>
                    {(row.recomendacao_touro || row.observacoes) && (
                      <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
                        {row.recomendacao_touro && (
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">Rec. Touro:</span> {row.recomendacao_touro}
                          </p>
                        )}
                        {row.observacoes && (
                          <p className="text-xs text-muted-foreground">{row.observacoes}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop table layout */}
              <div className="hidden md:block">
                <DataTable
                  data={aspiracoes}
                  rowKey="id"
                  rowNumber
                  emptyMessage="Nenhuma doadora adicionada à aspiração"
                  columns={[
                    { key: 'doadora_nome', label: 'Doadora' },
                    { key: 'doadora_registro', label: 'Registro' },
                    { key: 'horario', label: 'Horário' },
                    { key: 'viaveis', label: 'Viáv.', align: 'center' },
                    { key: 'total_oocitos', label: 'Total', align: 'center' },
                    { key: 'recomendacao_touro', label: 'Rec. Touro' },
                    { key: 'observacoes', label: 'Obs.' },
                  ]}
                  renderCell={(row, column) => {
                    switch (column.key) {
                      case 'doadora_nome':
                        return <span className="font-medium text-foreground">{row.doadora_nome || '—'}</span>;
                      case 'doadora_registro':
                        return <span className="text-xs text-muted-foreground">{row.doadora_registro || '—'}</span>;
                      case 'horario':
                        return (
                          <span className="text-xs text-foreground whitespace-nowrap">
                            {row.horario_aspiracao
                              ? `${row.horario_aspiracao}${row.hora_final ? `-${row.hora_final}` : ''}`
                              : '—'}
                          </span>
                        );
                      case 'viaveis':
                        return <CountBadge value={row.viaveis || 0} variant="primary" />;
                      case 'total_oocitos':
                        return <CountBadge value={row.total_oocitos || 0} variant="default" />;
                      case 'recomendacao_touro':
                        return <span className="text-xs text-muted-foreground truncate">{row.recomendacao_touro || '—'}</span>;
                      case 'observacoes':
                        return <span className="text-xs text-muted-foreground truncate">{row.observacoes || '—'}</span>;
                      default:
                        return null;
                    }
                  }}
                  actions={!isFinalizado ? (row) => (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => editAspiracaoHook.openEdit(row)}
                      aria-label="Editar"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  ) : undefined}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Edição de Aspiração */}
      <Dialog open={editAspiracaoHook.showDialog} onOpenChange={editAspiracaoHook.closeEdit}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Editar Aspiração - {editAspiracaoHook.aspiracaoEditando?.doadora_nome || editAspiracaoHook.aspiracaoEditando?.doadora_registro || 'Doadora'}
            </DialogTitle>
            <DialogDescription>Edite os dados da aspiração da doadora</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Horário de Aspiração</Label>
                <Input
                  type="time"
                  value={editAspiracaoHook.formData.horario_aspiracao}
                  onChange={(e) => editAspiracaoHook.updateField('horario_aspiracao', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Hora Final *</Label>
                <Input
                  type="time"
                  value={editAspiracaoHook.formData.hora_final}
                  onChange={(e) => editAspiracaoHook.updateField('hora_final', e.target.value)}
                  required
                />
              </div>
            </div>

            <OocitosCountingForm
              data={editAspiracaoHook.formData}
              onChange={(field, value) => editAspiracaoHook.updateField(field as keyof EditAspiracaoFormData, value)}
            />

            <div className="space-y-2">
              <Label>Recomendação de Touro</Label>
              <Input
                value={editAspiracaoHook.formData.recomendacao_touro}
                onChange={(e) => editAspiracaoHook.updateField('recomendacao_touro', e.target.value)}
                placeholder="Recomendação de touro para esta doadora"
              />
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={editAspiracaoHook.formData.observacoes}
                onChange={(e) => editAspiracaoHook.updateField('observacoes', e.target.value)}
                placeholder="Observações sobre esta aspiração"
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={editAspiracaoHook.closeEdit} disabled={editAspiracaoHook.submitting}>
                Cancelar
              </Button>
              <Button
                onClick={editAspiracaoHook.handleSave}
                disabled={editAspiracaoHook.submitting}
              >
                {editAspiracaoHook.submitting ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação para Zero Oócitos */}
      <AlertDialog open={addDoadoraHook.showConfirmZeroOocitos} onOpenChange={addDoadoraHook.setShowConfirmZeroOocitos}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Adição de Doadora sem Oócitos</AlertDialogTitle>
            <AlertDialogDescription>
              Esta doadora não possui nenhum oócito (total = 0). Deseja realmente adicioná-la à aspiração?
              <br /><br />
              <strong>Atenção:</strong> Doadoras sem oócitos podem não ser úteis para o processo de FIV.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={addDoadoraHook.submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmZeroOocitos}
              disabled={addDoadoraHook.submitting}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {addDoadoraHook.submitting ? 'Adicionando...' : 'Sim, Adicionar Mesmo Assim'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Edição do Pacote */}
      <Dialog open={showEditPacote} onOpenChange={setShowEditPacote}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Aspiração</DialogTitle>
            <DialogDescription>Atualize as informações da aspiração</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Veterinário Responsável *</Label>
              <Input
                value={editPacoteForm.veterinario_responsavel}
                onChange={(e) => setEditPacoteForm({ ...editPacoteForm, veterinario_responsavel: e.target.value })}
                placeholder="Nome do veterinário"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Técnico Responsável *</Label>
              <Input
                value={editPacoteForm.tecnico_responsavel}
                onChange={(e) => setEditPacoteForm({ ...editPacoteForm, tecnico_responsavel: e.target.value })}
                placeholder="Nome do técnico"
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowEditPacote(false)} disabled={submittingPacote}>
                Cancelar
              </Button>
              <Button onClick={handleSaveEditPacote} disabled={submittingPacote}>
                {submittingPacote ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Finalização */}
      <AlertDialog open={showFinalizarDialog} onOpenChange={setShowFinalizarDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar Aspiração</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja finalizar esta aspiração? Esta ação não pode ser desfeita.
              <br /><br />
              <strong>Atenção:</strong> Após finalizar, a aspiração ficará apenas como histórico e não poderá ser editada.
              <br /><br />
              Total de oócitos na aspiração: <strong>{totalOocitos}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submittingPacote}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleFinalizar}
              disabled={submittingPacote}
            >
              {submittingPacote ? 'Finalizando...' : 'Finalizar Aspiração'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
