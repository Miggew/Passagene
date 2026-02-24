/**
 * Hook para gerenciar seleção de receptoras no wizard de protocolo
 * - Lista local de receptoras selecionadas
 * - Adicionar/remover receptoras
 * - Criar nova receptora
 * - Estados dos dialogs
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { validarTransicaoStatus } from '@/lib/receptoraStatus';
import { todayISO as getTodayDateString } from '@/lib/dateUtils';
import type { Receptora } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import type { ReceptoraLocal, ReceptoraComStatus } from './useProtocoloWizardData';

export interface AddReceptoraFormData {
  receptora_id: string;
  observacoes: string;
  ciclando_classificacao: 'N' | 'CL' | null;
  qualidade_semaforo: 1 | 2 | 3 | null;
}

export interface CreateReceptoraFormData {
  identificacao: string;
  nome: string;
  observacoes: string;
  ciclando_classificacao?: 'N' | 'CL' | null;
  qualidade_semaforo?: 1 | 2 | 3 | null;
}

export interface UseProtocoloWizardReceptorasProps {
  fazendaId: string;
  allReceptoras: Receptora[];
  receptorasComStatus: ReceptoraComStatus[];
  selectedIds: Set<string>;
  onReceptorasReload: () => Promise<void>;
}

export interface UseProtocoloWizardReceptorasReturn {
  // Local receptoras list
  receptorasLocais: ReceptoraLocal[];
  setReceptorasLocais: React.Dispatch<React.SetStateAction<ReceptoraLocal[]>>;

  // Dialog states
  showAddReceptora: boolean;
  setShowAddReceptora: (show: boolean) => void;
  showCreateReceptora: boolean;
  setShowCreateReceptora: (show: boolean) => void;

  // Search state
  buscaReceptora: string;
  setBuscaReceptora: (busca: string) => void;
  popoverAberto: boolean;
  setPopoverAberto: (open: boolean) => void;

  // Form states
  addReceptoraForm: AddReceptoraFormData;
  setAddReceptoraForm: React.Dispatch<React.SetStateAction<AddReceptoraFormData>>;
  createReceptoraForm: CreateReceptoraFormData;
  setCreateReceptoraForm: React.Dispatch<React.SetStateAction<CreateReceptoraFormData>>;

  // Submitting state
  submitting: boolean;

  // Actions
  handleAddReceptora: () => Promise<void>;
  handleCreateReceptora: () => Promise<void>;
  handleRemoveReceptora: (index: number) => void;
  handleUpdateCiclando: (index: number, value: 'N' | 'CL' | null) => void;
  handleUpdateQualidade: (index: number, value: 1 | 2 | 3 | null) => void;
  resetAddForm: () => void;
  resetCreateForm: () => void;
}

export function useProtocoloWizardReceptoras({
  fazendaId,
  allReceptoras,
  receptorasComStatus,
  selectedIds,
  onReceptorasReload,
}: UseProtocoloWizardReceptorasProps): UseProtocoloWizardReceptorasReturn {
  const { toast } = useToast();

  // Local receptoras list
  const [receptorasLocais, setReceptorasLocais] = useState<ReceptoraLocal[]>([]);

  // Dialog states
  const [showAddReceptora, setShowAddReceptora] = useState(false);
  const [showCreateReceptora, setShowCreateReceptora] = useState(false);

  // Search state
  const [buscaReceptora, setBuscaReceptora] = useState('');
  const [popoverAberto, setPopoverAberto] = useState(false);

  // Form states
  const [addReceptoraForm, setAddReceptoraForm] = useState<AddReceptoraFormData>({
    receptora_id: '',
    observacoes: '',
    ciclando_classificacao: null,
    qualidade_semaforo: null,
  });

  const [createReceptoraForm, setCreateReceptoraForm] = useState<CreateReceptoraFormData>({
    identificacao: '',
    nome: '',
    observacoes: '',
    ciclando_classificacao: null,
    qualidade_semaforo: null,
  });

  // Submitting state
  const [submitting, setSubmitting] = useState(false);

  // Reset add form
  const resetAddForm = useCallback(() => {
    setAddReceptoraForm({
      receptora_id: '',
      observacoes: '',
      ciclando_classificacao: null,
      qualidade_semaforo: null,
    });
    setBuscaReceptora('');
    setPopoverAberto(false);
  }, []);

  // Reset create form
  const resetCreateForm = useCallback(() => {
    setCreateReceptoraForm({
      identificacao: '',
      nome: '',
      observacoes: '',
      ciclando_classificacao: null,
      qualidade_semaforo: null,
    });
  }, []);

  // Add existing receptora
  const handleAddReceptora = useCallback(async () => {
    const receptoraIdNormalized = addReceptoraForm.receptora_id?.trim() || '';

    if (!receptoraIdNormalized) {
      toast({
        title: 'Erro',
        description: 'Selecione uma receptora',
        variant: 'destructive',
      });
      return;
    }

    // Find receptora in list
    const receptora = allReceptoras.find(r => {
      const rId = r.id ? String(r.id).trim() : '';
      return rId === receptoraIdNormalized;
    });

    if (!receptora || !receptora.id) {
      toast({
        title: 'Erro',
        description: 'Receptora não encontrada ou inválida',
        variant: 'destructive',
      });
      return;
    }

    // Validate receptora is VAZIA
    const statusAtual = receptora.status_reprodutivo || 'VAZIA';
    const validacao = validarTransicaoStatus(statusAtual, 'ENTRAR_PASSO1');

    if (!validacao.valido) {
      toast({
        title: 'Erro de validação',
        description: validacao.mensagem || 'A receptora não pode entrar no protocolo no estado atual',
        variant: 'destructive',
      });
      return;
    }

    // Check for duplicates
    if (selectedIds.has(receptoraIdNormalized)) {
      toast({
        title: 'Receptora já adicionada',
        description: 'Esta receptora já está na lista de selecionadas',
        variant: 'destructive',
      });
      return;
    }

    // Find historicoStats from receptorasComStatus
    const receptoraComStatus = receptorasComStatus.find(r => {
      const rId = r.id ? String(r.id).trim() : '';
      return rId === receptoraIdNormalized;
    });

    // Add to local list
    setReceptorasLocais(prev => {
      const alreadyExists = prev.some(r => {
        const rId = r.id ? String(r.id).trim() : '';
        return rId === receptoraIdNormalized;
      });

      if (alreadyExists) {
        return prev;
      }

      return [
        ...prev,
        {
          id: receptora.id,
          identificacao: receptora.identificacao,
          nome: receptora.nome,
          observacoes: addReceptoraForm.observacoes?.trim() || undefined,
          ciclando_classificacao: addReceptoraForm.ciclando_classificacao || null,
          qualidade_semaforo: addReceptoraForm.qualidade_semaforo || null,
          historicoStats: receptoraComStatus?.historicoStats,
        },
      ];
    });

    // Reset form and close
    resetAddForm();
    setShowAddReceptora(false);
  }, [addReceptoraForm, allReceptoras, selectedIds, toast, resetAddForm]);

  // Create new receptora
  const handleCreateReceptora = useCallback(async () => {
    if (!createReceptoraForm.identificacao.trim()) {
      toast({
        title: 'Erro de validação',
        description: 'Identificação (brinco) é obrigatória',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      // Get receptoras from fazenda using view
      const { data: receptorasView, error: viewError } = await supabase
        .from('receptoras')
        .select('id')
        .eq('fazenda_atual_id', fazendaId);

      if (viewError) throw viewError;

      const receptoraIds = receptorasView?.map(r => r.id) || [];

      // Check for duplicate brinco
      if (receptoraIds.length > 0) {
        const { data: receptorasComBrinco, error: brincoError } = await supabase
          .from('receptoras')
          .select('id, identificacao, nome')
          .in('id', receptoraIds)
          .ilike('identificacao', createReceptoraForm.identificacao.trim());

        if (brincoError) throw brincoError;

        if (receptorasComBrinco && receptorasComBrinco.length > 0) {
          const nomeReceptora = receptorasComBrinco[0].nome
            ? `"${receptorasComBrinco[0].nome}"`
            : 'sem nome';
          throw new Error(
            `Já existe uma receptora com o brinco "${createReceptoraForm.identificacao.trim()}" nesta fazenda (Nome: ${nomeReceptora}).`
          );
        }
      }

      // Check for duplicate name
      if (createReceptoraForm.nome.trim() && receptoraIds.length > 0) {
        const { data: receptorasComNome, error: nomeError } = await supabase
          .from('receptoras')
          .select('id, identificacao')
          .in('id', receptoraIds)
          .ilike('nome', createReceptoraForm.nome.trim());

        if (nomeError) throw nomeError;

        if (receptorasComNome && receptorasComNome.length > 0) {
          throw new Error(
            `Já existe uma receptora com o nome "${createReceptoraForm.nome.trim()}" nesta fazenda (Brinco: ${receptorasComNome[0].identificacao}).`
          );
        }
      }

      // Create receptora
      const receptoraData: Record<string, string> = {
        identificacao: createReceptoraForm.identificacao,
      };

      if (createReceptoraForm.nome.trim()) {
        receptoraData.nome = createReceptoraForm.nome;
      }

      const { data: novaReceptora, error: receptoraError } = await supabase
        .from('receptoras')
        .insert([receptoraData])
        .select()
        .single();

      if (receptoraError) {
        if (receptoraError.code === '23505') {
          throw new Error('Já existe uma receptora com esse brinco nesta fazenda.');
        }
        throw receptoraError;
      }

      // Insert fazenda history
      const { error: historicoError } = await supabase
        .from('receptora_fazenda_historico')
        .insert([{
          receptora_id: novaReceptora.id,
          fazenda_id: fazendaId,
          data_inicio: getTodayDateString(),
          data_fim: null,
        }]);

      // Ignore history error - receptora was created

      // Add to local list
      setReceptorasLocais(prev => [
        ...prev,
        {
          id: novaReceptora.id,
          identificacao: novaReceptora.identificacao,
          nome: novaReceptora.nome,
          observacoes: createReceptoraForm.observacoes || undefined,
          ciclando_classificacao: createReceptoraForm.ciclando_classificacao || null,
          qualidade_semaforo: createReceptoraForm.qualidade_semaforo || null,
          isNew: true,
        },
      ]);

      resetCreateForm();
      setShowCreateReceptora(false);

      // Reload receptoras
      await onReceptorasReload();
    } catch (error) {
      toast({
        title: 'Erro ao criar receptora',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }, [createReceptoraForm, fazendaId, toast, resetCreateForm, onReceptorasReload]);

  // Remove receptora from list
  const handleRemoveReceptora = useCallback((index: number) => {
    setReceptorasLocais(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Update ciclando classification
  const handleUpdateCiclando = useCallback((index: number, value: 'N' | 'CL' | null) => {
    setReceptorasLocais(prev =>
      prev.map((item, i) =>
        i === index ? { ...item, ciclando_classificacao: value } : item
      )
    );
  }, []);

  // Update qualidade
  const handleUpdateQualidade = useCallback((index: number, value: 1 | 2 | 3 | null) => {
    setReceptorasLocais(prev =>
      prev.map((item, i) =>
        i === index ? { ...item, qualidade_semaforo: value } : item
      )
    );
  }, []);

  return {
    // Local receptoras list
    receptorasLocais,
    setReceptorasLocais,

    // Dialog states
    showAddReceptora,
    setShowAddReceptora,
    showCreateReceptora,
    setShowCreateReceptora,

    // Search state
    buscaReceptora,
    setBuscaReceptora,
    popoverAberto,
    setPopoverAberto,

    // Form states
    addReceptoraForm,
    setAddReceptoraForm,
    createReceptoraForm,
    setCreateReceptoraForm,

    // Submitting state
    submitting,

    // Actions
    handleAddReceptora,
    handleCreateReceptora,
    handleRemoveReceptora,
    handleUpdateCiclando,
    handleUpdateQualidade,
    resetAddForm,
    resetCreateForm,
  };
}

export default useProtocoloWizardReceptoras;
