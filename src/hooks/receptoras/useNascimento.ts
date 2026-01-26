/**
 * Hook para gerenciar registro de nascimento
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Fazenda, ReceptoraComStatus } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export interface NascimentoEmbriaoInfo {
  embriao_id: string;
  doadora_registro?: string;
  touro_nome?: string;
  raca?: string;
}

export interface NascimentoFormData {
  receptora_id: string;
  data_nascimento: string;
  sexo: string;
  observacoes: string;
}

export interface UseNascimentoProps {
  selectedFazendaId: string;
  fazendas: Fazenda[];
  onSuccess?: () => void;
}

export interface UseNascimentoReturn {
  // Dialog state
  showNascimentoDialog: boolean;
  setShowNascimentoDialog: (show: boolean) => void;

  // Form state
  nascimentoForm: NascimentoFormData;
  setNascimentoForm: React.Dispatch<React.SetStateAction<NascimentoFormData>>;
  nascimentoEmbrioes: NascimentoEmbriaoInfo[];

  // Loading state
  nascimentoLoading: boolean;
  submitting: boolean;

  // Actions
  handleAbrirNascimento: (receptora: ReceptoraComStatus) => Promise<void>;
  handleRegistrarNascimento: () => Promise<void>;
}

export function useNascimento({
  selectedFazendaId,
  fazendas,
  onSuccess,
}: UseNascimentoProps): UseNascimentoReturn {
  const { toast } = useToast();
  const hoje = new Date().toISOString().split('T')[0];

  // Dialog state
  const [showNascimentoDialog, setShowNascimentoDialog] = useState(false);

  // Form state
  const [nascimentoForm, setNascimentoForm] = useState<NascimentoFormData>({
    receptora_id: '',
    data_nascimento: hoje,
    sexo: '',
    observacoes: '',
  });
  const [nascimentoEmbrioes, setNascimentoEmbrioes] = useState<NascimentoEmbriaoInfo[]>([]);

  // Loading state
  const [nascimentoLoading, setNascimentoLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Infer sex from status
  const inferSexoFromStatus = (status: string): string => {
    if (status.includes('FEMEA')) return 'FEMEA';
    if (status.includes('MACHO')) return 'MACHO';
    return 'SEM_SEXO';
  };

  // Load birth data
  const carregarDadosNascimento = async (receptoraId: string): Promise<NascimentoEmbriaoInfo[]> => {
    const { data: transferenciasData, error: teError } = await supabase
      .from('transferencias_embrioes')
      .select('embriao_id, data_te')
      .eq('receptora_id', receptoraId)
      .eq('status_te', 'REALIZADA')
      .order('data_te', { ascending: false });

    if (teError) throw teError;
    if (!transferenciasData || transferenciasData.length === 0) return [];

    const dataTeRef = transferenciasData[0].data_te;
    const transferenciasDaGestacao = transferenciasData.filter(t => t.data_te === dataTeRef);
    const embriaoIds = transferenciasDaGestacao.map(t => t.embriao_id).filter(Boolean) as string[];

    if (embriaoIds.length === 0) return [];

    // Check for existing animals
    const { data: animaisExistentes } = await supabase
      .from('animais')
      .select('embriao_id')
      .in('embriao_id', embriaoIds);

    const animaisExistentesSet = new Set((animaisExistentes || []).map(a => a.embriao_id));
    const embriaoIdsNovos = embriaoIds.filter(id => !animaisExistentesSet.has(id));

    if (embriaoIdsNovos.length === 0) return [];

    // Get embryo data
    const { data: embrioesData, error: embrioesError } = await supabase
      .from('embrioes')
      .select('id, lote_fiv_acasalamento_id')
      .in('id', embriaoIdsNovos);

    if (embrioesError) throw embrioesError;

    const acasalamentoIds = [...new Set((embrioesData || []).map(e => e.lote_fiv_acasalamento_id).filter(Boolean))] as string[];

    let acasalamentosData: Array<{ id: string; aspiracao_doadora_id?: string; dose_semen_id?: string }> = [];
    let aspiracoesData: Array<{ id: string; doadora_id?: string }> = [];
    let doadorasData: Array<{ id: string; registro?: string; raca?: string }> = [];
    let dosesData: Array<{ id: string; touro?: { nome?: string; raca?: string } }> = [];

    if (acasalamentoIds.length > 0) {
      const { data: acasalamentosResult } = await supabase
        .from('lote_fiv_acasalamentos')
        .select('id, aspiracao_doadora_id, dose_semen_id')
        .in('id', acasalamentoIds);
      acasalamentosData = acasalamentosResult || [];

      const aspiracaoIds = [...new Set(acasalamentosData.map(a => a.aspiracao_doadora_id).filter(Boolean))] as string[];
      const doseIds = [...new Set(acasalamentosData.map(a => a.dose_semen_id).filter(Boolean))] as string[];

      if (aspiracaoIds.length > 0) {
        const { data: aspiracoesResult } = await supabase
          .from('aspiracoes_doadoras')
          .select('id, doadora_id')
          .in('id', aspiracaoIds);
        aspiracoesData = aspiracoesResult || [];

        const doadoraIds = [...new Set(aspiracoesData.map(a => a.doadora_id).filter(Boolean))] as string[];
        if (doadoraIds.length > 0) {
          const { data: doadorasResult } = await supabase
            .from('doadoras')
            .select('id, registro, raca')
            .in('id', doadoraIds);
          doadorasData = doadorasResult || [];
        }
      }

      if (doseIds.length > 0) {
        const { data: dosesResult } = await supabase
          .from('doses_semen')
          .select('id, touro:touros(id, nome, registro, raca)')
          .in('id', doseIds);
        dosesData = dosesResult || [];
      }
    }

    const acasalamentosMap = new Map(acasalamentosData.map(a => [a.id, a]));
    const aspiracoesMap = new Map(aspiracoesData.map(a => [a.id, a]));
    const doadorasMap = new Map(doadorasData.map(d => [d.id, d]));
    const dosesMap = new Map(dosesData.map(d => [d.id, d]));

    return (embrioesData || []).map((embriao) => {
      const acasalamento = embriao.lote_fiv_acasalamento_id
        ? acasalamentosMap.get(embriao.lote_fiv_acasalamento_id)
        : undefined;
      const aspiracao = acasalamento
        ? aspiracoesMap.get(acasalamento.aspiracao_doadora_id)
        : undefined;
      const doadora = aspiracao ? doadorasMap.get(aspiracao.doadora_id) : undefined;
      const dose = acasalamento ? dosesMap.get(acasalamento.dose_semen_id) : undefined;
      const touro = dose?.touro ?? null;

      return {
        embriao_id: embriao.id,
        doadora_registro: doadora?.registro,
        touro_nome: touro?.nome,
        raca: doadora?.raca || touro?.raca,
      };
    });
  };

  // Open birth dialog
  const handleAbrirNascimento = useCallback(async (receptora: ReceptoraComStatus) => {
    try {
      setNascimentoLoading(true);
      setNascimentoEmbrioes([]);
      setNascimentoForm({
        receptora_id: receptora.id,
        data_nascimento: hoje,
        sexo: '',
        observacoes: '',
      });
      setShowNascimentoDialog(true);

      const [embrioesInfo, sexoInfo] = await Promise.all([
        carregarDadosNascimento(receptora.id),
        supabase
          .from('diagnosticos_gestacao')
          .select('sexagem')
          .eq('receptora_id', receptora.id)
          .eq('tipo_diagnostico', 'SEXAGEM')
          .order('data_diagnostico', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const sexoSugerido = sexoInfo?.data?.sexagem || inferSexoFromStatus(receptora.status_calculado);
      setNascimentoForm(prev => ({ ...prev, sexo: sexoSugerido || '' }));
      setNascimentoEmbrioes(embrioesInfo);

      if (embrioesInfo.length === 0) {
        toast({
          title: 'Sem embriões disponíveis',
          description: 'Nenhum embrião elegível para criar animal foi encontrado.',
        });
      }
    } catch (error) {
      toast({
        title: 'Erro ao preparar nascimento',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setNascimentoLoading(false);
    }
  }, [hoje, toast]);

  // Register birth
  const handleRegistrarNascimento = useCallback(async () => {
    if (!selectedFazendaId) {
      toast({
        title: 'Fazenda não selecionada',
        description: 'Selecione a fazenda antes de registrar o nascimento.',
        variant: 'destructive',
      });
      return;
    }

    if (!nascimentoForm.receptora_id) {
      toast({
        title: 'Receptora não selecionada',
        description: 'Selecione a receptora para registrar o nascimento.',
        variant: 'destructive',
      });
      return;
    }

    if (!nascimentoForm.data_nascimento) {
      toast({
        title: 'Data de nascimento obrigatória',
        description: 'Informe a data de nascimento.',
        variant: 'destructive',
      });
      return;
    }

    if (!nascimentoForm.sexo) {
      toast({
        title: 'Sexo obrigatório',
        description: 'Selecione o sexo da prenhez.',
        variant: 'destructive',
      });
      return;
    }

    if (nascimentoEmbrioes.length === 0) {
      toast({
        title: 'Sem embriões vinculados',
        description: 'Nenhum embrião encontrado para a última transferência desta receptora.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const fazendaAtual = fazendas.find(f => f.id === selectedFazendaId);
      const clienteId = fazendaAtual?.cliente_id || null;

      const animaisToInsert = nascimentoEmbrioes.map((embriao) => ({
        embriao_id: embriao.embriao_id,
        receptora_id: nascimentoForm.receptora_id,
        fazenda_id: selectedFazendaId,
        cliente_id: clienteId,
        data_nascimento: nascimentoForm.data_nascimento,
        sexo: nascimentoForm.sexo,
        raca: embriao.raca || null,
        pai_nome: embriao.touro_nome || null,
        mae_nome: embriao.doadora_registro || null,
        observacoes: nascimentoForm.observacoes || null,
      }));

      const { error: insertError } = await supabase
        .from('animais')
        .insert(animaisToInsert);

      if (insertError) throw insertError;

      const { error: receptoraError } = await supabase
        .from('receptoras')
        .update({ status_reprodutivo: 'VAZIA', data_provavel_parto: null })
        .eq('id', nascimentoForm.receptora_id);

      if (receptoraError) throw receptoraError;

      toast({
        title: 'Nascimento registrado',
        description: `${animaisToInsert.length} animal(is) criado(s) com sucesso.`,
      });

      setShowNascimentoDialog(false);
      setNascimentoEmbrioes([]);
      setNascimentoForm({
        receptora_id: '',
        data_nascimento: hoje,
        sexo: '',
        observacoes: '',
      });

      onSuccess?.();
    } catch (error) {
      toast({
        title: 'Erro ao registrar nascimento',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }, [nascimentoForm, nascimentoEmbrioes, selectedFazendaId, fazendas, hoje, toast, onSuccess]);

  return {
    // Dialog state
    showNascimentoDialog,
    setShowNascimentoDialog,

    // Form state
    nascimentoForm,
    setNascimentoForm,
    nascimentoEmbrioes,

    // Loading state
    nascimentoLoading,
    submitting,

    // Actions
    handleAbrirNascimento,
    handleRegistrarNascimento,
  };
}

export default useNascimento;
