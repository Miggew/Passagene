import { useEffect, useState } from 'react';
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
  DirecionarClienteDialog,
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
    showDirecionarClienteDialog,
    setShowDirecionarClienteDialog,
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
    pacoteEditandoFazendas,
    setPacoteEditandoFazendas,
    fazendasDestinoSelecionadas,
    setFazendasDestinoSelecionadas,
    submitting,
    handleCongelarEmMassa,
    handleDescartarEmMassa,
    handleDirecionarClienteEmMassa,
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
    <div className={`space-y-6 ${showAcoesEmMassa ? 'pb-24' : ''}`}>
      <PageHeader
        title="Estoque de Embriões"
        description="Gerenciar pacotes de embriões para transferência, congelamento ou descarte"
      />

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-lg border shadow-sm">
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
        <div className="text-sm text-slate-500">
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
            />
          ))}
        </div>
      )}

      {/* Bulk Actions Bar */}
      {showAcoesEmMassa && (
        <BulkActionsBar
          selectedCount={embrioesSelecionados.size}
          onClassificar={() => {
            setClassificarData({ classificacao: '' });
            setShowClassificarDialog(true);
          }}
          onCongelar={() => {
            setCongelarData({
              data_congelamento: new Date().toISOString().split('T')[0],
              localizacao_atual: '',
            });
            setShowCongelarDialog(true);
          }}
          onDirecionar={() => {
            setDirecionarClienteData({ cliente_id: '' });
            setShowDirecionarClienteDialog(true);
          }}
          onDescartar={() => {
            setDescartarData({
              data_descarte: new Date().toISOString().split('T')[0],
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

      <DirecionarClienteDialog
        open={showDirecionarClienteDialog}
        onOpenChange={setShowDirecionarClienteDialog}
        clientes={clientes}
        data={direcionarClienteData}
        onDataChange={setDirecionarClienteData}
        onSubmit={() => handleDirecionarClienteEmMassa(clientes)}
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
