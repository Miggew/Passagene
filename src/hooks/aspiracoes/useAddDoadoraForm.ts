import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { PacoteAspiracao } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { calculateTotalOocitos, adicionarHoras, initialOocitosForm } from '@/lib/oocitos';
import type { AspiracaoDoadoraComNome } from './usePacoteAspiracaoData';

interface UseAddDoadoraFormProps {
  pacoteId: string | undefined;
  pacote: PacoteAspiracao | null;
  aspiracoes: AspiracaoDoadoraComNome[];
  totalOocitos: number;
  onSuccess: () => void;
  updatePacoteTotal: (total: number) => Promise<void>;
}

export interface AddDoadoraFormData {
  doadora_id: string;
  horario_aspiracao: string;
  hora_final: string;
  atresicos: string;
  degenerados: string;
  expandidos: string;
  desnudos: string;
  viaveis: string;
  recomendacao_touro: string;
  observacoes: string;
}

const initialFormData: AddDoadoraFormData = {
  doadora_id: '',
  horario_aspiracao: '',
  hora_final: '',
  ...initialOocitosForm,
  recomendacao_touro: '',
  observacoes: '',
};

export function useAddDoadoraForm({
  pacoteId,
  pacote,
  aspiracoes,
  totalOocitos,
  onSuccess,
  updatePacoteTotal,
}: UseAddDoadoraFormProps) {
  const { toast } = useToast();
  const isAddingRef = useRef(false);

  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<AddDoadoraFormData>(initialFormData);
  const [showConfirmZeroOocitos, setShowConfirmZeroOocitos] = useState(false);
  const [pendingAction, setPendingAction] = useState<'add' | 'create' | null>(null);

  const resetForm = useCallback(() => {
    setFormData(initialFormData);
  }, []);

  const initializeHorario = useCallback(() => {
    if (!pacote) return;

    if (aspiracoes.length > 0) {
      const ultimaAspiracao = aspiracoes[aspiracoes.length - 1];
      if (ultimaAspiracao.hora_final) {
        setFormData((prev) => ({
          ...prev,
          horario_aspiracao: ultimaAspiracao.hora_final || '',
          hora_final: adicionarHoras(ultimaAspiracao.hora_final || '', 1),
        }));
      }
    } else if (pacote.horario_inicio) {
      setFormData((prev) => ({
        ...prev,
        horario_aspiracao: pacote.horario_inicio || '',
        hora_final: adicionarHoras(pacote.horario_inicio || '', 1),
      }));
    }
  }, [pacote, aspiracoes]);

  const updateField = useCallback((field: keyof AddDoadoraFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const validateForm = useCallback((): boolean => {
    if (!formData.doadora_id) {
      toast({
        title: 'Erro',
        description: 'Selecione uma doadora',
        variant: 'destructive',
      });
      return false;
    }

    if (!formData.hora_final.trim()) {
      toast({
        title: 'Erro de validação',
        description: 'Hora final é obrigatória',
        variant: 'destructive',
      });
      return false;
    }

    if (!pacote?.veterinario_responsavel || !pacote?.tecnico_responsavel) {
      toast({
        title: 'Erro de validação',
        description: 'A aspiração deve ter veterinário e técnico responsáveis preenchidos. Por favor, edite a aspiração primeiro.',
        variant: 'destructive',
      });
      return false;
    }

    // Verificar se a doadora já está no pacote
    const doadoraJaNoPacote = aspiracoes.find((a) => a.doadora_id === formData.doadora_id);
    if (doadoraJaNoPacote) {
      toast({
        title: 'Erro',
        description: 'Esta doadora já foi aspirada nesta aspiração',
        variant: 'destructive',
      });
      return false;
    }

    return true;
  }, [formData, pacote, aspiracoes, toast]);

  const handleAddDoadora = useCallback(async () => {
    if (submitting || isAddingRef.current) return;

    if (!validateForm()) return;

    // Verificar se total de oócitos é zero
    const total = calculateTotalOocitos(formData);
    if (total === 0) {
      setPendingAction('add');
      setShowConfirmZeroOocitos(true);
      return;
    }

    await executeAddDoadora();
  }, [submitting, validateForm, formData]);

  const executeAddDoadora = useCallback(async () => {
    if (submitting || isAddingRef.current || !pacote || !pacoteId) return;

    try {
      isAddingRef.current = true;
      setSubmitting(true);

      const total = calculateTotalOocitos(formData);

      const insertData = {
        pacote_aspiracao_id: pacoteId,
        doadora_id: formData.doadora_id,
        fazenda_id: pacote.fazenda_id,
        data_aspiracao: pacote.data_aspiracao,
        horario_aspiracao: formData.horario_aspiracao || null,
        hora_final: formData.hora_final,
        atresicos: parseInt(formData.atresicos) || 0,
        degenerados: parseInt(formData.degenerados) || 0,
        expandidos: parseInt(formData.expandidos) || 0,
        desnudos: parseInt(formData.desnudos) || 0,
        viaveis: parseInt(formData.viaveis) || 0,
        total_oocitos: total,
        veterinario_responsavel: pacote.veterinario_responsavel!,
        tecnico_responsavel: pacote.tecnico_responsavel!,
        recomendacao_touro: formData.recomendacao_touro.trim() || null,
        observacoes: formData.observacoes.trim() || null,
      };

      const { error } = await supabase.from('aspiracoes_doadoras').insert([insertData]);

      if (error) {
        if (error.code === '23505') {
          toast({
            title: 'Erro',
            description: 'Esta doadora já foi aspirada nesta aspiração',
            variant: 'destructive',
          });
          onSuccess();
          return;
        }
        throw error;
      }

      // Atualizar total do pacote
      await updatePacoteTotal(totalOocitos + total);

      toast({
        title: 'Doadora adicionada',
        description: 'Doadora adicionada à aspiração com sucesso',
      });

      resetForm();
      onSuccess();
    } catch (error) {
      toast({
        title: 'Erro ao adicionar doadora',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
      isAddingRef.current = false;
    }
  }, [submitting, pacote, pacoteId, formData, totalOocitos, updatePacoteTotal, resetForm, onSuccess, toast]);

  const handleConfirmZeroOocitos = useCallback(async () => {
    setShowConfirmZeroOocitos(false);
    if (pendingAction === 'add') {
      await executeAddDoadora();
    }
    setPendingAction(null);
  }, [pendingAction, executeAddDoadora]);

  return {
    formData,
    setFormData,
    updateField,
    submitting,
    showConfirmZeroOocitos,
    setShowConfirmZeroOocitos,
    pendingAction,
    setPendingAction,
    resetForm,
    initializeHorario,
    handleAddDoadora,
    executeAddDoadora,
    handleConfirmZeroOocitos,
    calculateTotal: () => calculateTotalOocitos(formData),
  };
}
