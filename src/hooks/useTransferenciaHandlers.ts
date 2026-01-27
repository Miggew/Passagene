/**
 * Hook para gerenciar handlers/actions de Transferência de Embriões
 * Extraído de TransferenciaEmbrioes.tsx para melhor organização
 */

import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { SupabaseError } from '@/lib/types';
import { buscarDadosGenealogia } from '@/lib/dataEnrichment';
import { useToast } from '@/hooks/use-toast';
import { validarTransicaoStatus } from '@/lib/receptoraStatus';
import {
  TransferenciaFormData,
  ReceptoraSincronizada,
  RelatorioTransferenciaItem,
  TransferenciaRelatorioData,
} from '@/lib/types/transferenciaEmbrioes';
import { OrigemEmbriao } from '@/hooks/useTransferenciaEmbrioesFilters';

export interface UseTransferenciaHandlersProps {
  formData: TransferenciaFormData;
  setFormData: React.Dispatch<React.SetStateAction<TransferenciaFormData>>;
  origemEmbriao: OrigemEmbriao;
  receptoras: ReceptoraSincronizada[];
  contagemSessaoPorReceptora: Record<string, number>;
  setContagemSessaoPorReceptora: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  receptorasSessaoInfo: Record<string, ReceptoraSincronizada>;
  setReceptorasSessaoInfo: React.Dispatch<React.SetStateAction<Record<string, ReceptoraSincronizada>>>;
  transferenciasSessao: string[];
  setTransferenciasSessao: React.Dispatch<React.SetStateAction<string[]>>;
  transferenciasIdsSessao: string[];
  setTransferenciasIdsSessao: React.Dispatch<React.SetStateAction<string[]>>;
  numerosFixosMap: Map<string, number>;
  setSubmitting: React.Dispatch<React.SetStateAction<boolean>>;
  setRelatorioData: React.Dispatch<React.SetStateAction<RelatorioTransferenciaItem[]>>;
  setShowRelatorioDialog: React.Dispatch<React.SetStateAction<boolean>>;
  setIsVisualizacaoApenas: React.Dispatch<React.SetStateAction<boolean>>;
  resetFiltros: () => void;
  loadPacotes: () => Promise<void>;
  loadEmbrioesCongelados: () => Promise<void>;
  recarregarReceptoras: (fazendaId: string, sessaoOverride?: { contagem: Record<string, number>; info: Record<string, ReceptoraSincronizada> }) => Promise<void>;
  encerrarSessaoNoBanco: (fazendaId?: string) => Promise<void>;
}

export function useTransferenciaHandlers({
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
}: UseTransferenciaHandlersProps) {
  const { toast } = useToast();

  const handleDescartarReceptora = useCallback(async () => {
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
          .from('receptoras_cio_livre')
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

      setFormData(prev => ({ ...prev, receptora_id: '', protocolo_receptora_id: '' }));

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
  }, [formData, receptoras, setFormData, setSubmitting, recarregarReceptoras, toast]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
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
  }, [
    formData, origemEmbriao, receptoras, contagemSessaoPorReceptora, receptorasSessaoInfo,
    setFormData, setSubmitting, setTransferenciasIdsSessao, setTransferenciasSessao,
    setContagemSessaoPorReceptora, setReceptorasSessaoInfo,
    loadPacotes, loadEmbrioesCongelados, recarregarReceptoras, toast
  ]);

  const gerarRelatorioSessao = useCallback(async (apenasVisualizacao: boolean = false) => {
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
  }, [transferenciasIdsSessao, numerosFixosMap, setRelatorioData, setShowRelatorioDialog, setIsVisualizacaoApenas, toast]);

  const visualizarRelatorioSessao = useCallback(async () => {
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
  }, [transferenciasIdsSessao, setIsVisualizacaoApenas, gerarRelatorioSessao, toast]);

  const handleEncerrarSessao = useCallback(async () => {
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

      // Resetar form data
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

      // Resetar estados de sessão
      setTransferenciasSessao([]);
      setTransferenciasIdsSessao([]);
      setContagemSessaoPorReceptora({});
      setReceptorasSessaoInfo({});
      // Resetar filtros e UI
      resetFiltros();

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
  }, [
    formData, transferenciasSessao, transferenciasIdsSessao,
    setFormData, setSubmitting, setTransferenciasSessao, setTransferenciasIdsSessao,
    setContagemSessaoPorReceptora, setReceptorasSessaoInfo,
    resetFiltros, loadPacotes, recarregarReceptoras, encerrarSessaoNoBanco, toast
  ]);

  return {
    handleDescartarReceptora,
    handleSubmit,
    visualizarRelatorioSessao,
    gerarRelatorioSessao,
    handleEncerrarSessao,
  };
}

export type UseTransferenciaHandlersReturn = ReturnType<typeof useTransferenciaHandlers>;
