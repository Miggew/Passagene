/**
 * Hook para gerenciar formulario de cadastro de doadoras
 * - Estado do formulario
 * - Validacao e submissao
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

export const racasPredefinidas = ['Holandesa', 'Jersey', 'Gir', 'Girolando'];

export interface DoadoraFormData {
  registro: string;
  raca: string;
  racaCustom: string;
}

const initialFormData: DoadoraFormData = {
  registro: '',
  raca: '',
  racaCustom: '',
};

export interface UseDoadorasFormProps {
  selectedFazendaId: string;
  onSuccess: () => void;
}

export interface UseDoadorasFormReturn {
  // State
  formData: DoadoraFormData;
  setFormData: React.Dispatch<React.SetStateAction<DoadoraFormData>>;
  racaSelecionada: string;
  setRacaSelecionada: (raca: string) => void;
  showDialog: boolean;
  setShowDialog: (show: boolean) => void;
  submitting: boolean;

  // Actions
  resetForm: () => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  handleDialogClose: (open: boolean) => void;
  handleRacaChange: (value: string) => void;
}

export function useDoadorasForm({
  selectedFazendaId,
  onSuccess,
}: UseDoadorasFormProps): UseDoadorasFormReturn {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Dialog state
  const [showDialog, setShowDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form data
  const [formData, setFormData] = useState<DoadoraFormData>(initialFormData);
  const [racaSelecionada, setRacaSelecionada] = useState<string>('');

  // Reset form to initial state
  const resetForm = useCallback(() => {
    setFormData(initialFormData);
    setRacaSelecionada('');
  }, []);

  // Handle raca change
  const handleRacaChange = useCallback(
    (value: string) => {
      setRacaSelecionada(value);
      if (value === 'Outra') {
        setFormData((prev) => ({ ...prev, raca: '', racaCustom: '' }));
      } else {
        setFormData((prev) => ({ ...prev, raca: value, racaCustom: '' }));
      }
    },
    []
  );

  // Handle dialog close
  const handleDialogClose = useCallback(
    (open: boolean) => {
      setShowDialog(open);
      if (!open) {
        resetForm();
      }
    },
    [resetForm]
  );

  // Handle form submission
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!selectedFazendaId) {
        toast({
          title: 'Erro de validacao',
          description: 'Selecione a fazenda primeiro',
          variant: 'destructive',
        });
        return;
      }

      if (!formData.registro.trim()) {
        toast({
          title: 'Erro de validacao',
          description: 'Registro e obrigatorio',
          variant: 'destructive',
        });
        return;
      }

      // Validate raca
      const racaFinal =
        racaSelecionada === 'Outra' ? formData.racaCustom.trim() : formData.raca.trim();
      if (!racaFinal) {
        toast({
          title: 'Erro de validacao',
          description: 'Raca e obrigatoria',
          variant: 'destructive',
        });
        return;
      }

      try {
        setSubmitting(true);

        const doadoraData: Record<string, string | null> = {
          fazenda_id: selectedFazendaId,
          registro: formData.registro.trim(),
          raca: racaFinal,
        };

        const { data, error } = await supabase
          .from('doadoras')
          .insert([doadoraData])
          .select()
          .single();

        if (error) throw error;

        toast({
          title: 'Doadora criada',
          description: 'Doadora criada com sucesso',
        });

        setShowDialog(false);
        resetForm();
        onSuccess();

        // Navigate to the created doadora's detail page
        if (data?.id) {
          navigate(`/doadoras/${data.id}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        toast({
          title: 'Erro ao criar doadora',
          description:
            errorMessage.includes('RLS') || errorMessage.includes('policy')
              ? 'RLS esta bloqueando escrita. Configure politicas anon no Supabase.'
              : errorMessage,
          variant: 'destructive',
        });
      } finally {
        setSubmitting(false);
      }
    },
    [formData, racaSelecionada, selectedFazendaId, toast, resetForm, onSuccess, navigate]
  );

  return {
    // State
    formData,
    setFormData,
    racaSelecionada,
    setRacaSelecionada,
    showDialog,
    setShowDialog,
    submitting,

    // Actions
    resetForm,
    handleSubmit,
    handleDialogClose,
    handleRacaChange,
  };
}

export default useDoadorasForm;
