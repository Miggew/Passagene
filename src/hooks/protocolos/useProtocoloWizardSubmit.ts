/**
 * Hook para gerenciar a submissão do protocolo no wizard
 * - Validação
 * - Criação do protocolo via RPC
 * - Atualização de status das receptoras
 */

import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { atualizarStatusReceptora } from '@/lib/receptoraStatus';
import { useToast } from '@/hooks/use-toast';
import type { ReceptoraLocal, ProtocoloFormData } from './useProtocoloWizardData';

export interface UseProtocoloWizardSubmitProps {
  protocoloData: ProtocoloFormData;
  receptorasLocais: ReceptoraLocal[];
}

export interface UseProtocoloWizardSubmitReturn {
  // States
  submitting: boolean;
  showConfirmExit: boolean;
  setShowConfirmExit: (show: boolean) => void;
  showResumo: boolean;
  setShowResumo: (show: boolean) => void;

  // Actions
  handleFinalizarPasso1: () => Promise<void>;
  handleConfirmExit: () => void;

  // Validation
  validateProtocoloForm: () => boolean;
}

export function useProtocoloWizardSubmit({
  protocoloData,
  receptorasLocais,
}: UseProtocoloWizardSubmitProps): UseProtocoloWizardSubmitReturn {
  const navigate = useNavigate();
  const { toast } = useToast();

  // States
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmExit, setShowConfirmExit] = useState(false);
  const [showResumo, setShowResumo] = useState(false);
  const isFinalizingRef = useRef(false);

  // Validate protocol form
  const validateProtocoloForm = useCallback((): boolean => {
    if (
      !protocoloData.fazenda_id ||
      !protocoloData.data_inicio ||
      !protocoloData.veterinario.trim() ||
      !protocoloData.tecnico.trim()
    ) {
      toast({
        title: 'Erro de validação',
        description: 'Fazenda, data de início, veterinário e técnico são obrigatórios',
        variant: 'destructive',
      });
      return false;
    }
    return true;
  }, [protocoloData, toast]);

  // Finalize step 1
  const handleFinalizarPasso1 = useCallback(async () => {
    // Protection against multiple clicks
    if (isFinalizingRef.current || submitting) {
      return;
    }

    // Validation: must have at least 1 receptora
    if (receptorasLocais.length === 0) {
      toast({
        title: 'Erro de validação',
        description: 'Adicione pelo menos 1 receptora antes de finalizar o 1º passo',
        variant: 'destructive',
      });
      return;
    }

    // Validation: all receptora IDs must be valid
    const receptorasIdsInvalidas = receptorasLocais.filter(
      r => !r.id || r.id === '' || r.id === null || r.id === undefined
    );

    if (receptorasIdsInvalidas.length > 0) {
      toast({
        title: 'Erro de validação',
        description: 'Seleção de receptora inválida. Refaça a seleção.',
        variant: 'destructive',
      });
      return;
    }

    // Extract valid IDs and corresponding data
    const receptorasValidas = receptorasLocais.filter(
      r => r.id && r.id !== '' && r.id !== null && r.id !== undefined
    );

    if (receptorasValidas.length !== receptorasLocais.length || receptorasValidas.length === 0) {
      toast({
        title: 'Erro de validação',
        description: 'Seleção de receptora inválida. Refaça a seleção.',
        variant: 'destructive',
      });
      return;
    }

    const receptorasIds = receptorasValidas.map(r => r.id!);
    const receptorasObservacoes = receptorasValidas.map(r => r.observacoes || null);
    const receptorasCiclando = receptorasValidas.map(r => r.ciclando_classificacao || null);
    const receptorasQualidade = receptorasValidas.map(r => r.qualidade_semaforo || null);

    try {
      isFinalizingRef.current = true;
      setSubmitting(true);

      // Use atomic RPC to create protocol + links in transaction
      const responsavel_inicio = `VET: ${protocoloData.veterinario.trim()} | TEC: ${protocoloData.tecnico.trim()}`;

      const { data: protocoloId, error: rpcError } = await supabase.rpc(
        'criar_protocolo_passo1_atomico',
        {
          p_fazenda_id: protocoloData.fazenda_id,
          p_data_inicio: protocoloData.data_inicio,
          p_responsavel_inicio: responsavel_inicio,
          p_receptoras_ids: receptorasIds,
          p_data_inclusao: protocoloData.data_inicio,
          p_observacoes: protocoloData.observacoes.trim() || null,
          p_receptoras_observacoes: receptorasObservacoes,
        }
      );

      if (rpcError) {
        throw rpcError;
      }

      if (!protocoloId) {
        throw new Error('Protocolo criado mas ID não retornado');
      }

      // Update classifications after creating protocol
      const { data: prData, error: prError } = await supabase
        .from('protocolo_receptoras')
        .select('id, receptora_id')
        .eq('protocolo_id', protocoloId)
        .in('receptora_id', receptorasIds);

      if (!prError && prData && prData.length > 0) {
        const receptoraIndexMap = new Map(receptorasIds.map((id, idx) => [id, idx]));

        const updatePromises = prData.map(async (pr) => {
          const receptoraIndex = receptoraIndexMap.get(pr.receptora_id);
          if (receptoraIndex === undefined) return { success: true };

          const ciclando = receptorasCiclando[receptoraIndex];
          const qualidade = receptorasQualidade[receptoraIndex];

          const { error: updateError } = await supabase
            .from('protocolo_receptoras')
            .update({
              ciclando_classificacao: ciclando,
              qualidade_semaforo: qualidade,
            })
            .eq('id', pr.id);

          return { success: !updateError, error: updateError };
        });

        const classResults = await Promise.allSettled(updatePromises);
        const classErrors = classResults.filter(
          r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value && !r.value.success)
        );
        if (classErrors.length > 0) {
          toast({
            title: 'Aviso',
            description: `Protocolo criado, mas ${classErrors.length} classificação(ões) não foram salvas. Edite o protocolo para corrigir.`,
            variant: 'destructive',
          });
        }
      }

      // Update receptoras status to EM_SINCRONIZACAO
      const statusUpdateResults = await Promise.all(
        receptorasIds.map((receptoraId) =>
          atualizarStatusReceptora(receptoraId, 'EM_SINCRONIZACAO')
        )
      );
      const statusErrors = statusUpdateResults
        .map((result, index) => ({ result, receptoraId: receptorasIds[index] }))
        .filter(({ result }) => result.error);
      if (statusErrors.length > 0) {
        throw new Error('Erro ao atualizar status das receptoras. Tente novamente.');
      }

      // Show resumo dialog instead of navigating directly
      setShowResumo(true);
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : 'Erro desconhecido ao finalizar protocolo';

      toast({
        title: 'Erro ao finalizar protocolo',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
      isFinalizingRef.current = false;
    }
  }, [protocoloData, receptorasLocais, toast, navigate, submitting]);

  // Confirm exit
  const handleConfirmExit = useCallback(() => {
    setShowConfirmExit(false);
    navigate('/protocolos');
  }, [navigate]);

  return {
    // States
    submitting,
    showConfirmExit,
    setShowConfirmExit,
    showResumo,
    setShowResumo,

    // Actions
    handleFinalizarPasso1,
    handleConfirmExit,

    // Validation
    validateProtocoloForm,
  };
}

export default useProtocoloWizardSubmit;
