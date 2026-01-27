import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { PacoteAspiracao } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { calculateTotalOocitos } from '@/lib/oocitos';
import type { AddDoadoraFormData } from './useAddDoadoraForm';

interface UseCreateDoadoraFormProps {
  pacoteId: string | undefined;
  pacote: PacoteAspiracao | null;
  addDoadoraForm: AddDoadoraFormData;
  totalOocitos: number;
  onSuccess: () => void;
  updatePacoteTotal: (total: number) => Promise<void>;
  setPendingAction: (action: 'add' | 'create' | null) => void;
  setShowConfirmZeroOocitos: (show: boolean) => void;
}

export interface CreateDoadoraFormData {
  registro: string;
  raca: string;
  racaCustom: string;
}

const racasPredefinidas = ['Holandesa', 'Jersey', 'Gir', 'Girolando'];

export function useCreateDoadoraForm({
  pacoteId,
  pacote,
  addDoadoraForm,
  totalOocitos,
  onSuccess,
  updatePacoteTotal,
  setPendingAction,
  setShowConfirmZeroOocitos,
}: UseCreateDoadoraFormProps) {
  const { toast } = useToast();

  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<CreateDoadoraFormData>({
    registro: '',
    raca: '',
    racaCustom: '',
  });
  const [racaSelecionada, setRacaSelecionada] = useState('');

  const resetForm = useCallback(() => {
    setFormData({ registro: '', raca: '', racaCustom: '' });
    setRacaSelecionada('');
  }, []);

  const handleRacaChange = useCallback((value: string) => {
    setRacaSelecionada(value);
    if (value === 'Outra') {
      setFormData((prev) => ({ ...prev, raca: '', racaCustom: '' }));
    } else {
      setFormData((prev) => ({ ...prev, raca: value, racaCustom: '' }));
    }
  }, []);

  const validateForm = useCallback((): boolean => {
    if (!formData.registro.trim()) {
      toast({
        title: 'Erro de validação',
        description: 'Registro é obrigatório',
        variant: 'destructive',
      });
      return false;
    }

    const racaFinal = racaSelecionada === 'Outra' ? formData.racaCustom.trim() : formData.raca.trim();
    if (!racaFinal) {
      toast({
        title: 'Erro de validação',
        description: 'Raça é obrigatória',
        variant: 'destructive',
      });
      return false;
    }

    if (!addDoadoraForm.hora_final.trim()) {
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

    return true;
  }, [formData, racaSelecionada, addDoadoraForm, pacote, toast]);

  const handleCreateDoadora = useCallback(async () => {
    if (submitting) return;

    if (!validateForm()) return;

    // Verificar se total de oócitos é zero
    const total = calculateTotalOocitos(addDoadoraForm);
    if (total === 0) {
      setPendingAction('create');
      setShowConfirmZeroOocitos(true);
      return;
    }

    await executeCreateDoadora();
  }, [submitting, validateForm, addDoadoraForm, setPendingAction, setShowConfirmZeroOocitos]);

  const executeCreateDoadora = useCallback(async () => {
    if (!pacote || !pacoteId) return;

    try {
      setSubmitting(true);

      const racaFinal = racaSelecionada === 'Outra' ? formData.racaCustom.trim() : formData.raca.trim();
      const registroNormalizado = formData.registro.trim().toUpperCase();

      // Verificar se já existe uma doadora com o mesmo registro e raça
      const { data: doadorasExistentes, error: checkError } = await supabase
        .from('doadoras')
        .select('id, registro, raca')
        .ilike('registro', registroNormalizado)
        .eq('raca', racaFinal);

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (doadorasExistentes && doadorasExistentes.length > 0) {
        toast({
          title: 'Erro',
          description: `Já existe uma doadora com o registro ${formData.registro.trim()} e raça ${racaFinal}`,
          variant: 'destructive',
        });
        return;
      }

      // Criar doadora
      const { data: novaDoadora, error: doadoraError } = await supabase
        .from('doadoras')
        .insert([{
          fazenda_id: pacote.fazenda_id,
          registro: registroNormalizado,
          raca: racaFinal,
        }])
        .select()
        .single();

      if (doadoraError) {
        if (doadoraError.code === '23505') {
          toast({
            title: 'Erro',
            description: `Já existe uma doadora com o registro ${formData.registro.trim()} nesta fazenda`,
            variant: 'destructive',
          });
          return;
        }
        throw doadoraError;
      }

      // Adicionar ao pacote
      const total = calculateTotalOocitos(addDoadoraForm);

      const insertData = {
        pacote_aspiracao_id: pacoteId,
        doadora_id: novaDoadora.id,
        fazenda_id: pacote.fazenda_id,
        data_aspiracao: pacote.data_aspiracao,
        horario_aspiracao: addDoadoraForm.horario_aspiracao || null,
        hora_final: addDoadoraForm.hora_final,
        atresicos: parseInt(addDoadoraForm.atresicos) || 0,
        degenerados: parseInt(addDoadoraForm.degenerados) || 0,
        expandidos: parseInt(addDoadoraForm.expandidos) || 0,
        desnudos: parseInt(addDoadoraForm.desnudos) || 0,
        viaveis: parseInt(addDoadoraForm.viaveis) || 0,
        total_oocitos: total,
        veterinario_responsavel: pacote.veterinario_responsavel!,
        tecnico_responsavel: pacote.tecnico_responsavel!,
        recomendacao_touro: addDoadoraForm.recomendacao_touro.trim() || null,
        observacoes: addDoadoraForm.observacoes.trim() || null,
      };

      const { error: aspiracaoError } = await supabase.from('aspiracoes_doadoras').insert([insertData]);

      if (aspiracaoError) {
        if (aspiracaoError.code === '23505') {
          toast({
            title: 'Erro',
            description: 'Esta doadora já foi aspirada nesta aspiração',
            variant: 'destructive',
          });
          onSuccess();
          return;
        }
        throw aspiracaoError;
      }

      // Atualizar total do pacote
      await updatePacoteTotal(totalOocitos + total);

      toast({
        title: 'Doadora criada e adicionada',
        description: 'Doadora criada e adicionada à aspiração com sucesso',
      });

      resetForm();
      onSuccess();
    } catch (error) {
      toast({
        title: 'Erro ao criar doadora',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }, [pacote, pacoteId, formData, racaSelecionada, addDoadoraForm, totalOocitos, updatePacoteTotal, resetForm, onSuccess, toast]);

  return {
    formData,
    setFormData,
    racaSelecionada,
    racasPredefinidas,
    submitting,
    resetForm,
    handleRacaChange,
    handleCreateDoadora,
    executeCreateDoadora,
  };
}
