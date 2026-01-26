/**
 * Hook para gerenciar ações em embriões (congelar, descartar, classificar, etc.)
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Embriao, HistoricoEmbriao, Cliente } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import type { EmbrioCompleto, PacoteEmbrioes } from './useEmbrioesData';

// Helper function to register history
const registrarHistorico = async (
  embriaoId: string,
  statusAnterior: string | null,
  statusNovo: string,
  tipoOperacao: 'CLASSIFICACAO' | 'DESTINACAO' | 'CONGELAMENTO' | 'DESCARTE' | 'TRANSFERENCIA',
  fazendaId?: string | null,
  observacoes?: string | null
) => {
  try {
    await supabase.from('historico_embrioes').insert([{
      embriao_id: embriaoId,
      status_anterior: statusAnterior,
      status_novo: statusNovo,
      tipo_operacao: tipoOperacao,
      fazenda_id: fazendaId || null,
      observacoes: observacoes || null,
      data_mudanca: new Date().toISOString(),
    }]);
  } catch {
    // Silent error - history is secondary
  }
};

export interface CongelarData {
  data_congelamento: string;
  localizacao_atual: string;
}

export interface DescartarData {
  data_descarte: string;
  observacoes: string;
}

export interface DirecionarClienteData {
  cliente_id: string;
}

export interface UseEmbrioesActionsProps {
  embrioes: EmbrioCompleto[];
  pacotes: PacoteEmbrioes[];
  classificacoesPendentes: Record<string, string>;
  setClassificacoesPendentes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onSuccess: () => Promise<void>;
}

export interface UseEmbrioesActionsReturn {
  // Selection state
  embrioesSelecionados: Set<string>;
  setEmbrioesSelecionados: React.Dispatch<React.SetStateAction<Set<string>>>;
  showAcoesEmMassa: boolean;
  setShowAcoesEmMassa: (show: boolean) => void;

  // Dialog states
  showCongelarDialog: boolean;
  setShowCongelarDialog: (show: boolean) => void;
  showDescartarDialog: boolean;
  setShowDescartarDialog: (show: boolean) => void;
  showClassificarDialog: boolean;
  setShowClassificarDialog: (show: boolean) => void;
  showDirecionarClienteDialog: boolean;
  setShowDirecionarClienteDialog: (show: boolean) => void;
  showHistoricoDialog: boolean;
  setShowHistoricoDialog: (show: boolean) => void;
  showEditarFazendasDestinoDialog: boolean;
  setShowEditarFazendasDestinoDialog: (show: boolean) => void;

  // Form data
  congelarData: CongelarData;
  setCongelarData: React.Dispatch<React.SetStateAction<CongelarData>>;
  descartarData: DescartarData;
  setDescartarData: React.Dispatch<React.SetStateAction<DescartarData>>;
  direcionarClienteData: DirecionarClienteData;
  setDirecionarClienteData: React.Dispatch<React.SetStateAction<DirecionarClienteData>>;

  // Selected items
  classificarEmbriao: Embriao | null;
  setClassificarEmbriao: (embriao: Embriao | null) => void;
  descartarEmbriao: Embriao | null;
  setDescartarEmbriao: (embriao: Embriao | null) => void;
  historicoEmbriao: Embriao | null;
  setHistoricoEmbriao: (embriao: Embriao | null) => void;
  pacoteEditandoFazendas: PacoteEmbrioes | null;
  setPacoteEditandoFazendas: (pacote: PacoteEmbrioes | null) => void;
  fazendasDestinoSelecionadas: string[];
  setFazendasDestinoSelecionadas: (fazendas: string[]) => void;

  // History
  historico: HistoricoEmbriao[];
  loadingHistorico: boolean;

  // Loading state
  submitting: boolean;

  // Actions
  handleCongelarEmMassa: () => Promise<void>;
  handleDescartarEmMassa: () => Promise<void>;
  handleDirecionarClienteEmMassa: (clientes: Cliente[]) => Promise<void>;
  handleSalvarClassificacoesPendentes: () => Promise<void>;
  handleClassificarEmbriao: () => Promise<void>;
  handleDescartarEmbriao: () => Promise<void>;
  loadHistorico: (embriaoId: string) => Promise<void>;
  handleSalvarFazendasDestino: () => Promise<void>;

  // Selection helpers
  toggleEmbriaoSelecionado: (embriaoId: string) => void;
  selecionarTodosPacote: (pacoteId: string) => void;
  limparSelecao: () => void;
  isEmbriaoSelecionado: (embriaoId: string) => boolean;
}

export function useEmbrioesActions({
  embrioes,
  pacotes,
  classificacoesPendentes,
  setClassificacoesPendentes,
  onSuccess,
}: UseEmbrioesActionsProps): UseEmbrioesActionsReturn {
  const { toast } = useToast();
  const hoje = new Date().toISOString().split('T')[0];

  // Selection state
  const [embrioesSelecionados, setEmbrioesSelecionados] = useState<Set<string>>(new Set());
  const [showAcoesEmMassa, setShowAcoesEmMassa] = useState(false);

  // Dialog states
  const [showCongelarDialog, setShowCongelarDialog] = useState(false);
  const [showDescartarDialog, setShowDescartarDialog] = useState(false);
  const [showClassificarDialog, setShowClassificarDialog] = useState(false);
  const [showDirecionarClienteDialog, setShowDirecionarClienteDialog] = useState(false);
  const [showHistoricoDialog, setShowHistoricoDialog] = useState(false);
  const [showEditarFazendasDestinoDialog, setShowEditarFazendasDestinoDialog] = useState(false);

  // Form data
  const [congelarData, setCongelarData] = useState<CongelarData>({
    data_congelamento: hoje,
    localizacao_atual: '',
  });
  const [descartarData, setDescartarData] = useState<DescartarData>({
    data_descarte: hoje,
    observacoes: '',
  });
  const [direcionarClienteData, setDirecionarClienteData] = useState<DirecionarClienteData>({
    cliente_id: '',
  });

  // Selected items
  const [classificarEmbriao, setClassificarEmbriao] = useState<Embriao | null>(null);
  const [descartarEmbriao, setDescartarEmbriao] = useState<Embriao | null>(null);
  const [historicoEmbriao, setHistoricoEmbriao] = useState<Embriao | null>(null);
  const [pacoteEditandoFazendas, setPacoteEditandoFazendas] = useState<PacoteEmbrioes | null>(null);
  const [fazendasDestinoSelecionadas, setFazendasDestinoSelecionadas] = useState<string[]>([]);

  // History
  const [historico, setHistorico] = useState<HistoricoEmbriao[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);

  // Loading state
  const [submitting, setSubmitting] = useState(false);

  // Selection helpers
  const toggleEmbriaoSelecionado = useCallback((embriaoId: string) => {
    setEmbrioesSelecionados(prev => {
      const next = new Set(prev);
      if (next.has(embriaoId)) {
        next.delete(embriaoId);
      } else {
        next.add(embriaoId);
      }
      return next;
    });
  }, []);

  const selecionarTodosPacote = useCallback((pacoteId: string) => {
    const pacote = pacotes.find(p => p.id === pacoteId);
    if (!pacote) return;

    const frescos = pacote.embrioes.filter(e => e.status_atual === 'FRESCO').map(e => e.id);
    const todosSelecionados = frescos.every(id => embrioesSelecionados.has(id));

    setEmbrioesSelecionados(prev => {
      const next = new Set(prev);
      if (todosSelecionados) {
        frescos.forEach(id => next.delete(id));
      } else {
        frescos.forEach(id => next.add(id));
      }
      return next;
    });
  }, [pacotes, embrioesSelecionados]);

  const limparSelecao = useCallback(() => {
    setEmbrioesSelecionados(new Set());
    setShowAcoesEmMassa(false);
  }, []);

  const isEmbriaoSelecionado = useCallback((embriaoId: string) => {
    return embrioesSelecionados.has(embriaoId);
  }, [embrioesSelecionados]);

  // Load history
  const loadHistorico = useCallback(async (embriaoId: string) => {
    try {
      setLoadingHistorico(true);
      const { data, error } = await supabase
        .from('historico_embrioes')
        .select('*, fazenda:fazendas(nome)')
        .eq('embriao_id', embriaoId)
        .order('data_mudanca', { ascending: false });

      if (error) throw error;
      setHistorico(data || []);
    } catch (error) {
      toast({
        title: 'Erro ao carregar histórico',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoadingHistorico(false);
    }
  }, [toast]);

  // Freeze embryos in batch
  const handleCongelarEmMassa = useCallback(async () => {
    if (embrioesSelecionados.size === 0) {
      toast({
        title: 'Nenhum embrião selecionado',
        description: 'Selecione pelo menos um embrião para congelar.',
        variant: 'destructive',
      });
      return;
    }

    if (!congelarData.localizacao_atual.trim()) {
      toast({
        title: 'Localização obrigatória',
        description: 'Informe a localização de armazenamento.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);
      const ids = Array.from(embrioesSelecionados);

      const { error } = await supabase
        .from('embrioes')
        .update({
          status_atual: 'CONGELADO',
          data_congelamento: congelarData.data_congelamento,
          localizacao_atual: congelarData.localizacao_atual.trim(),
        })
        .in('id', ids);

      if (error) throw error;

      // Register history for each
      for (const id of ids) {
        const embriao = embrioes.find(e => e.id === id);
        await registrarHistorico(
          id,
          embriao?.status_atual || null,
          'CONGELADO',
          'CONGELAMENTO',
          null,
          `Congelado em ${congelarData.localizacao_atual.trim()}`
        );
      }

      toast({
        title: 'Embriões congelados',
        description: `${ids.length} embrião(ões) congelado(s) com sucesso.`,
      });

      setShowCongelarDialog(false);
      limparSelecao();
      setCongelarData({ data_congelamento: hoje, localizacao_atual: '' });
      await onSuccess();
    } catch (error) {
      toast({
        title: 'Erro ao congelar embriões',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }, [embrioesSelecionados, congelarData, embrioes, hoje, toast, limparSelecao, onSuccess]);

  // Discard embryos in batch
  const handleDescartarEmMassa = useCallback(async () => {
    if (embrioesSelecionados.size === 0) {
      toast({
        title: 'Nenhum embrião selecionado',
        description: 'Selecione pelo menos um embrião para descartar.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);
      const ids = Array.from(embrioesSelecionados);

      const { error } = await supabase
        .from('embrioes')
        .update({
          status_atual: 'DESCARTADO',
          data_descarte: descartarData.data_descarte,
          observacoes: descartarData.observacoes.trim() || null,
        })
        .in('id', ids);

      if (error) throw error;

      // Register history
      for (const id of ids) {
        const embriao = embrioes.find(e => e.id === id);
        await registrarHistorico(
          id,
          embriao?.status_atual || null,
          'DESCARTADO',
          'DESCARTE',
          null,
          descartarData.observacoes.trim() || null
        );
      }

      toast({
        title: 'Embriões descartados',
        description: `${ids.length} embrião(ões) descartado(s).`,
      });

      setShowDescartarDialog(false);
      limparSelecao();
      setDescartarData({ data_descarte: hoje, observacoes: '' });
      await onSuccess();
    } catch (error) {
      toast({
        title: 'Erro ao descartar embriões',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }, [embrioesSelecionados, descartarData, embrioes, hoje, toast, limparSelecao, onSuccess]);

  // Direct to client in batch
  const handleDirecionarClienteEmMassa = useCallback(async (clientes: Cliente[]) => {
    if (embrioesSelecionados.size === 0) {
      toast({
        title: 'Nenhum embrião selecionado',
        description: 'Selecione pelo menos um embrião.',
        variant: 'destructive',
      });
      return;
    }

    if (!direcionarClienteData.cliente_id) {
      toast({
        title: 'Cliente não selecionado',
        description: 'Selecione o cliente de destino.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);
      const ids = Array.from(embrioesSelecionados);

      const { error } = await supabase
        .from('embrioes')
        .update({ cliente_id: direcionarClienteData.cliente_id })
        .in('id', ids);

      if (error) throw error;

      const cliente = clientes.find(c => c.id === direcionarClienteData.cliente_id);
      for (const id of ids) {
        await registrarHistorico(
          id,
          null,
          'DIRECIONADO',
          'DESTINACAO',
          null,
          `Direcionado para cliente: ${cliente?.nome || 'N/A'}`
        );
      }

      toast({
        title: 'Embriões direcionados',
        description: `${ids.length} embrião(ões) direcionado(s) para ${cliente?.nome || 'cliente'}.`,
      });

      setShowDirecionarClienteDialog(false);
      limparSelecao();
      setDirecionarClienteData({ cliente_id: '' });
      await onSuccess();
    } catch (error) {
      toast({
        title: 'Erro ao direcionar embriões',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }, [embrioesSelecionados, direcionarClienteData, toast, limparSelecao, onSuccess]);

  // Save pending classifications
  const handleSalvarClassificacoesPendentes = useCallback(async () => {
    const pendentes = Object.entries(classificacoesPendentes);
    if (pendentes.length === 0) {
      toast({
        title: 'Nenhuma classificação pendente',
        description: 'Não há classificações para salvar.',
      });
      return;
    }

    try {
      setSubmitting(true);

      for (const [embriaoId, classificacao] of pendentes) {
        const { error } = await supabase
          .from('embrioes')
          .update({ classificacao: classificacao.toUpperCase() })
          .eq('id', embriaoId);

        if (error) throw error;

        await registrarHistorico(
          embriaoId,
          null,
          classificacao.toUpperCase(),
          'CLASSIFICACAO',
          null,
          `Classificado como ${classificacao.toUpperCase()}`
        );
      }

      toast({
        title: 'Classificações salvas',
        description: `${pendentes.length} embrião(ões) classificado(s).`,
      });

      setClassificacoesPendentes({});
      await onSuccess();
    } catch (error) {
      toast({
        title: 'Erro ao salvar classificações',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }, [classificacoesPendentes, setClassificacoesPendentes, toast, onSuccess]);

  // Classify single embryo
  const handleClassificarEmbriao = useCallback(async () => {
    // Implementation for single embryo classification
    // This would be called from the dialog
    setShowClassificarDialog(false);
    setClassificarEmbriao(null);
  }, []);

  // Discard single embryo
  const handleDescartarEmbriao = useCallback(async () => {
    if (!descartarEmbriao) return;

    try {
      setSubmitting(true);

      const { error } = await supabase
        .from('embrioes')
        .update({
          status_atual: 'DESCARTADO',
          data_descarte: descartarData.data_descarte,
          observacoes: descartarData.observacoes.trim() || null,
        })
        .eq('id', descartarEmbriao.id);

      if (error) throw error;

      await registrarHistorico(
        descartarEmbriao.id,
        descartarEmbriao.status_atual,
        'DESCARTADO',
        'DESCARTE',
        null,
        descartarData.observacoes.trim() || null
      );

      toast({
        title: 'Embrião descartado',
        description: 'Embrião descartado com sucesso.',
      });

      setShowDescartarDialog(false);
      setDescartarEmbriao(null);
      setDescartarData({ data_descarte: hoje, observacoes: '' });
      await onSuccess();
    } catch (error) {
      toast({
        title: 'Erro ao descartar embrião',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }, [descartarEmbriao, descartarData, hoje, toast, onSuccess]);

  // Save destination fazendas
  const handleSalvarFazendasDestino = useCallback(async () => {
    if (!pacoteEditandoFazendas) return;

    try {
      setSubmitting(true);

      // Delete existing
      await supabase
        .from('pacotes_aspiracao_fazendas_destino')
        .delete()
        .eq('pacote_aspiracao_id', pacoteEditandoFazendas.pacote_info.id);

      // Insert new
      if (fazendasDestinoSelecionadas.length > 0) {
        const inserts = fazendasDestinoSelecionadas.map(fazendaId => ({
          pacote_aspiracao_id: pacoteEditandoFazendas.pacote_info.id,
          fazenda_destino_id: fazendaId,
        }));

        const { error } = await supabase
          .from('pacotes_aspiracao_fazendas_destino')
          .insert(inserts);

        if (error) throw error;
      }

      toast({
        title: 'Fazendas destino atualizadas',
        description: 'As fazendas destino foram atualizadas com sucesso.',
      });

      setShowEditarFazendasDestinoDialog(false);
      setPacoteEditandoFazendas(null);
      setFazendasDestinoSelecionadas([]);
      await onSuccess();
    } catch (error) {
      toast({
        title: 'Erro ao salvar fazendas destino',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }, [pacoteEditandoFazendas, fazendasDestinoSelecionadas, toast, onSuccess]);

  return {
    // Selection state
    embrioesSelecionados,
    setEmbrioesSelecionados,
    showAcoesEmMassa,
    setShowAcoesEmMassa,

    // Dialog states
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

    // Form data
    congelarData,
    setCongelarData,
    descartarData,
    setDescartarData,
    direcionarClienteData,
    setDirecionarClienteData,

    // Selected items
    classificarEmbriao,
    setClassificarEmbriao,
    descartarEmbriao,
    setDescartarEmbriao,
    historicoEmbriao,
    setHistoricoEmbriao,
    pacoteEditandoFazendas,
    setPacoteEditandoFazendas,
    fazendasDestinoSelecionadas,
    setFazendasDestinoSelecionadas,

    // History
    historico,
    loadingHistorico,

    // Loading state
    submitting,

    // Actions
    handleCongelarEmMassa,
    handleDescartarEmMassa,
    handleDirecionarClienteEmMassa,
    handleSalvarClassificacoesPendentes,
    handleClassificarEmbriao,
    handleDescartarEmbriao,
    loadHistorico,
    handleSalvarFazendasDestino,

    // Selection helpers
    toggleEmbriaoSelecionado,
    selecionarTodosPacote,
    limparSelecao,
    isEmbriaoSelecionado,
  };
}

export default useEmbrioesActions;
