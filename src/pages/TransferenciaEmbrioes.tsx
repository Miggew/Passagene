import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PageHeader from '@/components/shared/PageHeader';
import { useTransferenciaEmbrioesData } from '@/hooks/useTransferenciaEmbrioesData';
import { useTransferenciaEmbrioesFilters } from '@/hooks/useTransferenciaEmbrioesFilters';
import { useTransferenciaHandlers } from '@/hooks/useTransferenciaHandlers';
import RelatorioTransferenciaDialog from '@/components/transferencia/RelatorioTransferenciaDialog';
import { TransferenciaEmbrioesFilters } from '@/components/transferencia/TransferenciaEmbrioesFilters';
import { TransferenciaSessao } from '@/components/transferencia/TransferenciaSessao';
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
import { DataTable } from '@/components/shared/DataTable';
import { useToast } from '@/hooks/use-toast';
import { todayISO as getTodayDateString } from '@/lib/dateUtils';
import {
  TransferenciaFormData,
  CamposPacote,
} from '@/lib/types/transferenciaEmbrioes';

const EMBRIOES_PAGE_SIZE = 20;

// Interface para histórico de TE
interface HistoricoTE {
  id: string;
  receptora_id: string;
  receptora_brinco: string;
  receptora_nome?: string;
  fazenda_nome: string;
  fazenda_id?: string;
  data_te: string;
  embriao_identificacao?: string;
  doadora_registro?: string;
  touro_nome?: string;
  tipo_te: string;
  veterinario_responsavel?: string;
  tecnico_responsavel?: string;
  observacoes?: string;
}

interface FazendaComCliente {
  id: string;
  nome: string;
  cliente: { nome: string };
  cliente_id?: string;
}

// Interface para sessão de TE agrupada
interface SessaoTE {
  id: string;
  fazenda_nome: string;
  fazenda_id: string;
  data_te: string;
  veterinario_responsavel?: string;
  tecnico_responsavel?: string;
  total_receptoras: number;
  total_embrioes: number;
  frescos: number;
  congelados: number;
  transferencias: HistoricoTE[];
}

export default function TransferenciaEmbrioes() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Estados locais do formulário
  const [formData, setFormData] = useState<TransferenciaFormData>({
    fazenda_id: '',
    pacote_id: '',
    protocolo_id: '',
    receptora_id: '',
    protocolo_receptora_id: '',
    embriao_id: '',
    data_te: getTodayDateString(),
    veterinario_responsavel: '',
    tecnico_responsavel: '',
    observacoes: '',
  });

  const [camposPacote, setCamposPacote] = useState<CamposPacote>({
    data_te: '',
    veterinario_responsavel: '',
    tecnico_responsavel: '',
  });

  // Estado de submissão
  const [submitting, setSubmitting] = useState(false);

  // Estado para permitir 2º embrião (caso raro ~3%)
  const [permitirSegundoEmbriao, setPermitirSegundoEmbriao] = useState(false);


  // Estados para dialog de sessão em andamento
  const [showRestaurarDialog, setShowRestaurarDialog] = useState(false);
  const [sessaoPendente, setSessaoPendente] = useState<{
    filtros: { fazenda_id?: string; origemEmbriao?: string; filtroClienteId?: string; filtroRaca?: string; data_passo2?: string; embrioes_page?: number };
    camposPacote: CamposPacote;
    formData: Partial<TransferenciaFormData>;
    transferenciasIds?: string[];
  } | null>(null);

  // Hook de filtros e UI
  const {
    origemEmbriao,
    setOrigemEmbriao,
    filtroClienteId,
    setFiltroClienteId,
    filtroRaca,
    setFiltroRaca,
    dataPasso2,
    setDataPasso2,
    embrioesPage,
    setEmbrioesPage,
    showRelatorioDialog,
    setShowRelatorioDialog,
    relatorioData,
    setRelatorioData,
    isVisualizacaoApenas,
    setIsVisualizacaoApenas,
    resetAll: resetFiltros,
    aplicarFiltrosSessao,
    fecharRelatorio,
  } = useTransferenciaEmbrioesFilters();

  // Hook de dados
  const {
    fazendas,
    clientes,
    pacotes,
    pacotesFiltrados,
    embrioesCongelados,
    receptoras,
    setReceptoras,
    loading,
    loadingCongelados,
    transferenciasSessao,
    setTransferenciasSessao,
    transferenciasIdsSessao,
    setTransferenciasIdsSessao,
    contagemSessaoPorReceptora,
    setContagemSessaoPorReceptora,
    receptorasSessaoInfo,
    setReceptorasSessaoInfo,
    loadFazendas,
    loadPacotes,
    loadClientes,
    loadEmbrioesCongelados,
    carregarReceptorasDaFazenda,
    recarregarReceptoras,
    salvarSessaoNoBanco,
    encerrarSessaoNoBanco,
    restaurarSessaoEmAndamento,
  } = useTransferenciaEmbrioesData({
    dataPasso2,
    filtroClienteId,
    filtroRaca,
    formData,
  });

  // Computed values (needed for handlers hook)
  const pacoteSelecionado = pacotes.find(p => p.id === formData.pacote_id);
  const embrioesDisponiveis = useMemo(() => {
    return pacoteSelecionado?.embrioes.filter((e: any) => e.status_atual === 'FRESCO') || [];
  }, [pacoteSelecionado]);
  const hasD8Limite = embrioesDisponiveis.some((e: any) => e.d8_limite);

  const numerosFixosEffectRuns = useRef(0);
  const numerosFixosMap = useMemo(() => {
    if (!formData.pacote_id || !pacoteSelecionado) {
      return new Map<string, number>();
    }
    const ordenados = [...embrioesDisponiveis].sort((a: any, b: any) => {
      const doadoraA = a.doadora_registro || '';
      const doadoraB = b.doadora_registro || '';
      if (doadoraA !== doadoraB) return doadoraA.localeCompare(doadoraB);
      const dataA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dataB = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (dataA !== dataB) return dataA - dataB;
      return (a.id || '').localeCompare(b.id || '');
    });
    const numerosMap = new Map<string, number>();
    ordenados.forEach((embriao: any, index: number) => {
      numerosMap.set(embriao.id, index + 1);
    });
    return numerosMap;
  }, [formData.pacote_id, pacoteSelecionado, embrioesDisponiveis]);

  // Hook de handlers
  const {
    handleDescartarReceptora,
    handleSubmit,
    visualizarRelatorioSessao,
    handleEncerrarSessao,
  } = useTransferenciaHandlers({
    formData,
    setFormData,
    origemEmbriao,
    receptoras,
    contagemSessaoPorReceptora,
    setContagemSessaoPorReceptora,
    receptorasSessaoInfo,
    setReceptorasSessaoInfo,
    transferenciasSessao,
    setTransferenciasSessao,
    transferenciasIdsSessao,
    setTransferenciasIdsSessao,
    numerosFixosMap,
    setSubmitting,
    setRelatorioData,
    setShowRelatorioDialog,
    setIsVisualizacaoApenas,
    resetFiltros,
    loadPacotes,
    loadEmbrioesCongelados,
    recarregarReceptoras,
    encerrarSessaoNoBanco,
  });

  // Salvar estado da sessão
  const salvarEstadoSessao = () => {
    const estadoSessao = {
      fazenda_id: formData.fazenda_id,
      pacote_id: formData.pacote_id,
      data_passo2: dataPasso2,
      data_te: formData.data_te,
      veterinario_responsavel: formData.veterinario_responsavel,
      tecnico_responsavel: formData.tecnico_responsavel,
      origem_embriao: origemEmbriao,
      filtro_cliente_id: filtroClienteId,
      filtro_raca: filtroRaca,
      transferenciasSessao,
      transferenciasIdsSessao,
      embrioes_page: embrioesPage,
    };
    void salvarSessaoNoBanco(estadoSessao);
  };



  // Local handlers
  const handleFazendaChange = async (fazendaId: string) => {
    if (!fazendaId) {
      setFormData({
        ...formData,
        fazenda_id: '',
        pacote_id: '',
        protocolo_id: '',
        embriao_id: '',
        receptora_id: '',
        protocolo_receptora_id: '',
      });
      setCamposPacote({ data_te: '', veterinario_responsavel: '', tecnico_responsavel: '' });
      setTransferenciasSessao([]);
      setTransferenciasIdsSessao([]);
      setReceptoras([]);
      return;
    }

    setTransferenciasSessao([]);
    setTransferenciasIdsSessao([]);
    setCamposPacote({ data_te: '', veterinario_responsavel: '', tecnico_responsavel: '' });

    await carregarReceptorasDaFazenda(fazendaId);
    setFormData({
      ...formData,
      fazenda_id: fazendaId,
      pacote_id: '',
      protocolo_id: '',
      embriao_id: '',
      receptora_id: '',
      protocolo_receptora_id: '',
    });
  };

  const handlePacoteChange = (pacoteId: string) => {
    const pacote = pacotes.find(p => p.id === pacoteId);

    if (pacote?.pacote_info?.veterinario_responsavel && !formData.veterinario_responsavel) {
      setFormData(prev => ({
        ...prev,
        pacote_id: pacoteId,
        veterinario_responsavel: pacote.pacote_info.veterinario_responsavel || '',
      }));
      setCamposPacote(prev => ({
        ...prev,
        veterinario_responsavel: pacote.pacote_info.veterinario_responsavel || '',
      }));
    } else {
      setFormData(prev => ({ ...prev, pacote_id: pacoteId }));
    }
  };

  // Funções para o dialog de sessão em andamento
  const handleRestaurarSessao = async () => {
    if (sessaoPendente) {
      const dataPasso2Sessao = sessaoPendente.filtros.data_passo2 || '';
      const fazendaIdSessao = sessaoPendente.formData.fazenda_id || '';
      const pacoteIdSalvo = sessaoPendente.formData.pacote_id || '';
      const transferenciasIds = sessaoPendente.transferenciasIds || [];

      aplicarFiltrosSessao(sessaoPendente.filtros);
      setCamposPacote(sessaoPendente.camposPacote);

      const [, pacotesCarregados] = await Promise.all([
        loadFazendas(dataPasso2Sessao),
        loadPacotes()
      ]);

      let pacoteIdReconstruido = '';
      if (pacoteIdSalvo && pacotesCarregados && pacotesCarregados.length > 0) {
        if (transferenciasIds.length > 0) {
          try {
            const { data: transferenciasComEmbriao } = await supabase
              .from('transferencias_embrioes')
              .select('embriao_id, embrioes(lote_fiv_id, created_at)')
              .in('id', transferenciasIds)
              .limit(1);

            if (transferenciasComEmbriao && transferenciasComEmbriao.length > 0) {
              const embriao = Array.isArray(transferenciasComEmbriao[0].embrioes)
                ? transferenciasComEmbriao[0].embrioes[0]
                : (transferenciasComEmbriao[0].embrioes as any);

              if (embriao?.lote_fiv_id && embriao?.created_at) {
                const dataDespacho = embriao.created_at.split('T')[0];
                const pacoteIdInferido = `${embriao.lote_fiv_id}-${dataDespacho}`;
                const pacoteExato = pacotesCarregados.find(p => p.id === pacoteIdInferido);
                if (pacoteExato) {
                  pacoteIdReconstruido = pacoteExato.id;
                }
              }
            }
          } catch (error) {
            console.error('Erro ao inferir pacote da sessão:', error);
          }
        }

        if (!pacoteIdReconstruido) {
          const pacotesDaFazenda = fazendaIdSessao
            ? pacotesCarregados.filter(p => p.fazendas_destino_ids.includes(fazendaIdSessao))
            : pacotesCarregados;
          const pacoteEncontrado = pacotesDaFazenda.find(p =>
            p.id.startsWith(pacoteIdSalvo) || p.lote_fiv_id === pacoteIdSalvo
          );
          if (pacoteEncontrado) {
            pacoteIdReconstruido = pacoteEncontrado.id;
          }
        }
      }

      setFormData(prev => ({
        ...prev,
        ...sessaoPendente.formData,
        pacote_id: pacoteIdReconstruido || pacoteIdSalvo,
        embriao_id: '',
        receptora_id: '',
        protocolo_receptora_id: '',
        observacoes: '',
      }));

      if (fazendaIdSessao) {
        await carregarReceptorasDaFazenda(fazendaIdSessao, {
          contagem: contagemSessaoPorReceptora,
          info: receptorasSessaoInfo,
        });
      }

      toast({
        title: 'Sessão restaurada',
        description: 'Continuando de onde você parou.',
      });
    }
    setShowRestaurarDialog(false);
    setSessaoPendente(null);
  };

  const handleDescartarSessao = async () => {
    if (sessaoPendente?.filtros?.fazenda_id) {
      await encerrarSessaoNoBanco(sessaoPendente.filtros.fazenda_id);
    }
    setShowRestaurarDialog(false);
    setSessaoPendente(null);
    toast({
      title: 'Sessão descartada',
      description: 'Uma nova sessão será iniciada.',
    });
  };

  // Effects
  useEffect(() => {
    const carregarDados = async () => {
      await Promise.all([loadFazendas(), loadPacotes(), loadClientes()]);
      const sessaoRestaurada = await restaurarSessaoEmAndamento();
      // Ajuste de tipagem para sessaoRestaurada se necessario
      if (sessaoRestaurada) {
        // Garantir compatibilidade de tipos
        const sessaoCompativel = {
          filtros: sessaoRestaurada.filtros,
          camposPacote: sessaoRestaurada.camposPacote,
          formData: sessaoRestaurada.formData,
          transferenciasIds: (sessaoRestaurada as any).transferenciasIds || []
        };
        setSessaoPendente(sessaoCompativel);
        setShowRestaurarDialog(true);
      }
    };
    carregarDados();
  }, []);

  useEffect(() => {
    if (formData.fazenda_id || formData.pacote_id || transferenciasIdsSessao.length > 0) {
      salvarEstadoSessao();
    }
  }, [formData.fazenda_id, formData.pacote_id, formData.protocolo_id, formData.data_te, formData.veterinario_responsavel, formData.tecnico_responsavel, origemEmbriao, filtroClienteId, filtroRaca, dataPasso2, transferenciasSessao.length, transferenciasIdsSessao.length, embrioesPage]);

  useEffect(() => {
    void loadFazendas();
  }, [dataPasso2]);

  useEffect(() => {
    if (formData.fazenda_id) {
      const temSessaoAtiva = transferenciasIdsSessao.length > 0;

      if (temSessaoAtiva) {
        carregarReceptorasDaFazenda(formData.fazenda_id, {
          contagem: contagemSessaoPorReceptora,
          info: receptorasSessaoInfo,
        });
      } else {
        carregarReceptorasDaFazenda(formData.fazenda_id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.fazenda_id, dataPasso2]);

  useEffect(() => {
    if (origemEmbriao === 'CONGELADO' && (filtroClienteId || filtroRaca.trim())) {
      loadEmbrioesCongelados();
    }
  }, [origemEmbriao, filtroClienteId, filtroRaca]);

  useEffect(() => {
    setEmbrioesPage(1);
  }, [formData.pacote_id]);

  useEffect(() => {
    if (origemEmbriao === 'CONGELADO') {
      setEmbrioesPage(1);
      setFormData(prev => ({ ...prev, embriao_id: '' }));
    }
  }, [origemEmbriao, filtroClienteId, filtroRaca]);

  useEffect(() => {
    if (!formData.pacote_id || !pacoteSelecionado) return;
    numerosFixosEffectRuns.current += 1;
  }, [formData.pacote_id, pacoteSelecionado, numerosFixosMap]);

  useEffect(() => {
    const totalPaginas = Math.max(1, Math.ceil(embrioesDisponiveis.length / EMBRIOES_PAGE_SIZE));
    if (embrioesPage > totalPaginas) {
      setEmbrioesPage(totalPaginas);
    }
  }, [embrioesDisponiveis.length, embrioesPage]);


  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transferência de Embriões (TE)"
        description="Destinar embriões para receptoras sincronizadas"
      />

      <TransferenciaEmbrioesFilters
        formData={formData}
        setFormData={setFormData}
        camposPacote={camposPacote}
        setCamposPacote={setCamposPacote}
        origemEmbriao={origemEmbriao}
        setOrigemEmbriao={setOrigemEmbriao}
        filtroClienteId={filtroClienteId}
        setFiltroClienteId={setFiltroClienteId}
        filtroRaca={filtroRaca}
        setFiltroRaca={setFiltroRaca}
        dataPasso2={dataPasso2}
        setDataPasso2={setDataPasso2}
        clientes={clientes}
        resetFiltros={resetFiltros}
      />

      <TransferenciaSessao
        formData={formData}
        setFormData={setFormData}
        camposPacote={camposPacote}
        setCamposPacote={setCamposPacote}
        fazendas={fazendas as unknown as FazendaComCliente[]}
        pacotesFiltrados={pacotesFiltrados}
        embrioesCongelados={embrioesCongelados}
        origemEmbriao={origemEmbriao}
        loadingCongelados={loadingCongelados}
        pacoteSelecionado={pacoteSelecionado}
        hasD8Limite={hasD8Limite}
        embrioesDisponiveis={embrioesDisponiveis}
        permitirSegundoEmbriao={permitirSegundoEmbriao}
        setPermitirSegundoEmbriao={setPermitirSegundoEmbriao}
        handleFazendaChange={handleFazendaChange}
        handlePacoteChange={handlePacoteChange}
        onSelectReceptora={(id, protocoloId) => setFormData(prev => ({ ...prev, receptora_id: id, protocolo_receptora_id: protocoloId }))}
        filtroClienteId={filtroClienteId}
        filtroRaca={filtroRaca}
        receptoras={receptoras} // TODO: Filtrar por pesquisa se necessario
        contagemSessaoPorReceptora={contagemSessaoPorReceptora}
        receptorasSessaoInfo={receptorasSessaoInfo}
        transferenciasIdsSessao={transferenciasIdsSessao}
        handleDescartarReceptora={handleDescartarReceptora}
        numerosFixosMap={numerosFixosMap}
        embrioesPage={embrioesPage}
        setEmbrioesPage={setEmbrioesPage}
        EMBRIOES_PAGE_SIZE={EMBRIOES_PAGE_SIZE}
        handleSubmit={handleSubmit}
        submitting={submitting}
        clienteIds={[]} // Passar se necessario para filtros extras
        receptora_id={formData.receptora_id}
        onSelectEmbriao={(id) => setFormData(prev => ({ ...prev, embriao_id: id }))}
      />

      {/* Dialog de Confirmação de Relatório (Sessão Atual) */}
      <RelatorioTransferenciaDialog
        open={showRelatorioDialog}
        onOpenChange={setShowRelatorioDialog}
        relatorioData={relatorioData}
        fazendaNome={fazendas.find(f => f.id === formData.fazenda_id)?.nome || ''}
        dataTe={formData.data_te}
        veterinarioResponsavel={formData.veterinario_responsavel}
        tecnicoResponsavel={formData.tecnico_responsavel}
        isVisualizacaoApenas={isVisualizacaoApenas}
        submitting={submitting}
        onFechar={() => setShowRelatorioDialog(false)}
        onConfirmarEncerrar={handleEncerrarSessao}
      />

      {/* Dialog para Restaurar Sessão */}
      <AlertDialog open={showRestaurarDialog} onOpenChange={setShowRestaurarDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sessão em Andamento Encontrada</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem uma sessão de transferência não finalizada para a fazenda{' '}
              <span className="font-semibold text-foreground">
                {fazendas.find(f => f.id === sessaoPendente?.formData?.fazenda_id)?.nome || 'Desconhecida'}
              </span>
              . Deseja continuar de onde parou?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDescartarSessao}>Descartar e Iniciar Nova</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestaurarSessao}>Continuar Sessão</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
