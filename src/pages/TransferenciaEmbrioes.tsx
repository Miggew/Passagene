import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { SupabaseError } from '@/lib/types';
import { buscarDadosGenealogia } from '@/lib/dataEnrichment';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PageHeader from '@/components/shared/PageHeader';
import { useToast } from '@/hooks/use-toast';
import { useTransferenciaEmbrioesData } from '@/hooks/useTransferenciaEmbrioesData';
import { validarTransicaoStatus } from '@/lib/receptoraStatus';
import { ArrowRightLeft, AlertTriangle, FileText, X, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import StatusBadge from '@/components/shared/StatusBadge';
import CiclandoBadge from '@/components/shared/CiclandoBadge';
import QualidadeSemaforo from '@/components/shared/QualidadeSemaforo';
import { formatDate } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import DatePickerBR from '@/components/shared/DatePickerBR';
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
  DialogFooter,
} from '@/components/ui/dialog';
import {
  TransferenciaFormData,
  CamposPacote,
  RelatorioTransferenciaItem,
  TransferenciaRelatorioData,
  ReceptoraSincronizada,
} from '@/lib/types/transferenciaEmbrioes';

const EMBRIOES_PAGE_SIZE = 20;

export default function TransferenciaEmbrioes() {
  const { toast } = useToast();

  // Estados locais do formulário
  const [formData, setFormData] = useState<TransferenciaFormData>({
    fazenda_id: '',
    pacote_id: '',
    protocolo_id: '',
    receptora_id: '',
    protocolo_receptora_id: '',
    embriao_id: '',
    data_te: new Date().toISOString().split('T')[0],
    veterinario_responsavel: '',
    tecnico_responsavel: '',
    observacoes: '',
  });

  const [camposPacote, setCamposPacote] = useState<CamposPacote>({
    data_te: '',
    veterinario_responsavel: '',
    tecnico_responsavel: '',
  });

  // Estados de filtros e UI
  const [origemEmbriao, setOrigemEmbriao] = useState<'PACOTE' | 'CONGELADO'>('PACOTE');
  const [filtroClienteId, setFiltroClienteId] = useState('');
  const [filtroRaca, setFiltroRaca] = useState('');
  const [dataPasso2, setDataPasso2] = useState('');
  const [incluirCioLivre, setIncluirCioLivre] = useState(false);
  const [embrioesPage, setEmbrioesPage] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [showRelatorioDialog, setShowRelatorioDialog] = useState(false);
  const [relatorioData, setRelatorioData] = useState<RelatorioTransferenciaItem[]>([]);
  const [isVisualizacaoApenas, setIsVisualizacaoApenas] = useState(false);

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
    incluirCioLivre,
    origemEmbriao,
    filtroClienteId,
    filtroRaca,
    formData,
    setFormData,
    camposPacote,
    setCamposPacote,
    setOrigemEmbriao,
    setFiltroClienteId,
    setFiltroRaca,
    setDataPasso2,
    setIncluirCioLivre,
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
      incluir_cio_livre: incluirCioLivre,
      transferenciasSessao,
      transferenciasIdsSessao,
      embrioes_page: embrioesPage,
    };
    void salvarSessaoNoBanco(estadoSessao);
  };

  // Effects
  useEffect(() => {
    const carregarDados = async () => {
      await Promise.all([loadFazendas(), loadPacotes(), loadClientes()]);
      await restaurarSessaoEmAndamento();
    };
    carregarDados();
  }, []);

  useEffect(() => {
    if (formData.fazenda_id || formData.pacote_id || transferenciasIdsSessao.length > 0) {
      salvarEstadoSessao();
    }
  }, [formData.fazenda_id, formData.pacote_id, formData.protocolo_id, formData.data_te, formData.veterinario_responsavel, formData.tecnico_responsavel, origemEmbriao, filtroClienteId, filtroRaca, dataPasso2, incluirCioLivre, transferenciasSessao.length, transferenciasIdsSessao.length, embrioesPage]);

  useEffect(() => {
    void loadFazendas();
  }, [dataPasso2]);

  useEffect(() => {
    if (formData.fazenda_id) {
      carregarReceptorasDaFazenda(formData.fazenda_id);
    }
  }, [formData.fazenda_id, dataPasso2, incluirCioLivre]);

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

  // Handlers
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

  const handleDescartarReceptora = async () => {
    if (!formData.receptora_id) {
      toast({
        title: 'Nenhuma receptora selecionada',
        description: 'Selecione uma receptora para descartar.',
        variant: 'destructive',
      });
      return;
    }

    const receptoraSelecionada = receptoras.find(r => r.receptora_id === formData.receptora_id);
    const brincoReceptora = receptoraSelecionada?.brinco || formData.receptora_id;
    const origemReceptora = receptoraSelecionada?.origem || 'PROTOCOLO';

    try {
      setSubmitting(true);

      if (origemReceptora === 'CIO_LIVRE') {
        const { error: cioLivreError } = await supabase
          .from('cio_livre')
          .update({ status: 'DESCARTADA' })
          .eq('receptora_id', formData.receptora_id)
          .eq('status', 'DISPONIVEL');

        if (cioLivreError) throw cioLivreError;
      } else if (formData.protocolo_receptora_id) {
        const { error: prError } = await supabase
          .from('protocolo_receptoras')
          .update({
            status: 'INAPTA',
            motivo_inapta: 'Descartada no menu de TE - não recebeu embrião'
          })
          .eq('id', formData.protocolo_receptora_id);

        if (prError) throw prError;
      }

      if (formData.receptora_id) {
        await supabase
          .from('receptoras')
          .update({ status_reprodutivo: 'VAZIA' })
          .eq('id', formData.receptora_id);
      }

      toast({
        title: 'Receptora descartada',
        description: origemReceptora === 'CIO_LIVRE'
          ? `${brincoReceptora} foi descartada e saiu da lista de cio livre.`
          : `${brincoReceptora} foi descartada e não receberá embrião neste protocolo.`,
      });

      setFormData({ ...formData, receptora_id: '', protocolo_receptora_id: '' });

      if (formData.fazenda_id) {
        await recarregarReceptoras(formData.fazenda_id);
      }
    } catch (error) {
      toast({
        title: 'Erro ao descartar receptora',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const requerPacote = origemEmbriao === 'PACOTE';

    if (!formData.embriao_id) {
      toast({
        title: 'Embrião não selecionado',
        description: 'Por favor, selecione um embrião para realizar a transferência.',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.fazenda_id || !formData.receptora_id || !formData.data_te || (requerPacote && !formData.pacote_id)) {
      toast({
        title: 'Erro de validação',
        description: 'Todos os campos obrigatórios devem ser preenchidos',
        variant: 'destructive',
      });
      return;
    }

    const receptoraSelecionada = receptoras.find(r => r.receptora_id === formData.receptora_id);

    if (!receptoraSelecionada) {
      toast({
        title: 'Receptora não disponível',
        description: 'A receptora selecionada não está disponível para transferência.',
        variant: 'destructive',
      });
      return;
    }

    const quantidadeSessao = contagemSessaoPorReceptora[formData.receptora_id] || 0;
    const permitirSegundaTe = quantidadeSessao === 1;

    if (quantidadeSessao >= 2) {
      toast({
        title: 'Limite atingido',
        description: 'Esta receptora já recebeu o máximo de 2 embriões permitidos.',
        variant: 'destructive',
      });
      return;
    }

    if (formData.receptora_id && !permitirSegundaTe) {
      const statusBase = receptoraSelecionada.status_reprodutivo || 'VAZIA';
      const statusAtual = receptoraSelecionada.origem === 'CIO_LIVRE' ? 'SINCRONIZADA' : statusBase;
      const validacao = validarTransicaoStatus(statusAtual, 'REALIZAR_TE');

      if (!validacao.valido) {
        toast({
          title: 'Erro de validação',
          description: validacao.mensagem || 'A receptora não pode receber embrião no estado atual',
          variant: 'destructive',
        });
        return;
      }
    }

    if (!formData.veterinario_responsavel || formData.veterinario_responsavel.trim() === '') {
      toast({
        title: 'Erro de validação',
        description: 'Veterinário responsável é obrigatório. Por favor, informe o nome do veterinário.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const insertData: Record<string, string | null> = {
        embriao_id: formData.embriao_id,
        receptora_id: formData.receptora_id,
        protocolo_receptora_id: formData.protocolo_receptora_id || null,
        data_te: formData.data_te,
        tipo_te: origemEmbriao === 'CONGELADO' ? 'CONGELADO' : 'FRESCO',
        veterinario_responsavel: formData.veterinario_responsavel.trim(),
        tecnico_responsavel: formData.tecnico_responsavel?.trim() || null,
        status_te: 'REALIZADA',
        observacoes: formData.observacoes?.trim() || null,
      };

      const { data: teData, error: teError } = await supabase.from('transferencias_embrioes').insert([insertData]).select('id');

      if (teError) {
        if (teError.code === '23505' && teError.message?.includes('unq_embriao_te_realizada')) {
          if (origemEmbriao === 'CONGELADO') {
            loadEmbrioesCongelados();
          } else {
            loadPacotes();
          }
          return;
        }
        throw teError;
      }

      if (teData && teData[0]?.id) {
        setTransferenciasIdsSessao(prev => [...prev, teData[0].id]);
      }

      await supabase
        .from('embrioes')
        .update({ status_atual: 'TRANSFERIDO' })
        .eq('id', formData.embriao_id);

      if (formData.protocolo_receptora_id) {
        setTransferenciasSessao(prev => {
          if (!prev.includes(formData.protocolo_receptora_id)) {
            return [...prev, formData.protocolo_receptora_id];
          }
          return prev;
        });
      }

      const novaContagem = { ...contagemSessaoPorReceptora };
      novaContagem[formData.receptora_id] = (novaContagem[formData.receptora_id] || 0) + 1;
      setContagemSessaoPorReceptora(novaContagem);

      const novaInfo = { ...receptorasSessaoInfo };
      novaInfo[formData.receptora_id] = {
        ...receptoraSelecionada,
        quantidade_embrioes: novaContagem[formData.receptora_id],
      };
      setReceptorasSessaoInfo(novaInfo);

      toast({
        title: 'Transferência registrada',
        description: `Embrião transferido para ${receptoraSelecionada.brinco} com sucesso.`,
      });

      setFormData(prev => ({
        ...prev,
        embriao_id: '',
        receptora_id: '',
        protocolo_receptora_id: '',
        observacoes: '',
      }));

      if (origemEmbriao === 'CONGELADO') {
        loadEmbrioesCongelados();
      } else {
        loadPacotes();
      }

      if (formData.fazenda_id) {
        await recarregarReceptoras(formData.fazenda_id, { contagem: novaContagem, info: novaInfo });
      }
    } catch (error) {
      toast({
        title: 'Erro ao registrar transferência',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const visualizarRelatorioSessao = async () => {
    if (transferenciasIdsSessao.length === 0) {
      toast({
        title: 'Nenhuma transferência na sessão',
        description: 'Não há transferências para visualizar.',
        variant: 'destructive',
      });
      return;
    }

    setIsVisualizacaoApenas(true);
    await gerarRelatorioSessao(true);
  };

  const gerarRelatorioSessao = async (apenasVisualizacao: boolean = false) => {
    const temTransferencias = transferenciasIdsSessao.length > 0;

    if (!temTransferencias) {
      if (!apenasVisualizacao) {
        toast({
          title: 'Nenhuma transferência na sessão',
          description: 'Não há transferências para gerar relatório.',
          variant: 'destructive',
        });
      }
      return;
    }

    try {
      const { data: transferenciasData, error: teError } = await supabase
        .from('transferencias_embrioes')
        .select(`
          *,
          embrioes (id, identificacao, classificacao, status_atual, lote_fiv_id, lote_fiv_acasalamento_id),
          receptoras (id, identificacao, nome)
        `)
        .in('id', transferenciasIdsSessao)
        .eq('status_te', 'REALIZADA')
        .order('created_at', { ascending: true });

      if (teError) throw teError;

      if (!transferenciasData || transferenciasData.length === 0) {
        toast({
          title: 'Erro ao gerar relatório',
          description: 'Não foi possível encontrar as transferências da sessão.',
          variant: 'destructive',
        });
        return;
      }

      const acasalamentoIds = transferenciasData
        .map(t => t.embrioes?.lote_fiv_acasalamento_id)
        .filter((id): id is string => !!id);

      const { doadorasMap, tourosMap } = await buscarDadosGenealogia(acasalamentoIds);

      const relatorio = (transferenciasData as TransferenciaRelatorioData[]).map((t) => {
        const acasalamentoId = t.embrioes?.lote_fiv_acasalamento_id;
        const doadoraRegistro = acasalamentoId ? (doadorasMap.get(acasalamentoId) || 'N/A') : 'N/A';
        const touroNome = acasalamentoId ? (tourosMap.get(acasalamentoId) || 'N/A') : 'N/A';
        const numeroEmbriao = t.embrioes?.identificacao
          || (numerosFixosMap && numerosFixosMap.get(t.embriao_id || '') ? String(numerosFixosMap.get(t.embriao_id || '')) : null)
          || (t.embriao_id ? t.embriao_id.substring(0, 8) : 'N/A');

        const item: RelatorioTransferenciaItem = {
          numero_embriao: numeroEmbriao,
          doadora: doadoraRegistro,
          touro: touroNome,
          classificacao: t.embrioes?.classificacao || 'N/A',
          receptora_brinco: t.receptoras?.identificacao || 'N/A',
          receptora_nome: t.receptoras?.nome || 'N/A',
          data_te: t.data_te,
          veterinario: t.veterinario_responsavel || 'N/A',
          tecnico: t.tecnico_responsavel || 'N/A',
          observacoes: t.observacoes || '',
        };
        return item;
      });

      setRelatorioData(relatorio);
      setShowRelatorioDialog(true);
    } catch (error) {
      toast({
        title: 'Erro ao gerar relatório',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      setIsVisualizacaoApenas(false);
    }
  };

  const handleEncerrarSessao = async () => {
    if (transferenciasIdsSessao.length === 0) {
      toast({
        title: 'Nenhuma transferência na sessão',
        description: 'Não há transferências para encerrar nesta sessão.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      let protocoloIdsParaEncerrar = [...transferenciasSessao];
      if (protocoloIdsParaEncerrar.length === 0) {
        const { data: transferenciasSessaoData, error: transferenciasSessaoError } = await supabase
          .from('transferencias_embrioes')
          .select('protocolo_receptora_id')
          .in('id', transferenciasIdsSessao);
        if (transferenciasSessaoError) throw transferenciasSessaoError;
        protocoloIdsParaEncerrar = [...new Set(
          (transferenciasSessaoData || [])
            .map(t => t.protocolo_receptora_id)
            .filter((id): id is string => !!id)
        )];
      }

      const { data: transferenciasData, error: teError } = await supabase
        .from('transferencias_embrioes')
        .select('receptora_id')
        .in('id', transferenciasIdsSessao)
        .eq('status_te', 'REALIZADA');

      if (teError) throw teError;
      const receptoraIds = [...new Set((transferenciasData || []).map(t => t.receptora_id).filter(Boolean))];
      if (receptoraIds.length === 0) {
        throw new Error('Nenhuma receptora encontrada para encerrar a sessão.');
      }

      const { error: rpcError } = await supabase.rpc('encerrar_sessao_te', {
        p_receptora_ids: receptoraIds,
        p_protocolo_receptora_ids: protocoloIdsParaEncerrar,
      });
      if (rpcError) {
        if ((rpcError as SupabaseError)?.code === 'PGRST202') {
          throw new Error('Função encerrar_sessao_te não encontrada no banco. Aplique o SQL em docs/db/003_encerrar_sessao_te.sql e tente novamente.');
        }
        throw rpcError;
      }

      await encerrarSessaoNoBanco(formData.fazenda_id);

      toast({
        title: 'Sessão encerrada',
        description: `${transferenciasIdsSessao.length} transferência(s) finalizada(s) com sucesso.`,
      });

      const fazendaIdAnterior = formData.fazenda_id;

      setFormData({
        fazenda_id: '',
        pacote_id: '',
        protocolo_id: '',
        embriao_id: '',
        receptora_id: '',
        protocolo_receptora_id: '',
        data_te: new Date().toISOString().split('T')[0],
        veterinario_responsavel: '',
        tecnico_responsavel: '',
        observacoes: '',
      });
      setOrigemEmbriao('PACOTE');
      setFiltroClienteId('');
      setFiltroRaca('');
      setCamposPacote({ data_te: '', veterinario_responsavel: '', tecnico_responsavel: '' });
      setTransferenciasSessao([]);
      setTransferenciasIdsSessao([]);
      setContagemSessaoPorReceptora({});
      setReceptorasSessaoInfo({});
      setShowRelatorioDialog(false);
      setRelatorioData([]);
      setEmbrioesPage(1);

      await loadPacotes();
      if (fazendaIdAnterior) {
        await recarregarReceptoras(fazendaIdAnterior);
      }
    } catch (error) {
      toast({
        title: 'Erro ao encerrar sessão',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Computed values
  const pacoteSelecionado = pacotes.find(p => p.id === formData.pacote_id);
  const embrioesDisponiveis = useMemo(() => {
    return pacoteSelecionado?.embrioes.filter(e => e.status_atual === 'FRESCO') || [];
  }, [pacoteSelecionado]);
  const hasD8Limite = embrioesDisponiveis.some(e => e.d8_limite);

  const numerosFixosEffectRuns = useRef(0);
  const numerosFixosMap = useMemo(() => {
    if (!formData.pacote_id || !pacoteSelecionado) {
      return new Map<string, number>();
    }
    const ordenados = [...embrioesDisponiveis].sort((a, b) => {
      const doadoraA = a.doadora_registro || '';
      const doadoraB = b.doadora_registro || '';
      if (doadoraA !== doadoraB) return doadoraA.localeCompare(doadoraB);
      const dataA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dataB = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (dataA !== dataB) return dataA - dataB;
      return (a.id || '').localeCompare(b.id || '');
    });
    const numerosMap = new Map<string, number>();
    ordenados.forEach((embriao, index) => {
      numerosMap.set(embriao.id, index + 1);
    });
    return numerosMap;
  }, [formData.pacote_id, pacoteSelecionado, embrioesDisponiveis]);

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

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5" />
              Nova Transferência
            </CardTitle>
            {formData.fazenda_id && transferenciasIdsSessao.length > 0 && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={visualizarRelatorioSessao}
                  className="bg-slate-600 hover:bg-slate-700"
                  disabled={submitting}
                  variant="default"
                  title="Visualizar relatório da sessão atual sem encerrar"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Visualizar Relatório ({transferenciasIdsSessao.length} transferência{transferenciasIdsSessao.length > 1 ? 's' : ''})
                </Button>
                <Button
                  type="button"
                  onClick={handleEncerrarSessao}
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={submitting}
                  variant="default"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  {submitting ? 'Gerando...' : `Encerrar Sessão (${transferenciasIdsSessao.length} transferência${transferenciasIdsSessao.length > 1 ? 's' : ''})`}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4 border-b pb-6">
              {/* Passo 1: Selecionar Fazenda */}
              <div className="space-y-2">
                <Label htmlFor="fazenda_id">1. Fazenda onde estão as receptoras *</Label>
                <Select value={formData.fazenda_id} onValueChange={handleFazendaChange}>
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

              {/* Passo 2: Selecionar Data do 2º Passo */}
              {formData.fazenda_id && (
                <div className="space-y-2">
                  <Label htmlFor="data_passo2">2. Data do 2º Passo (opcional)</Label>
                  <DatePickerBR
                    id="data_passo2"
                    value={dataPasso2}
                    onChange={(value) => setDataPasso2(value || '')}
                  />
                  {dataPasso2 && (
                    <div className="flex justify-end">
                      <Button type="button" variant="ghost" size="sm" onClick={() => setDataPasso2('')}>
                        Limpar data
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Passo 3: Incluir CIO livre */}
              {formData.fazenda_id && (
                <div className="flex items-center gap-2">
                  <Switch
                    id="incluir-cio-livre"
                    checked={incluirCioLivre}
                    onCheckedChange={setIncluirCioLivre}
                  />
                  <Label htmlFor="incluir-cio-livre" className="cursor-pointer text-sm">
                    Incluir receptoras de CIO livre
                  </Label>
                </div>
              )}

              {/* Passo 4: Origem do Embrião */}
              {formData.fazenda_id && (
                <div className="space-y-2">
                  <Label>3. Origem do Embrião *</Label>
                  <div className="flex gap-4">
                    <Button
                      type="button"
                      variant={origemEmbriao === 'PACOTE' ? 'default' : 'outline'}
                      onClick={() => setOrigemEmbriao('PACOTE')}
                      className={origemEmbriao === 'PACOTE' ? 'bg-green-600 hover:bg-green-700' : ''}
                    >
                      Pacote (Frescos)
                    </Button>
                    <Button
                      type="button"
                      variant={origemEmbriao === 'CONGELADO' ? 'default' : 'outline'}
                      onClick={() => setOrigemEmbriao('CONGELADO')}
                      className={origemEmbriao === 'CONGELADO' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                    >
                      Congelados
                    </Button>
                  </div>
                </div>
              )}

              {/* Seleção de Pacote ou Filtros para Congelados */}
              {formData.fazenda_id && origemEmbriao === 'PACOTE' && (
                <div className="space-y-2">
                  <Label htmlFor="pacote_id">4. Pacote de Embriões *</Label>
                  <Select value={formData.pacote_id} onValueChange={handlePacoteChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o pacote" />
                    </SelectTrigger>
                    <SelectContent>
                      {pacotesFiltrados.map((pacote) => (
                        <SelectItem key={pacote.id} value={pacote.id}>
                          {pacote.pacote_info?.fazenda_nome || 'N/A'} - {formatDate(pacote.data_despacho)} ({pacote.frescos} frescos)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formData.fazenda_id && origemEmbriao === 'CONGELADO' && (
                <div className="space-y-4">
                  <Label>4. Filtros para Embriões Congelados</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="filtro_cliente">Cliente</Label>
                      <Select value={filtroClienteId} onValueChange={setFiltroClienteId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o cliente" />
                        </SelectTrigger>
                        <SelectContent>
                          {clientes.map((cliente) => (
                            <SelectItem key={cliente.id} value={cliente.id}>
                              {cliente.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="filtro_raca">Raça</Label>
                      <Input
                        id="filtro_raca"
                        value={filtroRaca}
                        onChange={(e) => setFiltroRaca(e.target.value)}
                        placeholder="Digite a raça"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Campos comuns */}
              {(formData.pacote_id || origemEmbriao === 'CONGELADO') && formData.fazenda_id && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="data_te">5. Data da TE *</Label>
                    <DatePickerBR
                      id="data_te"
                      value={formData.data_te}
                      onChange={(value) => setFormData({ ...formData, data_te: value || '' })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="veterinario_responsavel">Veterinário Responsável *</Label>
                    <Input
                      id="veterinario_responsavel"
                      value={formData.veterinario_responsavel}
                      onChange={(e) => setFormData({ ...formData, veterinario_responsavel: e.target.value })}
                      placeholder="Nome do veterinário"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tecnico_responsavel">Técnico Responsável</Label>
                    <Input
                      id="tecnico_responsavel"
                      value={formData.tecnico_responsavel}
                      onChange={(e) => setFormData({ ...formData, tecnico_responsavel: e.target.value })}
                      placeholder="Nome do técnico"
                    />
                  </div>
                </div>
              )}

              {/* Seleção de Receptora */}
              {(formData.pacote_id || (origemEmbriao === 'CONGELADO' && (filtroClienteId || filtroRaca.trim()))) && formData.fazenda_id && (
                <div className="space-y-2">
                  <Label>6. Selecionar Receptora *</Label>
                  <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
                    {receptoras.length === 0 ? (
                      <p className="text-sm text-slate-500">Nenhuma receptora sincronizada encontrada para esta fazenda.</p>
                    ) : (
                      <div className="space-y-2">
                        {receptoras.map((r) => {
                          const quantidadeSessao = contagemSessaoPorReceptora[r.receptora_id] || 0;
                          const podeReceber = quantidadeSessao < 2;
                          const isSelected = formData.receptora_id === r.receptora_id;

                          return (
                            <div
                              key={r.receptora_id}
                              className={`flex items-center justify-between p-2 rounded cursor-pointer ${
                                isSelected ? 'bg-green-100 border-green-500 border' : podeReceber ? 'hover:bg-slate-50' : 'opacity-50 cursor-not-allowed'
                              }`}
                              onClick={() => {
                                if (podeReceber) {
                                  setFormData({
                                    ...formData,
                                    receptora_id: r.receptora_id,
                                    protocolo_receptora_id: r.protocolo_receptora_id || '',
                                  });
                                }
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name="receptora"
                                  checked={isSelected}
                                  onChange={() => {}}
                                  disabled={!podeReceber}
                                  className="w-4 h-4"
                                />
                                <span className="font-medium">{r.brinco}</span>
                                {r.origem === 'CIO_LIVRE' && (
                                  <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">CIO LIVRE</Badge>
                                )}
                                {r.ciclando_classificacao && <CiclandoBadge classificacao={r.ciclando_classificacao} />}
                                {r.qualidade_semaforo && <QualidadeSemaforo qualidade={r.qualidade_semaforo} />}
                              </div>
                              <div className="flex items-center gap-2">
                                {quantidadeSessao > 0 && (
                                  <Badge variant="secondary">{quantidadeSessao}/2 embriões</Badge>
                                )}
                                {isSelected && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDescartarReceptora();
                                    }}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    disabled={submitting}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Lista de Embriões - Pacote */}
              {formData.pacote_id && pacoteSelecionado && (
                <div className="space-y-4">
                  <Label>7. Selecionar Embrião do Pacote *</Label>
                  <div className="border rounded-lg p-4">
                    <div className="mb-4">
                      <h3 className="font-semibold text-slate-900">Pacote selecionado</h3>
                      <p className="text-sm text-slate-600">
                        Data Despacho: {formatDate(pacoteSelecionado.data_despacho)} | Total: {pacoteSelecionado.total} embrião(ões)
                      </p>
                      {hasD8Limite && (
                        <div className="mt-2 flex items-center gap-2 text-sm text-amber-700">
                          <AlertTriangle className="w-4 h-4" />
                          Embriões em D8: transferir ou congelar hoje. No D9 serão descartados automaticamente.
                        </div>
                      )}
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12"></TableHead>
                            <TableHead className="text-center w-28">Código</TableHead>
                            <TableHead>Doadora</TableHead>
                            <TableHead>Touro</TableHead>
                            <TableHead>Classificação</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Dia</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(() => {
                            const embrioesOrdenados = [...embrioesDisponiveis].sort((a, b) => {
                              const idA = a.identificacao || '';
                              const idB = b.identificacao || '';
                              if (idA && idB) return idA.localeCompare(idB);
                              if (idA && !idB) return -1;
                              if (!idA && idB) return 1;
                              const numeroA = numerosFixosMap.get(a.id) || 9999;
                              const numeroB = numerosFixosMap.get(b.id) || 9999;
                              return numeroA - numeroB;
                            });

                            const totalPaginas = Math.max(1, Math.ceil(embrioesOrdenados.length / EMBRIOES_PAGE_SIZE));
                            const paginaAtual = Math.min(embrioesPage, totalPaginas);
                            const inicio = (paginaAtual - 1) * EMBRIOES_PAGE_SIZE;
                            const embrioesPagina = embrioesOrdenados.slice(inicio, inicio + EMBRIOES_PAGE_SIZE);

                            return embrioesPagina.map((embriao) => {
                              const numeroFixo = numerosFixosMap.get(embriao.id) || 0;

                              return (
                                <TableRow
                                  key={embriao.id}
                                  className={formData.embriao_id === embriao.id ? 'bg-green-50' : 'cursor-pointer hover:bg-slate-50'}
                                  onClick={() => setFormData({ ...formData, embriao_id: embriao.id })}
                                >
                                  <TableCell>
                                    <input
                                      type="radio"
                                      name="embriao"
                                      value={embriao.id}
                                      checked={formData.embriao_id === embriao.id}
                                      onChange={() => setFormData({ ...formData, embriao_id: embriao.id })}
                                      className="w-4 h-4"
                                    />
                                  </TableCell>
                                  <TableCell className="text-center font-medium font-mono text-xs">
                                    {embriao.identificacao || `#${numeroFixo}`}
                                  </TableCell>
                                  <TableCell>{embriao.doadora_registro || '-'}</TableCell>
                                  <TableCell>{embriao.touro_nome || '-'}</TableCell>
                                  <TableCell>
                                    {embriao.classificacao ? <Badge variant="outline">{embriao.classificacao}</Badge> : <span className="text-slate-400">-</span>}
                                  </TableCell>
                                  <TableCell><StatusBadge status={embriao.status_atual} /></TableCell>
                                  <TableCell>
                                    {embriao.d8_limite ? (
                                      <Badge variant="destructive">D8</Badge>
                                    ) : embriao.d7_pronto ? (
                                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">D7</Badge>
                                    ) : (
                                      <span className="text-slate-400">-</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            });
                          })()}
                        </TableBody>
                      </Table>
                      <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
                        <div>{embrioesDisponiveis.length} embrião(ões) disponíveis</div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setEmbrioesPage(Math.max(1, embrioesPage - 1))}
                            disabled={embrioesPage === 1}
                          >
                            Anterior
                          </Button>
                          <span>
                            Página {Math.min(embrioesPage, Math.max(1, Math.ceil(embrioesDisponiveis.length / EMBRIOES_PAGE_SIZE)))} de {Math.max(1, Math.ceil(embrioesDisponiveis.length / EMBRIOES_PAGE_SIZE))}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const totalPaginas = Math.max(1, Math.ceil(embrioesDisponiveis.length / EMBRIOES_PAGE_SIZE));
                              setEmbrioesPage(Math.min(totalPaginas, embrioesPage + 1));
                            }}
                            disabled={embrioesPage >= Math.max(1, Math.ceil(embrioesDisponiveis.length / EMBRIOES_PAGE_SIZE))}
                          >
                            Próxima
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Lista de Embriões - Congelados */}
              {origemEmbriao === 'CONGELADO' && (
                <div className="space-y-4">
                  <Label>7. Selecionar Embrião Congelado *</Label>
                  <div className="border rounded-lg p-4">
                    {(!filtroClienteId && !filtroRaca.trim()) && (
                      <div className="text-sm text-slate-500">
                        Selecione um cliente ou informe a raça para listar embriões congelados.
                      </div>
                    )}
                    {loadingCongelados && (
                      <div className="text-sm text-slate-500">Carregando embriões congelados...</div>
                    )}
                    {!loadingCongelados && embrioesCongelados.length === 0 && (filtroClienteId || filtroRaca.trim()) && (
                      <div className="text-sm text-slate-500">
                        Nenhum embrião congelado encontrado para os filtros aplicados.
                      </div>
                    )}
                    {!loadingCongelados && embrioesCongelados.length > 0 && (
                      <div className="max-h-96 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12"></TableHead>
                              <TableHead>Código</TableHead>
                              <TableHead>Doadora</TableHead>
                              <TableHead>Touro</TableHead>
                              <TableHead>Classificação</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(() => {
                              const ordenados = [...embrioesCongelados].sort((a, b) => {
                                const dataA = a.created_at ? new Date(a.created_at).getTime() : 0;
                                const dataB = b.created_at ? new Date(b.created_at).getTime() : 0;
                                return dataB - dataA;
                              });
                              const totalPaginas = Math.max(1, Math.ceil(ordenados.length / EMBRIOES_PAGE_SIZE));
                              const paginaAtual = Math.min(embrioesPage, totalPaginas);
                              const inicio = (paginaAtual - 1) * EMBRIOES_PAGE_SIZE;
                              const embrioesPagina = ordenados.slice(inicio, inicio + EMBRIOES_PAGE_SIZE);

                              return embrioesPagina.map((embriao) => (
                                <TableRow
                                  key={embriao.id}
                                  className={formData.embriao_id === embriao.id ? 'bg-green-50' : 'cursor-pointer hover:bg-slate-50'}
                                  onClick={() => setFormData({ ...formData, embriao_id: embriao.id })}
                                >
                                  <TableCell>
                                    <input
                                      type="radio"
                                      name="embriao"
                                      value={embriao.id}
                                      checked={formData.embriao_id === embriao.id}
                                      onChange={() => setFormData({ ...formData, embriao_id: embriao.id })}
                                      className="w-4 h-4"
                                    />
                                  </TableCell>
                                  <TableCell className="font-mono text-xs">{embriao.identificacao || embriao.id.substring(0, 8)}</TableCell>
                                  <TableCell>{embriao.doadora_registro || '-'}</TableCell>
                                  <TableCell>{embriao.touro_nome || '-'}</TableCell>
                                  <TableCell>
                                    {embriao.classificacao ? <Badge variant="outline">{embriao.classificacao}</Badge> : <span className="text-slate-400">-</span>}
                                  </TableCell>
                                  <TableCell><StatusBadge status={embriao.status_atual} /></TableCell>
                                </TableRow>
                              ));
                            })()}
                          </TableBody>
                        </Table>
                        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
                          <div>{embrioesCongelados.length} embrião(ões) disponíveis</div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setEmbrioesPage(Math.max(1, embrioesPage - 1))}
                              disabled={embrioesPage === 1}
                            >
                              Anterior
                            </Button>
                            <span>
                              Página {Math.min(embrioesPage, Math.max(1, Math.ceil(embrioesCongelados.length / EMBRIOES_PAGE_SIZE)))} de {Math.max(1, Math.ceil(embrioesCongelados.length / EMBRIOES_PAGE_SIZE))}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const totalPaginas = Math.max(1, Math.ceil(embrioesCongelados.length / EMBRIOES_PAGE_SIZE));
                                setEmbrioesPage(Math.min(totalPaginas, embrioesPage + 1));
                              }}
                              disabled={embrioesPage >= Math.max(1, Math.ceil(embrioesCongelados.length / EMBRIOES_PAGE_SIZE))}
                            >
                              Próxima
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Campo de Observações */}
              {formData.embriao_id && formData.receptora_id && (
                <div className="space-y-4 border-t pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="observacoes">Observações</Label>
                    <Textarea
                      id="observacoes"
                      value={formData.observacoes}
                      onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                      placeholder="Observações sobre a transferência"
                      rows={3}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Botão de Submit */}
            {formData.embriao_id && formData.receptora_id && (
              <div className="flex justify-end">
                <Button
                  type="submit"
                  className="bg-green-600 hover:bg-green-700"
                  disabled={submitting}
                >
                  {submitting ? 'Registrando...' : 'Registrar Transferência'}
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Dialog do Relatório */}
      <Dialog open={showRelatorioDialog} onOpenChange={setShowRelatorioDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Relatório da Sessão de Transferência de Embriões
            </DialogTitle>
            <DialogDescription>
              Fazenda: {fazendas.find(f => f.id === formData.fazenda_id)?.nome || 'N/A'} |
              Data da TE: {formData.data_te ? formatDate(formData.data_te) : 'N/A'} |
              Total: {relatorioData.length} transferência(s)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><strong>Veterinário Responsável:</strong> {formData.veterinario_responsavel || 'N/A'}</div>
              <div><strong>Técnico Responsável:</strong> {formData.tecnico_responsavel || 'N/A'}</div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center">Código</TableHead>
                    <TableHead>Doadora</TableHead>
                    <TableHead>Touro</TableHead>
                    <TableHead>Classificação</TableHead>
                    <TableHead>Receptora (Brinco)</TableHead>
                    <TableHead>Receptora (Nome)</TableHead>
                    <TableHead>Data TE</TableHead>
                    <TableHead>Observações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {relatorioData.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="text-center font-semibold">{item.numero_embriao}</TableCell>
                      <TableCell>{item.doadora}</TableCell>
                      <TableCell>{item.touro}</TableCell>
                      <TableCell>{item.classificacao}</TableCell>
                      <TableCell className="font-semibold">{item.receptora_brinco}</TableCell>
                      <TableCell>{item.receptora_nome}</TableCell>
                      <TableCell>{item.data_te ? formatDate(item.data_te) : 'N/A'}</TableCell>
                      <TableCell className="text-sm text-slate-600">{item.observacoes || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowRelatorioDialog(false);
                setIsVisualizacaoApenas(false);
              }}
            >
              Fechar
            </Button>
            {!isVisualizacaoApenas && (
              <Button
                type="button"
                onClick={async () => {
                  setShowRelatorioDialog(false);
                  setIsVisualizacaoApenas(false);
                  await handleEncerrarSessao();
                }}
                className="bg-blue-600 hover:bg-blue-700"
                disabled={submitting}
              >
                {submitting ? 'Encerrando...' : 'Confirmar e Encerrar Sessão'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
