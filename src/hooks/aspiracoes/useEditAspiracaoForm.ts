import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { calculateTotalOocitos, initialOocitosForm } from '@/lib/oocitos';
import type { AspiracaoDoadoraComNome } from './usePacoteAspiracaoData';

interface UseEditAspiracaoFormProps {
  totalOocitos: number;
  onSuccess: () => void;
  updatePacoteTotal: (total: number) => Promise<void>;
}

export interface EditAspiracaoFormData {
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

const initialFormData: EditAspiracaoFormData = {
  horario_aspiracao: '',
  hora_final: '',
  ...initialOocitosForm,
  recomendacao_touro: '',
  observacoes: '',
};

export function useEditAspiracaoForm({
  totalOocitos,
  onSuccess,
  updatePacoteTotal,
}: UseEditAspiracaoFormProps) {
  const { toast } = useToast();

  const [submitting, setSubmitting] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [aspiracaoEditando, setAspiracaoEditando] = useState<AspiracaoDoadoraComNome | null>(null);
  const [formData, setFormData] = useState<EditAspiracaoFormData>(initialFormData);

  const openEdit = useCallback((aspiracao: AspiracaoDoadoraComNome) => {
    setAspiracaoEditando(aspiracao);
    setFormData({
      horario_aspiracao: aspiracao.horario_aspiracao || '',
      hora_final: aspiracao.hora_final || '',
      atresicos: aspiracao.atresicos?.toString() || '',
      degenerados: aspiracao.degenerados?.toString() || '',
      expandidos: aspiracao.expandidos?.toString() || '',
      desnudos: aspiracao.desnudos?.toString() || '',
      viaveis: aspiracao.viaveis?.toString() || '',
      recomendacao_touro: aspiracao.recomendacao_touro || '',
      observacoes: aspiracao.observacoes || '',
    });
    setShowDialog(true);
  }, []);

  const closeEdit = useCallback(() => {
    setShowDialog(false);
    setAspiracaoEditando(null);
    setFormData(initialFormData);
  }, []);

  const updateField = useCallback((field: keyof EditAspiracaoFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!aspiracaoEditando) return;

    if (!formData.hora_final.trim()) {
      toast({
        title: 'Erro de validação',
        description: 'Hora final é obrigatória',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const total = calculateTotalOocitos(formData);
      const totalAnterior = aspiracaoEditando.total_oocitos || 0;
      const diferencaTotal = total - totalAnterior;

      const updateData = {
        horario_aspiracao: formData.horario_aspiracao || null,
        hora_final: formData.hora_final,
        atresicos: parseInt(formData.atresicos) || 0,
        degenerados: parseInt(formData.degenerados) || 0,
        expandidos: parseInt(formData.expandidos) || 0,
        desnudos: parseInt(formData.desnudos) || 0,
        viaveis: parseInt(formData.viaveis) || 0,
        total_oocitos: total,
        recomendacao_touro: formData.recomendacao_touro.trim() || null,
        observacoes: formData.observacoes.trim() || null,
      };

      const { error } = await supabase
        .from('aspiracoes_doadoras')
        .update(updateData)
        .eq('id', aspiracaoEditando.id);

      if (error) throw error;

      // Atualizar total do pacote
      await updatePacoteTotal(totalOocitos + diferencaTotal);

      toast({
        title: 'Aspiração atualizada',
        description: 'Aspiração da doadora atualizada com sucesso',
      });

      closeEdit();
      onSuccess();
    } catch (error) {
      toast({
        title: 'Erro ao atualizar aspiração',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }, [aspiracaoEditando, formData, totalOocitos, updatePacoteTotal, closeEdit, onSuccess, toast]);

  return {
    formData,
    setFormData,
    updateField,
    submitting,
    showDialog,
    setShowDialog,
    aspiracaoEditando,
    openEdit,
    closeEdit,
    handleSave,
    calculateTotal: () => calculateTotalOocitos(formData),
  };
}
