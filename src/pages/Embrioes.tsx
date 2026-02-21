import { useCallback, useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { todayISO as getTodayDateString } from '@/lib/dateUtils';

// Hooks
import {
  useEmbrioesData,
  useEmbrioesActions,
  type EmbrioCompleto,
  type PacoteEmbrioes,
} from '@/hooks/embrioes';

// Components
import {
  PacoteCard,
  BulkActionsBar,
  ClassificarDialogIndividual,
  ClassificarDialogBatch,
  CongelarDialog,
  DescartarDialog,
  EditarFazendasDestinoDialog,
} from '@/components/embrioes';

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
    showEditarFazendasDestinoDialog,
    setShowEditarFazendasDestinoDialog,
    congelarData,
    setCongelarData,
    descartarData,
    setDescartarData,
    classificarEmbriao,
    setClassificarEmbriao,
    pacoteEditandoFazendas,
    setPacoteEditandoFazendas,
    fazendasDestinoSelecionadas,
    setFazendasDestinoSelecionadas,
    submitting,
    handleCongelarEmMassa,
    handleDescartarEmMassa,
    handleSalvarFazendasDestino,
    limparSelecao,
  } = useEmbrioesActions({
    embrioes,
    pacotes,
    classificacoesPendentes,
    setClassificacoesPendentes,
    onSuccess: reloadData,
  });

  // Handler para alternar estrela do embrião
  const handleToggleEstrela = async (embriao: EmbrioCompleto) => {
    try {
      const novoValor = !embriao.estrela;
      const { error } = await supabase
        .from('embrioes')
        .update({ estrela: novoValor })
        .eq('id', embriao.id);

      if (error) throw error;

      toast({
        title: novoValor ? 'Embrião marcado como Top' : 'Estrela removida',
        description: novoValor ? 'Embrião marcado com estrela.' : 'Estrela removida do embrião.',
      });

      await reloadData();
    } catch (error) {
      toast({
        title: 'Erro ao atualizar embrião',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  };

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
  const toggleExpandirPacote = useCallback((pacoteId: string) => {
    setPacotesExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(pacoteId)) {
        next.delete(pacoteId);
      } else {
        next.add(pacoteId);
      }
      return next;
    });
  }, []);

  // Selection helpers
  const toggleSelecionarEmbriao = useCallback((embriaoId: string) => {
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
  }, []);

  const selecionarTodosDaPagina = useCallback((embrioesPagina: EmbrioCompleto[]) => {
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
  }, []);

  // Pagination helpers
  const getPaginaPacote = useCallback((pacoteId: string) => paginasPacotes[pacoteId] ?? 1, [paginasPacotes]);
  const setPaginaPacote = useCallback((pacoteId: string, pagina: number) => {
    setPaginasPacotes((prev) => ({ ...prev, [pacoteId]: pagina }));
  }, []);

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
      const dataClassificacao = getTodayDateString();
      const embrioesPendentes = pacote.embrioes.filter((embriao) => {
        const classificacaoAtual = getClassificacaoAtual(embriao);
        return classificacaoAtual && classificacaoAtual !== (embriao.classificacao || '').trim();
      });

      if (embrioesPendentes.length > 0) {
        const results = await Promise.all(
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
        const failed = results.find(r => r.error);
        if (failed?.error) { toast({ title: 'Erro ao classificar embriões', variant: 'destructive' }); throw failed.error; }
      }

      const { error: loteError } = await supabase
        .from('lotes_fiv')
        .update({ disponivel_para_transferencia: true })
        .eq('id', pacote.lote_fiv_id);
      if (loteError) { toast({ title: 'Erro ao liberar lote para TE', variant: 'destructive' }); throw loteError; }

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
    <div className={`space-y-6 ${showAcoesEmMassa ? 'pb-24' : ''}`}>
      <PageHeader
        title="Embriões"
        description="Gerenciar pacotes de embriões para transferência, congelamento ou descarte"
      />

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card p-4 rounded-lg border border-border shadow-sm">
        <div className="flex items-center gap-3">
          <Label htmlFor="fazenda_destino" className="text-sm font-medium whitespace-nowrap">
            Fazenda Destino:
          </Label>
          <Select
            value={selectedFazendaDestinoId || 'all'}
            onValueChange={(value) => setSelectedFazendaDestinoId(value === 'all' ? '' : value)}
          >
            <SelectTrigger className="w-[200px] sm:w-[280px]">
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
        <div className="text-sm text-muted-foreground">
          {pacotes.length} pacote(s) encontrado(s)
        </div>
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
          {pacotes.map((pacote) => (
            <PacoteCard
              key={pacote.id}
              pacote={pacote}
              expandido={pacotesExpandidos.has(pacote.id)}
              onToggleExpandir={() => toggleExpandirPacote(pacote.id)}
              onEditarFazendasDestino={() => {
                setPacoteEditandoFazendas(pacote);
                setFazendasDestinoSelecionadas([...pacote.fazendas_destino_ids]);
                setShowEditarFazendasDestinoDialog(true);
              }}
              onDespachar={() => despacharPacoteParaCampo(pacote)}
              resumoPacote={getResumoPacote(pacote)}
              embrioesSelecionados={embrioesSelecionados}
              paginaAtual={getPaginaPacote(pacote.id)}
              pageSize={pageSize}
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
                setCongelarData({
                  data_congelamento: getTodayDateString(),
                  localizacao_atual: '',
                  cliente_id: '',
                });
                setShowCongelarDialog(true);
              }}
              onDescartar={(embriao) => {
                setEmbrioesSelecionados(new Set([embriao.id]));
                setDescartarData({
                  data_descarte: getTodayDateString(),
                  observacoes: '',
                });
                setShowDescartarDialog(true);
              }}
              onToggleEstrela={handleToggleEstrela}
            />
          ))}
        </div>
      )}

      {/* Bulk Actions Bar */}
      {showAcoesEmMassa && (
        <BulkActionsBar
          selectedCount={embrioesSelecionados.size}
          onClassificar={() => {
            // Verificar se há embriões de pacotes já despachados
            const ids = Array.from(embrioesSelecionados);
            const embrioesDespachadosCount = ids.filter(id => {
              const pacote = pacotes.find(p => p.embrioes.some(e => e.id === id));
              return pacote?.disponivel_para_transferencia === true;
            }).length;

            if (embrioesDespachadosCount > 0) {
              toast({
                title: 'Ação não permitida',
                description: `${embrioesDespachadosCount} embrião(ões) já foram despachados e não podem ser reclassificados.`,
                variant: 'destructive',
              });
              return;
            }

            setClassificarData({ classificacao: '' });
            setShowClassificarDialog(true);
          }}
          onCongelar={() => {
            const ids = Array.from(embrioesSelecionados);

            // Verificar se há embriões de pacotes já despachados
            const embrioesDespachadosCount = ids.filter(id => {
              const pacote = pacotes.find(p => p.embrioes.some(e => e.id === id));
              return pacote?.disponivel_para_transferencia === true;
            }).length;

            if (embrioesDespachadosCount > 0) {
              toast({
                title: 'Ação não permitida',
                description: `${embrioesDespachadosCount} embrião(ões) já foram despachados e não podem ser congelados.`,
                variant: 'destructive',
              });
              return;
            }

            // Validar se todos embriões selecionados estão classificados
            const embrioesParaCongelar = embrioes.filter(e => ids.includes(e.id));
            const semClassificacao = embrioesParaCongelar.filter(e => !getClassificacaoAtual(e));

            if (semClassificacao.length > 0) {
              toast({
                title: 'Classificação obrigatória',
                description: `${semClassificacao.length} embrião(ões) não possui(em) classificação. Classifique antes de congelar.`,
                variant: 'destructive',
              });
              return;
            }

            setCongelarData({
              data_congelamento: getTodayDateString(),
              localizacao_atual: '',
              cliente_id: '',
            });
            setShowCongelarDialog(true);
          }}
          onDescartar={() => {
            setDescartarData({
              data_descarte: getTodayDateString(),
              observacoes: '',
            });
            setShowDescartarDialog(true);
          }}
          onCancelar={limparSelecao}
        />
      )}

      {/* Dialogs */}
      <ClassificarDialogIndividual
        open={showClassificarDialog && !!classificarEmbriao}
        onOpenChange={(open) => {
          if (!open) {
            setShowClassificarDialog(false);
            setClassificarEmbriao(null);
          }
        }}
        embriao={classificarEmbriao}
        classificacao={classificarData.classificacao}
        onClassificacaoChange={(v) => setClassificarData({ classificacao: v })}
        onSubmit={handleClassificar}
        submitting={submitting}
      />

      <ClassificarDialogBatch
        open={showClassificarDialog && !classificarEmbriao && embrioesSelecionados.size > 0}
        onOpenChange={(open) => !open && setShowClassificarDialog(false)}
        count={embrioesSelecionados.size}
        classificacao={classificarData.classificacao}
        onClassificacaoChange={(v) => setClassificarData({ classificacao: v })}
        onSubmit={handleClassificarEmMassa}
        submitting={submitting}
      />

      <CongelarDialog
        open={showCongelarDialog}
        onOpenChange={setShowCongelarDialog}
        count={embrioesSelecionados.size}
        data={congelarData}
        clientes={clientes}
        onDataChange={setCongelarData}
        onSubmit={handleCongelarEmMassa}
        submitting={submitting}
      />

      <DescartarDialog
        open={showDescartarDialog}
        onOpenChange={setShowDescartarDialog}
        count={embrioesSelecionados.size}
        data={descartarData}
        onDataChange={setDescartarData}
        onSubmit={handleDescartarEmMassa}
        submitting={submitting}
      />

      <EditarFazendasDestinoDialog
        open={showEditarFazendasDestinoDialog}
        onOpenChange={(open) => {
          setShowEditarFazendasDestinoDialog(open);
          if (!open) setPacoteEditandoFazendas(null);
        }}
        pacote={pacoteEditandoFazendas}
        fazendas={fazendas}
        fazendasSelecionadas={fazendasDestinoSelecionadas}
        onFazendasChange={setFazendasDestinoSelecionadas}
        onSubmit={handleSalvarFazendasDestino}
        submitting={submitting}
      />
    </div>
  );
}
