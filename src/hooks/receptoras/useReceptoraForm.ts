/**
 * Hook para gerenciar formulário de criar/editar receptora
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Receptora } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export interface ReceptoraFormData {
  identificacao: string;
  nome: string;
}

export interface UseReceptoraFormProps {
  selectedFazendaId: string;
  onSuccess?: () => void;
}

export interface UseReceptoraFormReturn {
  // Create form state
  formData: ReceptoraFormData;
  setFormData: React.Dispatch<React.SetStateAction<ReceptoraFormData>>;
  showDialog: boolean;
  setShowDialog: (show: boolean) => void;

  // Edit form state
  editFormData: ReceptoraFormData;
  setEditFormData: React.Dispatch<React.SetStateAction<ReceptoraFormData>>;
  editingReceptora: Receptora | null;
  showEditDialog: boolean;
  setShowEditDialog: (show: boolean) => void;

  // Loading state
  submitting: boolean;

  // Actions
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  handleEditSubmit: (e: React.FormEvent) => Promise<void>;
  handleEdit: (receptora: Receptora) => void;
  resetForm: () => void;
  resetEditForm: () => void;
}

export function useReceptoraForm({ selectedFazendaId, onSuccess }: UseReceptoraFormProps): UseReceptoraFormReturn {
  const { toast } = useToast();

  // Create form state
  const [formData, setFormData] = useState<ReceptoraFormData>({
    identificacao: '',
    nome: '',
  });
  const [showDialog, setShowDialog] = useState(false);

  // Edit form state
  const [editFormData, setEditFormData] = useState<ReceptoraFormData>({
    identificacao: '',
    nome: '',
  });
  const [editingReceptora, setEditingReceptora] = useState<Receptora | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  // Loading state
  const [submitting, setSubmitting] = useState(false);

  // Reset forms
  const resetForm = useCallback(() => {
    setFormData({ identificacao: '', nome: '' });
  }, []);

  const resetEditForm = useCallback(() => {
    setEditFormData({ identificacao: '', nome: '' });
    setEditingReceptora(null);
  }, []);

  // Open edit dialog
  const handleEdit = useCallback((receptora: Receptora) => {
    setEditingReceptora(receptora);
    setEditFormData({
      identificacao: receptora.identificacao,
      nome: receptora.nome || '',
    });
    setShowEditDialog(true);
  }, []);

  // Create new receptora
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.identificacao.trim()) {
      toast({
        title: 'Erro de validação',
        description: 'Identificação (brinco) é obrigatória',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedFazendaId) {
      toast({
        title: 'Erro de validação',
        description: 'Selecione uma fazenda primeiro',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      // Check for duplicates
      const { data: receptorasView, error: viewError } = await supabase
        .from('vw_receptoras_fazenda_atual')
        .select('receptora_id')
        .eq('fazenda_id_atual', selectedFazendaId);

      if (viewError) throw viewError;

      const receptoraIds = receptorasView?.map(r => r.receptora_id) || [];

      if (receptoraIds.length > 0) {
        const { data: receptorasComBrinco, error: brincoError } = await supabase
          .from('receptoras')
          .select('id, identificacao, nome')
          .in('id', receptoraIds)
          .ilike('identificacao', formData.identificacao.trim());

        if (brincoError) throw brincoError;

        if (receptorasComBrinco && receptorasComBrinco.length > 0) {
          const nomeReceptora = receptorasComBrinco[0].nome ? `"${receptorasComBrinco[0].nome}"` : 'sem nome';
          throw new Error(`Já existe uma receptora com o brinco "${formData.identificacao.trim()}" nesta fazenda (Nome: ${nomeReceptora}).`);
        }

        // Check for name duplicate if name provided
        if (formData.nome.trim()) {
          const { data: receptorasComNome, error: nomeError } = await supabase
            .from('receptoras')
            .select('id, identificacao')
            .in('id', receptoraIds)
            .ilike('nome', formData.nome.trim());

          if (nomeError) throw nomeError;

          if (receptorasComNome && receptorasComNome.length > 0) {
            throw new Error(`Já existe uma receptora com o nome "${formData.nome.trim()}" nesta fazenda (Brinco: ${receptorasComNome[0].identificacao}).`);
          }
        }
      }

      const insertData: Record<string, string> = {
        identificacao: formData.identificacao,
      };

      if (formData.nome.trim()) {
        insertData.nome = formData.nome;
      }

      const { data: novaReceptora, error } = await supabase
        .from('receptoras')
        .insert([insertData])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('Já existe uma receptora com esse brinco nesta fazenda.');
        }
        throw error;
      }

      // Insert into fazenda history
      await supabase
        .from('receptora_fazenda_historico')
        .insert([{
          receptora_id: novaReceptora.id,
          fazenda_id: selectedFazendaId,
          data_inicio: new Date().toISOString().split('T')[0],
          data_fim: null,
        }]);

      toast({
        title: 'Receptora criada',
        description: 'Receptora criada com sucesso',
      });

      setShowDialog(false);
      resetForm();
      onSuccess?.();
    } catch (error) {
      toast({
        title: 'Erro ao criar receptora',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }, [formData, selectedFazendaId, toast, resetForm, onSuccess]);

  // Edit receptora
  const handleEditSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingReceptora) return;

    if (!editFormData.identificacao.trim()) {
      toast({
        title: 'Erro de validação',
        description: 'Identificação (brinco) é obrigatória',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const brincoAnterior = editingReceptora.identificacao;
      const brincoNovo = editFormData.identificacao.trim();
      const brincoAlterado = brincoAnterior !== brincoNovo;

      const updateData: Record<string, string | null> = {
        identificacao: brincoNovo,
        nome: editFormData.nome.trim() || null,
      };

      const { error } = await supabase
        .from('receptoras')
        .update(updateData)
        .eq('id', editingReceptora.id);

      if (error) {
        if (error.code === '23505') {
          throw new Error('Já existe uma receptora com esse brinco nesta fazenda.');
        }
        throw error;
      }

      // Record rename in history
      if (brincoAlterado) {
        try {
          await supabase
            .from('receptora_renomeacoes_historico')
            .insert([{
              receptora_id: editingReceptora.id,
              brinco_anterior: brincoAnterior,
              brinco_novo: brincoNovo,
              data_renomeacao: new Date().toISOString(),
              motivo: 'EDICAO_MANUAL',
              observacoes: null,
            }]);
        } catch {
          // Don't fail the operation if history insert fails
        }
      }

      toast({
        title: 'Receptora atualizada',
        description: brincoAlterado
          ? `Receptora atualizada. Brinco alterado de "${brincoAnterior}" para "${brincoNovo}".`
          : 'Receptora atualizada com sucesso',
      });

      setShowEditDialog(false);
      resetEditForm();
      onSuccess?.();
    } catch (error) {
      toast({
        title: 'Erro ao atualizar receptora',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }, [editFormData, editingReceptora, toast, resetEditForm, onSuccess]);

  return {
    // Create form state
    formData,
    setFormData,
    showDialog,
    setShowDialog,

    // Edit form state
    editFormData,
    setEditFormData,
    editingReceptora,
    showEditDialog,
    setShowEditDialog,

    // Loading state
    submitting,

    // Actions
    handleSubmit,
    handleEditSubmit,
    handleEdit,
    resetForm,
    resetEditForm,
  };
}

export default useReceptoraForm;
