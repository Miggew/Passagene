import { useEffect, useState } from 'react';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import StatusBadge from '@/components/shared/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Snowflake,
  Tag,
  Trash2,
  History,
  ChevronDown,
  ChevronUp,
  Package,
  CheckSquare,
  Square,
  User,
  Edit,
  AlertTriangle,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { formatDate } from '@/lib/utils';
import DatePickerBR from '@/components/shared/DatePickerBR';
import { supabase } from '@/lib/supabase';

// Hooks
import {
  useEmbrioesData,
  useEmbrioesActions,
  calcularDiaEmbriao,
  type EmbrioCompleto,
  type PacoteEmbrioes,
} from '@/hooks/embrioes';

export default function Embrioes() {
  const { toast } = useToast();

  // Data hook
  const {
    embrioes,
    pacotes,
    fazendas,
    clientes,
    loading,
    selectedFazendaDestinoId,
    setSelectedFazendaDestinoId,
    paginasPacotes,
    setPaginasPacotes,
    pageSize,
    loadData,
    loadFazendas,
    loadClientes,
    reloadData,
    getClassificacaoAtual,
    getResumoPacote,
    classificacoesPendentes,
    setClassificacoesPendentes,
  } = useEmbrioesData();

  // Actions hook
  const {
    embrioesSelecionados,
    setEmbrioesSelecionados,
    showAcoesEmMassa,
    setShowAcoesEmMassa,
    showCongelarDialog,
    setShowCongelarDialog,
    showDescartarDialog,
    setShowDescartarDialog,
    showClassificarDialog,
    setShowClassificarDialog,
    showDirecionarClienteDialog,
    setShowDirecionarClienteDialog,
    showHistoricoDialog,
    setShowHistoricoDialog,
    showEditarFazendasDestinoDialog,
    setShowEditarFazendasDestinoDialog,
    congelarData,
    setCongelarData,
    descartarData,
    setDescartarData,
    direcionarClienteData,
    setDirecionarClienteData,
    classificarEmbriao,
    setClassificarEmbriao,
    historicoEmbriao,
    setHistoricoEmbriao,
    pacoteEditandoFazendas,
    setPacoteEditandoFazendas,
    fazendasDestinoSelecionadas,
    setFazendasDestinoSelecionadas,
    historico,
    loadingHistorico,
    submitting,
    handleCongelarEmMassa,
    handleDescartarEmMassa,
    handleDirecionarClienteEmMassa,
    loadHistorico,
    handleSalvarFazendasDestino,
    limparSelecao,
  } = useEmbrioesActions({
    embrioes,
    pacotes,
    classificacoesPendentes,
    setClassificacoesPendentes,
    onSuccess: reloadData,
  });

  // Local UI state
  const [pacotesExpandidos, setPacotesExpandidos] = useState<Set<string>>(new Set());
  const [classificarData, setClassificarData] = useState({ classificacao: '' });

  // Load initial data
  useEffect(() => {
    loadFazendas();
    loadClientes();
  }, [loadFazendas, loadClientes]);

  useEffect(() => {
    loadData();
  }, [selectedFazendaDestinoId, loadData]);

  // Toggle pacote expansion
  const toggleExpandirPacote = (pacoteId: string) => {
    setPacotesExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(pacoteId)) {
        next.delete(pacoteId);
      } else {
        next.add(pacoteId);
      }
      return next;
    });
  };

  // Selection helpers
  const toggleSelecionarEmbriao = (embriaoId: string) => {
    setEmbrioesSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(embriaoId)) {
        next.delete(embriaoId);
      } else {
        next.add(embriaoId);
      }
      setShowAcoesEmMassa(next.size > 0);
      return next;
    });
  };

  const selecionarTodosDaPagina = (embrioesPagina: EmbrioCompleto[]) => {
    setEmbrioesSelecionados((prev) => {
      const next = new Set(prev);
      const todosSelecionados = embrioesPagina.every((e) => next.has(e.id));
      if (todosSelecionados) {
        embrioesPagina.forEach((e) => next.delete(e.id));
      } else {
        embrioesPagina.forEach((e) => next.add(e.id));
      }
      setShowAcoesEmMassa(next.size > 0);
      return next;
    });
  };

  // Pagination helpers
  const getPaginaPacote = (pacoteId: string) => paginasPacotes[pacoteId] ?? 1;
  const setPaginaPacote = (pacoteId: string, pagina: number) => {
    setPaginasPacotes((prev) => ({ ...prev, [pacoteId]: pagina }));
  };

  // Handle classification (saves to pending)
  const handleClassificar = () => {
    if (!classificarEmbriao || !classificarData.classificacao) {
      toast({
        title: 'Erro de validação',
        description: 'Classificação é obrigatória',
        variant: 'destructive',
      });
      return;
    }

    setClassificacoesPendentes((prev) => ({
      ...prev,
      [classificarEmbriao.id]: classificarData.classificacao,
    }));

    toast({
      title: 'Classificação pendente',
      description: 'Use "Despachar para o campo" para salvar.',
    });

    setShowClassificarDialog(false);
    setClassificarEmbriao(null);
    setClassificarData({ classificacao: '' });
    limparSelecao();
  };

  // Handle batch classification
  const handleClassificarEmMassa = () => {
    if (embrioesSelecionados.size === 0 || !classificarData.classificacao) {
      toast({
        title: 'Erro de validação',
        description: 'Selecione embriões e classificação',
        variant: 'destructive',
      });
      return;
    }

    const ids = Array.from(embrioesSelecionados);
    setClassificacoesPendentes((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        next[id] = classificarData.classificacao;
      });
      return next;
    });

    toast({
      title: 'Classificações pendentes',
      description: 'Use "Despachar para o campo" para salvar.',
    });

    setShowClassificarDialog(false);
    setClassificarData({ classificacao: '' });
    limparSelecao();
  };

  // Dispatch package to field
  const despacharPacoteParaCampo = async (pacote: PacoteEmbrioes) => {
    const resumo = getResumoPacote(pacote);
    if (!resumo.todosClassificados) {
      toast({
        title: 'Classificação pendente',
        description: 'Classifique todos os embriões antes de despachar.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const dataClassificacao = new Date().toISOString().split('T')[0];
      const embrioesPendentes = pacote.embrioes.filter((embriao) => {
        const classificacaoAtual = getClassificacaoAtual(embriao);
        return classificacaoAtual && classificacaoAtual !== (embriao.classificacao || '').trim();
      });

      if (embrioesPendentes.length > 0) {
        await Promise.all(
          embrioesPendentes.map((embriao) =>
            supabase
              .from('embrioes')
              .update({
                classificacao: getClassificacaoAtual(embriao),
                data_classificacao: dataClassificacao,
              })
              .eq('id', embriao.id)
          )
        );
      }

      await supabase
        .from('lotes_fiv')
        .update({ disponivel_para_transferencia: true })
        .eq('id', pacote.lote_fiv_id);

      toast({
        title: 'Pacote despachado',
        description: 'Disponível para transferência.',
      });

      setClassificacoesPendentes((prev) => {
        const next = { ...prev };
        embrioesPendentes.forEach((e) => delete next[e.id]);
        return next;
      });
      await reloadData();
    } catch (error) {
      toast({
        title: 'Erro ao despachar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  };

  // Render loading
  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estoque de Embriões"
        description="Gerenciar pacotes de embriões para transferência, congelamento ou descarte"
      />

      <Card>
        <CardHeader>
          <CardTitle>Pacotes de Embriões</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filter */}
          <div className="mb-4 space-y-2">
            <Label htmlFor="fazenda_destino">Filtrar por Fazenda Destino</Label>
            <Select
              value={selectedFazendaDestinoId || 'all'}
              onValueChange={(value) => setSelectedFazendaDestinoId(value === 'all' ? '' : value)}
            >
              <SelectTrigger className="w-full md:w-[300px]">
                <SelectValue placeholder="Todas as fazendas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as fazendas</SelectItem>
                {fazendas.map((fazenda) => (
                  <SelectItem key={fazenda.id} value={fazenda.id}>
                    {fazenda.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Packages */}
          {pacotes.length === 0 ? (
            <EmptyState
              title="Nenhum pacote encontrado"
              description="Selecione outra fazenda ou verifique se há pacotes disponíveis."
              action={
                selectedFazendaDestinoId ? (
                  <Button variant="outline" onClick={() => setSelectedFazendaDestinoId('')}>
                    Limpar filtro
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-4">
              {pacotes.map((pacote) => {
                const expandido = pacotesExpandidos.has(pacote.id);
                const totalSelecionados = pacote.embrioes.filter((e) =>
                  embrioesSelecionados.has(e.id)
                ).length;
                const resumoPacote = getResumoPacote(pacote);
                const diaEmbriao = calcularDiaEmbriao(pacote.data_fecundacao);
                const isD7 = diaEmbriao === 7;
                const isD8 = diaEmbriao === 8;
                const isVencido = diaEmbriao !== null && diaEmbriao > 8;

                let borderColor = 'border-l-green-500';
                if (isD8) borderColor = 'border-l-orange-500';
                if (isVencido) borderColor = 'border-l-red-500';

                return (
                  <Card key={pacote.id} className={`border-l-4 ${borderColor}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleExpandirPacote(pacote.id)}
                              className="p-0 h-auto"
                            >
                              {expandido ? (
                                <ChevronUp className="w-5 h-5 text-slate-600" />
                              ) : (
                                <ChevronDown className="w-5 h-5 text-slate-600" />
                              )}
                            </Button>
                            {diaEmbriao !== null && pacote.frescos > 0 && (
                              <>
                                {isD7 && (
                                  <Badge className="bg-green-100 text-green-800 border-green-300">
                                    D7 - Ideal
                                  </Badge>
                                )}
                                {isD8 && (
                                  <Badge className="bg-orange-100 text-orange-800 border-orange-300 animate-pulse">
                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                    D8 - Último dia!
                                  </Badge>
                                )}
                                {isVencido && (
                                  <Badge className="bg-red-100 text-red-800 border-red-300">
                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                    D{diaEmbriao} - Vencido
                                  </Badge>
                                )}
                              </>
                            )}
                            <CardTitle className="text-lg">
                              {pacote.pacote_info.fazenda_nome || 'Fazenda não identificada'} →{' '}
                              {pacote.fazendas_destino_nomes.length > 0 ? (
                                <span className="inline-flex flex-wrap gap-1">
                                  {pacote.fazendas_destino_nomes.map((nome, idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {nome}
                                    </Badge>
                                  ))}
                                </span>
                              ) : (
                                <span className="text-slate-400">Sem destino</span>
                              )}
                            </CardTitle>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setPacoteEditandoFazendas(pacote);
                                setFazendasDestinoSelecionadas([...pacote.fazendas_destino_ids]);
                                setShowEditarFazendasDestinoDialog(true);
                              }}
                              className="h-8 w-8 p-0"
                              title="Editar fazendas destino"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </div>
                          <div className="mt-2 ml-7 text-sm text-slate-600">
                            <p>
                              <strong>Data Despacho:</strong>{' '}
                              {pacote.data_despacho ? formatDate(pacote.data_despacho) : '-'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-4">
                          <div className="text-right">
                            <div className="text-2xl font-bold text-green-600">{pacote.total}</div>
                            <div className="text-sm text-slate-600">embriões</div>
                            <div className="text-xs text-slate-500 mt-1">
                              {pacote.frescos} frescos, {pacote.congelados} congelados
                            </div>
                            <div className="text-xs text-slate-500">
                              {resumoPacote.semClassificacao} sem classificação
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2 min-w-[280px]">
                            {resumoPacote.todosClassificados ? (
                              <>
                                <Badge
                                  variant="outline"
                                  className="bg-green-50 text-green-700 border-green-300"
                                >
                                  ✓ Todos classificados
                                </Badge>
                                {pacote.disponivel_para_transferencia ? (
                                  <Badge
                                    variant="outline"
                                    className="bg-blue-50 text-blue-700 border-blue-300"
                                  >
                                    Disponível para Transferência
                                  </Badge>
                                ) : (
                                  <Button
                                    size="sm"
                                    onClick={() => despacharPacoteParaCampo(pacote)}
                                    className="bg-green-600 hover:bg-green-700 text-white w-full"
                                  >
                                    Despachar para o campo
                                  </Button>
                                )}
                              </>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-amber-50 text-amber-700 border-amber-300"
                              >
                                Pendente: {resumoPacote.total - resumoPacote.semClassificacao}/
                                {resumoPacote.total}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    {expandido && (
                      <CardContent>
                        <PacoteEmbrioesTable
                          pacote={pacote}
                          embrioesSelecionados={embrioesSelecionados}
                          paginaAtual={getPaginaPacote(pacote.id)}
                          pageSize={pageSize}
                          totalSelecionados={totalSelecionados}
                          getClassificacaoAtual={getClassificacaoAtual}
                          onToggleSelecionarEmbriao={toggleSelecionarEmbriao}
                          onSelecionarTodosDaPagina={selecionarTodosDaPagina}
                          onSetPagina={(p) => setPaginaPacote(pacote.id, p)}
                          onClassificar={(embriao) => {
                            setClassificarEmbriao(embriao);
                            setClassificarData({
                              classificacao: getClassificacaoAtual(embriao) || '',
                            });
                            setShowClassificarDialog(true);
                          }}
                          onCongelar={(embriao) => {
                            if (!getClassificacaoAtual(embriao)) {
                              toast({
                                title: 'Classificação obrigatória',
                                description: 'Classifique o embrião primeiro.',
                                variant: 'destructive',
                              });
                              return;
                            }
                            setEmbrioesSelecionados(new Set([embriao.id]));
                            setShowCongelarDialog(true);
                          }}
                          onDirecionar={(embriao) => {
                            setEmbrioesSelecionados(new Set([embriao.id]));
                            setDirecionarClienteData({ cliente_id: '' });
                            setShowDirecionarClienteDialog(true);
                          }}
                          onDescartar={(embriao) => {
                            setEmbrioesSelecionados(new Set([embriao.id]));
                            setDescartarData({
                              data_descarte: new Date().toISOString().split('T')[0],
                              observacoes: '',
                            });
                            setShowDescartarDialog(true);
                          }}
                          onHistorico={async (embriao) => {
                            setHistoricoEmbriao(embriao);
                            setShowHistoricoDialog(true);
                            await loadHistorico(embriao.id);
                          }}
                          toast={toast}
                        />
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          {/* Bulk Actions Bar */}
          {showAcoesEmMassa && (
            <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-slate-600" />
                <span className="font-medium">{embrioesSelecionados.size} selecionado(s)</span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setClassificarData({ classificacao: '' });
                    setShowClassificarDialog(true);
                  }}
                >
                  <Tag className="w-4 h-4 mr-2" />
                  Classificar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCongelarData({
                      data_congelamento: new Date().toISOString().split('T')[0],
                      localizacao_atual: '',
                    });
                    setShowCongelarDialog(true);
                  }}
                >
                  <Snowflake className="w-4 h-4 mr-2" />
                  Congelar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDirecionarClienteData({ cliente_id: '' });
                    setShowDirecionarClienteDialog(true);
                  }}
                >
                  <User className="w-4 h-4 mr-2" />
                  Direcionar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDescartarData({
                      data_descarte: new Date().toISOString().split('T')[0],
                      observacoes: '',
                    });
                    setShowDescartarDialog(true);
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Descartar
                </Button>
                <Button variant="outline" size="sm" onClick={limparSelecao}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Classification Dialog (Individual) */}
      <Dialog
        open={showClassificarDialog && !!classificarEmbriao}
        onOpenChange={(open) => {
          if (!open) {
            setShowClassificarDialog(false);
            setClassificarEmbriao(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Classificar Embrião</DialogTitle>
            <DialogDescription>
              {classificarEmbriao?.identificacao || 'Embrião selecionado'}
            </DialogDescription>
          </DialogHeader>
          <ClassificarForm
            value={classificarData.classificacao}
            onChange={(v) => setClassificarData({ classificacao: v })}
            onSubmit={handleClassificar}
            onCancel={() => {
              setShowClassificarDialog(false);
              setClassificarEmbriao(null);
            }}
            submitting={submitting}
            buttonLabel="Salvar Classificação"
          />
        </DialogContent>
      </Dialog>

      {/* Classification Dialog (Batch) */}
      <Dialog
        open={showClassificarDialog && !classificarEmbriao && embrioesSelecionados.size > 0}
        onOpenChange={(open) => !open && setShowClassificarDialog(false)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Classificar {embrioesSelecionados.size} Embrião(ões)</DialogTitle>
            <DialogDescription>Mesma classificação para todos</DialogDescription>
          </DialogHeader>
          <ClassificarForm
            value={classificarData.classificacao}
            onChange={(v) => setClassificarData({ classificacao: v })}
            onSubmit={handleClassificarEmMassa}
            onCancel={() => setShowClassificarDialog(false)}
            submitting={submitting}
            buttonLabel={`Classificar ${embrioesSelecionados.size}`}
          />
        </DialogContent>
      </Dialog>

      {/* Freeze Dialog */}
      <Dialog open={showCongelarDialog} onOpenChange={setShowCongelarDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Congelar {embrioesSelecionados.size} Embrião(ões)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Data de Congelamento *</Label>
              <DatePickerBR
                value={congelarData.data_congelamento}
                onChange={(v) => setCongelarData({ ...congelarData, data_congelamento: v || '' })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Localização (Botijão) *</Label>
              <Input
                value={congelarData.localizacao_atual}
                onChange={(e) =>
                  setCongelarData({ ...congelarData, localizacao_atual: e.target.value })
                }
                placeholder="Ex: Botijão 1, Canister A"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleCongelarEmMassa}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                disabled={submitting}
              >
                {submitting ? 'Congelando...' : 'Congelar'}
              </Button>
              <Button variant="outline" onClick={() => setShowCongelarDialog(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Discard Dialog */}
      <Dialog open={showDescartarDialog} onOpenChange={setShowDescartarDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Descartar {embrioesSelecionados.size} Embrião(ões)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Data de Descarte *</Label>
              <DatePickerBR
                value={descartarData.data_descarte}
                onChange={(v) => setDescartarData({ ...descartarData, data_descarte: v || '' })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Observações / Motivo</Label>
              <Textarea
                value={descartarData.observacoes}
                onChange={(e) => setDescartarData({ ...descartarData, observacoes: e.target.value })}
                placeholder="Motivo do descarte (opcional)"
                rows={3}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleDescartarEmMassa}
                className="flex-1 bg-red-600 hover:bg-red-700"
                disabled={submitting}
              >
                {submitting ? 'Descartando...' : 'Descartar'}
              </Button>
              <Button variant="outline" onClick={() => setShowDescartarDialog(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Client Direction Dialog */}
      <Dialog open={showDirecionarClienteDialog} onOpenChange={setShowDirecionarClienteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Direcionar para Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Select
                value={direcionarClienteData.cliente_id}
                onValueChange={(v) => setDirecionarClienteData({ cliente_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => handleDirecionarClienteEmMassa(clientes)}
                className="flex-1 bg-green-600 hover:bg-green-700"
                disabled={submitting}
              >
                {submitting ? 'Direcionando...' : 'Direcionar'}
              </Button>
              <Button variant="outline" onClick={() => setShowDirecionarClienteDialog(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* History Sheet */}
      <Sheet open={showHistoricoDialog} onOpenChange={setShowHistoricoDialog}>
        <SheetContent className="w-full sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Histórico do Embrião</SheetTitle>
            <SheetDescription>
              {historicoEmbriao?.identificacao || historicoEmbriao?.id?.slice(0, 8)}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            {loadingHistorico ? (
              <LoadingSpinner />
            ) : historico.length === 0 ? (
              <p className="text-slate-500 text-center py-8">Nenhum histórico encontrado</p>
            ) : (
              <div className="space-y-4">
                {historico.map((item) => (
                  <Card key={item.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold">{item.tipo_operacao}</p>
                          <p className="text-sm text-slate-600 mt-1">
                            {item.data_mudanca ? formatDate(item.data_mudanca) : '-'}
                          </p>
                          {item.observacoes && (
                            <p className="text-sm text-slate-500 mt-1">{item.observacoes}</p>
                          )}
                        </div>
                        <StatusBadge status={item.status_novo || ''} />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Edit Destination Fazendas Dialog */}
      <Dialog open={showEditarFazendasDestinoDialog} onOpenChange={setShowEditarFazendasDestinoDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Fazendas Destino</DialogTitle>
            <DialogDescription>Selecione as fazendas destino do pacote</DialogDescription>
          </DialogHeader>
          {pacoteEditandoFazendas && (
            <div className="space-y-4">
              <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-3">
                {fazendas.map((fazenda) => (
                  <label
                    key={fazenda.id}
                    className="flex items-center space-x-2 cursor-pointer hover:bg-slate-50 p-2 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={fazendasDestinoSelecionadas.includes(fazenda.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFazendasDestinoSelecionadas([
                            ...fazendasDestinoSelecionadas,
                            fazenda.id,
                          ]);
                        } else {
                          setFazendasDestinoSelecionadas(
                            fazendasDestinoSelecionadas.filter((id) => id !== fazenda.id)
                          );
                        }
                      }}
                      className="rounded border-slate-300"
                    />
                    <span className="text-sm">{fazenda.nome}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowEditarFazendasDestinoDialog(false);
                setPacoteEditandoFazendas(null);
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleSalvarFazendasDestino} disabled={submitting}>
              {submitting ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Sub-components

interface ClassificarFormProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitting: boolean;
  buttonLabel: string;
}

function ClassificarForm({
  value,
  onChange,
  onSubmit,
  onCancel,
  submitting,
  buttonLabel,
}: ClassificarFormProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Classificação *</Label>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="BE">BE (Blastocisto Excelente)</SelectItem>
            <SelectItem value="BN">BN (Blastocisto Normal)</SelectItem>
            <SelectItem value="BX">BX (Blastocisto Regular)</SelectItem>
            <SelectItem value="BL">BL (Blastocisto Limitado)</SelectItem>
            <SelectItem value="BI">BI (Blastocisto Irregular)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2 pt-2">
        <Button
          onClick={onSubmit}
          className="flex-1 bg-purple-600 hover:bg-purple-700"
          disabled={submitting}
        >
          {submitting ? 'Salvando...' : buttonLabel}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

interface PacoteEmbrioesTableProps {
  pacote: PacoteEmbrioes;
  embrioesSelecionados: Set<string>;
  paginaAtual: number;
  pageSize: number;
  totalSelecionados: number;
  getClassificacaoAtual: (e: EmbrioCompleto) => string;
  onToggleSelecionarEmbriao: (id: string) => void;
  onSelecionarTodosDaPagina: (embrioes: EmbrioCompleto[]) => void;
  onSetPagina: (p: number) => void;
  onClassificar: (e: EmbrioCompleto) => void;
  onCongelar: (e: EmbrioCompleto) => void;
  onDirecionar: (e: EmbrioCompleto) => void;
  onDescartar: (e: EmbrioCompleto) => void;
  onHistorico: (e: EmbrioCompleto) => void;
  toast: ReturnType<typeof useToast>['toast'];
}

function PacoteEmbrioesTable({
  pacote,
  embrioesSelecionados,
  paginaAtual,
  pageSize,
  totalSelecionados,
  getClassificacaoAtual,
  onToggleSelecionarEmbriao,
  onSelecionarTodosDaPagina,
  onSetPagina,
  onClassificar,
  onCongelar,
  onDirecionar,
  onDescartar,
  onHistorico,
}: PacoteEmbrioesTableProps) {
  const embrioesOrdenados = [...pacote.embrioes].sort((a, b) => {
    const idA = a.identificacao || '';
    const idB = b.identificacao || '';
    if (idA && idB) return idA.localeCompare(idB);
    if (idA && !idB) return -1;
    if (!idA && idB) return 1;
    return (a.created_at || '').localeCompare(b.created_at || '');
  });

  const totalPaginas = Math.max(1, Math.ceil(embrioesOrdenados.length / pageSize));
  const pagina = Math.min(paginaAtual, totalPaginas);
  const inicio = (pagina - 1) * pageSize;
  const embrioesPagina = embrioesOrdenados.slice(inicio, inicio + pageSize);
  const todosSelecionadosPagina = embrioesPagina.every((e) => embrioesSelecionados.has(e.id));
  const algunsSelecionadosPagina = embrioesPagina.some((e) => embrioesSelecionados.has(e.id));

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSelecionarTodosDaPagina(embrioesPagina)}
          >
            {todosSelecionadosPagina ? (
              <CheckSquare className="w-4 h-4 mr-2" />
            ) : (
              <Square className="w-4 h-4 mr-2" />
            )}
            {todosSelecionadosPagina ? 'Desmarcar Página' : 'Selecionar Página'}
          </Button>
          <span className="text-sm text-slate-600">
            {algunsSelecionadosPagina &&
              `${embrioesPagina.filter((e) => embrioesSelecionados.has(e.id)).length} na página`}
            {!algunsSelecionadosPagina && totalSelecionados > 0 && `${totalSelecionados} no pacote`}
          </span>
        </div>
        <div className="text-sm text-slate-600">
          Página {pagina} de {totalPaginas}
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12" />
            <TableHead className="text-center w-28">Código</TableHead>
            <TableHead>Doadora</TableHead>
            <TableHead>Touro</TableHead>
            <TableHead>Classificação</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Localização</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {embrioesPagina.map((embriao, index) => {
            const selecionado = embrioesSelecionados.has(embriao.id);
            const classificacao = getClassificacaoAtual(embriao);

            return (
              <TableRow key={embriao.id}>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-0 h-auto"
                    onClick={() => onToggleSelecionarEmbriao(embriao.id)}
                  >
                    {selecionado ? (
                      <CheckSquare className="w-4 h-4 text-green-600" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                  </Button>
                </TableCell>
                <TableCell className="text-center font-mono text-xs">
                  {embriao.identificacao || `#${inicio + index + 1}`}
                </TableCell>
                <TableCell>{embriao.doadora_registro || '-'}</TableCell>
                <TableCell>{embriao.touro_nome || '-'}</TableCell>
                <TableCell>
                  {classificacao ? (
                    <Badge variant="outline">{classificacao}</Badge>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge status={embriao.status_atual} />
                </TableCell>
                <TableCell>{embriao.localizacao_atual || '-'}</TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-1 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onClassificar(embriao)}
                      title="Classificar"
                    >
                      <Tag className="w-4 h-4 text-purple-600" />
                    </Button>
                    {embriao.status_atual === 'FRESCO' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onCongelar(embriao)}
                        title={classificacao ? 'Congelar' : 'Classifique primeiro'}
                        disabled={!classificacao}
                      >
                        <Snowflake
                          className={classificacao ? 'w-4 h-4 text-blue-600' : 'w-4 h-4 text-slate-400'}
                        />
                      </Button>
                    )}
                    {embriao.status_atual === 'CONGELADO' && !embriao.cliente_id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDirecionar(embriao)}
                        title="Direcionar para Cliente"
                      >
                        <User className="w-4 h-4 text-green-600" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDescartar(embriao)}
                      title="Descartar"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onHistorico(embriao)}
                      title="Ver Histórico"
                    >
                      <History className="w-4 h-4 text-slate-600" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-slate-600">{embrioesOrdenados.length} embriões no pacote</div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSetPagina(Math.max(1, pagina - 1))}
            disabled={pagina === 1}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSetPagina(Math.min(totalPaginas, pagina + 1))}
            disabled={pagina === totalPaginas}
          >
            Próxima
          </Button>
        </div>
      </div>
    </>
  );
}
