import { useEffect, useState, useMemo } from 'react';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatDateBR as formatDate } from '@/lib/dateUtils';
import { formatStatusLabel } from '@/lib/statusLabels';
import { ArrowLeft, Plus, UserPlus, CheckCircle, Lock, Trash2, ChevronsUpDown, Check } from 'lucide-react';

import {
  useProtocoloData,
  useAddReceptoraProtocolo,
  useCreateReceptoraProtocolo,
} from '@/hooks/protocolos';

export default function ProtocoloDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Dialog states
  const [showAddReceptora, setShowAddReceptora] = useState(false);
  const [showResumoPasso1, setShowResumoPasso1] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [buscaReceptora, setBuscaReceptora] = useState('');

  // Data hook
  const {
    loading,
    protocolo,
    fazendaNome,
    receptoras,
    receptorasDisponiveis,
    loadData,
    reloadReceptorasDisponiveis,
  } = useProtocoloData({ protocoloId: id });

  // Add receptora hook
  const addReceptoraHook = useAddReceptoraProtocolo({
    protocoloId: id,
    protocolo,
    receptoras,
    onSuccess: () => {
      setShowAddReceptora(false);
      loadData();
    },
  });

  // Create receptora hook
  const createReceptoraHook = useCreateReceptoraProtocolo({
    protocoloId: id,
    protocolo,
    onSuccess: () => {
      setShowAddReceptora(false);
      loadData();
    },
  });

  // Load data on mount
  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id, loadData]);

  // Reload disponíveis when dialog opens
  useEffect(() => {
    if (showAddReceptora && protocolo) {
      reloadReceptorasDisponiveis();
    }
  }, [showAddReceptora, protocolo, reloadReceptorasDisponiveis]);

  const handleFinalizarPasso1 = async () => {
    if (!protocolo?.fazenda_id || !protocolo?.data_inicio || !protocolo?.responsavel_inicio) {
      toast({
        title: 'Erro de validação',
        description: 'Protocolo incompleto: faltam dados obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    if (receptoras.length === 0) {
      toast({
        title: 'Erro de validação',
        description: 'Adicione pelo menos 1 receptora antes de finalizar o 1º passo',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const { error: protocoloError } = await supabase
        .from('protocolos_sincronizacao')
        .update({ status: 'PASSO1_FECHADO' })
        .eq('id', id);

      if (protocoloError) throw protocoloError;

      await loadData();
      setShowResumoPasso1(true);
    } catch (error) {
      toast({
        title: 'Erro ao finalizar 1º passo',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelarProtocolo = async () => {
    try {
      setSubmitting(true);

      const { error: prError } = await supabase
        .from('protocolo_receptoras')
        .delete()
        .eq('protocolo_id', id);

      if (prError) throw prError;

      const { error: protocoloError } = await supabase
        .from('protocolos_sincronizacao')
        .delete()
        .eq('id', id);

      if (protocoloError) throw protocoloError;

      toast({
        title: 'Protocolo cancelado',
        description: 'Protocolo cancelado com sucesso',
      });

      navigate('/protocolos');
    } catch (error) {
      toast({
        title: 'Erro ao cancelar protocolo',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseResumoPasso1 = () => {
    setShowResumoPasso1(false);
    toast({
      title: '1º passo concluído com sucesso',
      description: `${receptoras.length} receptoras em sincronização`,
    });
    navigate('/protocolos');
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!protocolo) {
    return (
      <EmptyState
        title="Protocolo não encontrado"
        description="Volte para a lista e selecione outro protocolo."
        action={
          <Button onClick={() => navigate('/protocolos')} variant="outline">
            Voltar para Protocolos
          </Button>
        }
      />
    );
  }

  // Protocolos são criados já com PASSO1_FECHADO, não podem mais ser editados
  const isPasso1Aberto = false;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Protocolo - ${fazendaNome}`}
        description={isPasso1Aberto ? 'Gerenciar receptoras do 1º passo' : 'Protocolo finalizado'}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigate('/protocolos')} aria-label="Voltar">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            {isPasso1Aberto && (
              <>
                <Dialog
                  open={showAddReceptora}
                  onOpenChange={(open) => {
                    setShowAddReceptora(open);
                    if (!open) {
                      addReceptoraHook.resetForm();
                      createReceptoraHook.resetForm();
                      setBuscaReceptora('');
                      setComboboxOpen(false);
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar Receptora
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Adicionar Receptora ao Protocolo</DialogTitle>
                      <DialogDescription>
                        Selecione uma receptora VAZIA da fazenda {fazendaNome} ou cadastre uma nova
                      </DialogDescription>
                    </DialogHeader>
                    <Tabs defaultValue="existing" className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="existing">Receptora Existente</TabsTrigger>
                        <TabsTrigger value="new">Cadastrar Nova</TabsTrigger>
                      </TabsList>

                      {/* Tab: Receptora Existente */}
                      <TabsContent value="existing" className="space-y-4 mt-4">
                        <div className="space-y-2">
                          <Label>Receptora *</Label>
                          <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={comboboxOpen}
                                className="w-full justify-between font-normal"
                              >
                                {addReceptoraHook.formData.receptora_id
                                  ? (() => {
                                    const selected = receptorasDisponiveis.find(
                                      (r) => r.id === addReceptoraHook.formData.receptora_id
                                    );
                                    return selected
                                      ? `${selected.identificacao}${selected.nome ? ` - ${selected.nome}` : ''}`
                                      : 'Selecione uma receptora...';
                                  })()
                                  : 'Selecione uma receptora...'}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0" align="start">
                              <Command shouldFilter={false}>
                                <CommandInput
                                  placeholder="Buscar por brinco ou nome..."
                                  value={buscaReceptora}
                                  onValueChange={setBuscaReceptora}
                                />
                                <CommandList>
                                  <CommandEmpty>Nenhuma receptora encontrada.</CommandEmpty>
                                  <CommandGroup>
                                    {receptorasDisponiveis
                                      .filter((r) => {
                                        if (!buscaReceptora) return true;
                                        const busca = buscaReceptora.toLowerCase();
                                        return (
                                          r.identificacao?.toLowerCase().includes(busca) ||
                                          r.nome?.toLowerCase().includes(busca)
                                        );
                                      })
                                      .map((r) => {
                                        const statusLabel = r.status_reprodutivo
                                          ? formatStatusLabel(r.status_reprodutivo)
                                          : 'Vazia';

                                        return (
                                          <CommandItem
                                            key={r.id}
                                            value={r.id}
                                            disabled={!r.disponivel}
                                            onSelect={() => {
                                              if (r.disponivel) {
                                                addReceptoraHook.updateField('receptora_id', r.id);
                                                setComboboxOpen(false);
                                                setBuscaReceptora('');
                                              }
                                            }}
                                            className={cn(
                                              'flex items-center justify-between',
                                              !r.disponivel && 'opacity-50 cursor-not-allowed'
                                            )}
                                          >
                                            <div className="flex items-center gap-2">
                                              <Check
                                                className={cn(
                                                  'h-4 w-4',
                                                  addReceptoraHook.formData.receptora_id === r.id
                                                    ? 'opacity-100'
                                                    : 'opacity-0'
                                                )}
                                              />
                                              <span className={!r.disponivel ? 'text-muted-foreground' : ''}>
                                                {r.identificacao}
                                                {r.nome ? ` - ${r.nome}` : ''}
                                              </span>
                                            </div>
                                            {!r.disponivel && (
                                              <Badge
                                                variant="outline"
                                                className={cn(
                                                  'ml-2 text-[10px] px-1.5 py-0',
                                                  r.jaNoProtocolo
                                                    ? 'border-blue-500/50 text-blue-600 dark:text-blue-400'
                                                    : 'border-amber-500/50 text-amber-600 dark:text-amber-400'
                                                )}
                                              >
                                                {r.jaNoProtocolo ? 'Já no protocolo' : statusLabel}
                                              </Badge>
                                            )}
                                          </CommandItem>
                                        );
                                      })}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>

                        <div className="space-y-2">
                          <Label>Observações</Label>
                          <Textarea
                            value={addReceptoraHook.formData.observacoes}
                            onChange={(e) => addReceptoraHook.updateField('observacoes', e.target.value)}
                            placeholder="Observações sobre a inclusão"
                            rows={2}
                          />
                        </div>

                        <Button
                          onClick={addReceptoraHook.handleAddReceptora}
                          className="w-full"
                          disabled={addReceptoraHook.submitting || !addReceptoraHook.formData.receptora_id}
                        >
                          {addReceptoraHook.submitting ? 'Adicionando...' : 'Adicionar'}
                        </Button>
                      </TabsContent>

                      {/* Tab: Cadastrar Nova */}
                      <TabsContent value="new" className="space-y-4 mt-4">
                        <div className="space-y-2">
                          <Label>Identificação (Brinco) *</Label>
                          <Input
                            value={createReceptoraHook.formData.identificacao}
                            onChange={(e) => createReceptoraHook.updateField('identificacao', e.target.value)}
                            placeholder="Número do brinco"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Nome</Label>
                          <Input
                            value={createReceptoraHook.formData.nome}
                            onChange={(e) => createReceptoraHook.updateField('nome', e.target.value)}
                            placeholder="Nome da receptora (opcional)"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Observações</Label>
                          <Textarea
                            value={createReceptoraHook.formData.observacoes}
                            onChange={(e) => createReceptoraHook.updateField('observacoes', e.target.value)}
                            placeholder="Observações sobre a receptora"
                            rows={2}
                          />
                        </div>

                        <Button
                          onClick={createReceptoraHook.handleCreateReceptora}
                          className="w-full"
                          disabled={createReceptoraHook.submitting}
                        >
                          <UserPlus className="w-4 h-4 mr-2" />
                          {createReceptoraHook.submitting ? 'Criando...' : 'Criar e Adicionar'}
                        </Button>
                      </TabsContent>
                    </Tabs>
                  </DialogContent>
                </Dialog>

                <Button
                  onClick={handleFinalizarPasso1}
                  disabled={receptoras.length === 0 || submitting}
                >
                  <Lock className="w-4 h-4 mr-2" />
                  {submitting ? 'Finalizando...' : 'Finalizar 1º Passo'}
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="border-red-600 text-red-600 hover:bg-red-50">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Cancelar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancelar Protocolo</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja cancelar este protocolo? Esta ação não pode ser desfeita.
                        Todas as receptoras vinculadas serão removidas do protocolo.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Não, manter protocolo</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleCancelarProtocolo}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Sim, cancelar protocolo
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        }
      />

      {/* Informações do Protocolo */}
      <Card>
        <CardHeader>
          <CardTitle>Informações do Protocolo</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Fazenda</p>
            <p className="text-base text-foreground">{fazendaNome}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Data Início</p>
            <p className="text-base text-foreground">{formatDate(protocolo.data_inicio)}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Responsável</p>
            <p className="text-base text-foreground">{protocolo.responsavel_inicio}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Status</p>
            <div className="text-base text-foreground">
              {isPasso1Aberto ? (
                <Badge variant="default">1º Passo</Badge>
              ) : (
                <Badge variant="secondary">1º Passo Concluído</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Receptoras do Protocolo */}
      <Card>
        <CardHeader>
          <CardTitle>Receptoras do Protocolo ({receptoras.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {receptoras.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma receptora adicionada ao protocolo
            </div>
          ) : (
            <>
              {/* Mobile: Cards */}
              <div className="md:hidden space-y-3">
                {receptoras.map((r) => (
                  <div key={r.id} className="rounded-xl border border-border/60 bg-card shadow-sm p-3.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-base font-medium text-foreground">{r.identificacao}</span>
                      <Badge variant="secondary">
                        {r.pr_status === 'INICIADA' ? 'Em Sincronização' : r.pr_status}
                      </Badge>
                    </div>
                    {r.nome && (
                      <p className="text-sm text-muted-foreground mb-1">{r.nome}</p>
                    )}
                    {r.pr_observacoes && (
                      <p className="text-xs text-muted-foreground pt-2 border-t border-border/50">{r.pr_observacoes}</p>
                    )}
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
                      <TableHead>Observações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receptoras.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.identificacao}</TableCell>
                        <TableCell>{r.nome || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {r.pr_status === 'INICIADA' ? 'Em Sincronização' : r.pr_status}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{r.pr_observacoes || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Resumo do 1º Passo Modal */}
      <Dialog open={showResumoPasso1} onOpenChange={setShowResumoPasso1}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-6 h-6 text-primary" />
              Resumo do 1º Passo
            </DialogTitle>
            <DialogDescription>1º passo concluído com sucesso</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 p-4 bg-secondary rounded-lg">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Fazenda</p>
                <p className="text-base text-foreground">{fazendaNome}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Data do 1º Passo</p>
                <p className="text-base text-foreground">{formatDate(protocolo.data_inicio)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Responsável</p>
                <p className="text-base text-foreground">{protocolo.responsavel_inicio}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total de Receptoras</p>
                <p className="text-base text-foreground font-bold">{receptoras.length}</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-foreground mb-2">Receptoras em Sincronização:</p>
              <div className="max-h-60 overflow-y-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Brinco</TableHead>
                      <TableHead>Nome</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receptoras.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.identificacao}</TableCell>
                        <TableCell>{r.nome || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Próximo passo:</strong> Acesse a aba "2º Passo (para confirmar)" na tela de
                Protocolos e clique em "INICIAR 2º PASSO" para revisar e confirmar as receptoras.
              </p>
            </div>

            <Button
              onClick={handleCloseResumoPasso1}
              className="w-full"
            >
              OK - Voltar para Protocolos
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
