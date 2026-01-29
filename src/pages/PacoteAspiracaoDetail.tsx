import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
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
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/utils';
import { ArrowLeft, Plus, Lock, Edit } from 'lucide-react';

import { OocitosCountingForm } from '@/components/aspiracoes/OocitosCountingForm';
import {
  usePacoteAspiracaoData,
  useAddDoadoraForm,
  useCreateDoadoraForm,
  useEditAspiracaoForm,
} from '@/hooks/aspiracoes';

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
      <PageHeader
        title={`Aspiração - ${fazendaNome}`}
        description={isFinalizado ? 'Aspiração finalizada' : 'Gerenciar doadoras da aspiração'}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigate('/aspiracoes')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            {!isFinalizado && (
              <Button
                onClick={() => setShowFinalizarDialog(true)}
                disabled={submittingPacote || aspiracoes.length === 0}
              >
                <Lock className="w-4 h-4 mr-2" />
                {submittingPacote ? 'Finalizando...' : 'Finalizar Pacote'}
              </Button>
            )}
          </div>
        }
      />

      {/* Informações da Aspiração */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Informações da Aspiração</CardTitle>
            {!isFinalizado && (
              <Button variant="outline" size="sm" onClick={() => setShowEditPacote(true)}>
                <Edit className="w-4 h-4 mr-2" />
                Editar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground">Fazenda da Aspiração</Label>
              <p className="font-medium">{fazendaNome}</p>
            </div>
            <div className="col-span-2">
              <Label className="text-muted-foreground">Fazendas Destino</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {fazendasDestinoNomes.length > 0 ? (
                  fazendasDestinoNomes.map((nome, index) => (
                    <Badge key={index} variant="outline" className="font-medium">
                      {nome}
                    </Badge>
                  ))
                ) : (
                  <p className="font-medium text-muted-foreground">-</p>
                )}
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">Data da Aspiração</Label>
              <p className="font-medium">{formatDate(pacote.data_aspiracao)}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Horário de Início</Label>
              <p className="font-medium">{pacote.horario_inicio || '-'}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Veterinário Responsável</Label>
              <p className="font-medium">{pacote.veterinario_responsavel || '-'}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Técnico Responsável</Label>
              <p className="font-medium">{pacote.tecnico_responsavel || '-'}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Status</Label>
              <div>
                <Badge variant={isFinalizado ? 'default' : 'secondary'}>
                  {isFinalizado ? 'FINALIZADO' : 'EM ANDAMENTO'}
                </Badge>
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">Total de Oócitos</Label>
              <p className="font-medium text-lg">{totalOocitos}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Doadoras */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Doadoras Aspiradas ({aspiracoes.length})</CardTitle>
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
                  <Button>
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
                        onChange={(field, value) => addDoadoraHook.updateField(field as any, value)}
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
                        onChange={(field, value) => addDoadoraHook.updateField(field as any, value)}
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
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Doadora</TableHead>
                <TableHead>Registro</TableHead>
                <TableHead>Horário</TableHead>
                <TableHead>Viáveis</TableHead>
                <TableHead>Total Oócitos</TableHead>
                <TableHead>Recomendação Touro</TableHead>
                <TableHead>Observações</TableHead>
                {!isFinalizado && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {aspiracoes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isFinalizado ? 7 : 8} className="text-center text-muted-foreground">
                    Nenhuma doadora adicionada à aspiração
                  </TableCell>
                </TableRow>
              ) : (
                aspiracoes.map((aspiracao) => (
                  <TableRow key={aspiracao.id}>
                    <TableCell className="font-medium">{aspiracao.doadora_nome || '-'}</TableCell>
                    <TableCell>{aspiracao.doadora_registro || '-'}</TableCell>
                    <TableCell>
                      {aspiracao.horario_aspiracao
                        ? `${aspiracao.horario_aspiracao}${aspiracao.hora_final ? ` - ${aspiracao.hora_final}` : ''}`
                        : '-'}
                    </TableCell>
                    <TableCell className="font-medium">{aspiracao.viaveis || 0}</TableCell>
                    <TableCell>{aspiracao.total_oocitos || 0}</TableCell>
                    <TableCell>{aspiracao.recomendacao_touro || '-'}</TableCell>
                    <TableCell>{aspiracao.observacoes || '-'}</TableCell>
                    {!isFinalizado && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => editAspiracaoHook.openEdit(aspiracao)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
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
              onChange={(field, value) => editAspiracaoHook.updateField(field as any, value)}
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
