/**
 * Hook para ações do 2º passo do protocolo
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { ProtocoloSincronizacao } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import type { ReceptoraWithStatus } from './useProtocoloPasso2Data';

export interface UseProtocoloPasso2ActionsProps {
  protocoloId: string;
  protocolo: ProtocoloSincronizacao | null;
  receptoras: ReceptoraWithStatus[];
  setReceptoras: React.Dispatch<React.SetStateAction<ReceptoraWithStatus[]>>;
  setProtocolo: React.Dispatch<React.SetStateAction<ProtocoloSincronizacao | null>>;
  passo2Form: { data: string; tecnico: string };
  motivosInapta: Record<string, string>;
}

export interface UseProtocoloPasso2ActionsReturn {
  submitting: boolean;
  showResumo: boolean;
  setShowResumo: React.Dispatch<React.SetStateAction<boolean>>;
  handleStatusChange: (receptoraId: string, status: 'APTA' | 'INAPTA' | 'INICIADA') => void;
  handleMotivoChange: (receptoraId: string, motivo: string) => void;
  handleFinalizarPasso2: () => Promise<void>;
  handleCloseResumo: () => void;
}

export function useProtocoloPasso2Actions({
  protocoloId,
  protocolo,
  receptoras,
  setReceptoras,
  setProtocolo,
  passo2Form,
  motivosInapta,
}: UseProtocoloPasso2ActionsProps): UseProtocoloPasso2ActionsReturn {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [showResumo, setShowResumo] = useState(false);

  const handleStatusChange = useCallback(
    (receptoraId: string, status: 'APTA' | 'INAPTA' | 'INICIADA') => {
      setReceptoras((prev) =>
        prev.map((r) =>
          r.id === receptoraId
            ? {
                ...r,
                pr_status: status,
                pr_motivo_inapta: status === 'APTA' || status === 'INICIADA' ? undefined : r.pr_motivo_inapta,
              }
            : r
        )
      );
    },
    [setReceptoras]
  );

  const handleMotivoChange = useCallback(
    (receptoraId: string, motivo: string) => {
      setReceptoras((prev) =>
        prev.map((r) =>
          r.id === receptoraId ? { ...r, pr_motivo_inapta: motivo.trim() || undefined } : r
        )
      );
    },
    [setReceptoras]
  );

  const handleFinalizarPasso2 = useCallback(async () => {
    if (submitting) return;

    // Validation
    if (!passo2Form.data || !passo2Form.tecnico.trim()) {
      toast({
        title: 'Erro de validação',
        description: 'Data e técnico responsável são obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    const pendentes = receptoras.filter((r) => r.pr_status === 'INICIADA');
    if (pendentes.length > 0) {
      toast({
        title: 'Erro',
        description: `Ainda há ${pendentes.length} receptora(s) pendente(s) de revisão`,
        variant: 'destructive',
      });
      return;
    }

    if (receptoras.length === 0) {
      toast({
        title: 'Erro',
        description: 'Não é possível finalizar protocolo sem receptoras',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const hoje = new Date();
      const dataRetirada = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

      const receptorasConfirmadas = receptoras.filter((r) => r.pr_status === 'APTA');
      const receptorasDescartadas = receptoras.filter((r) => r.pr_status === 'INAPTA');

      const temReceptorasAptas = receptorasConfirmadas.length > 0;
      const novoStatusProtocolo = temReceptorasAptas ? 'SINCRONIZADO' : 'FECHADO';

      // Update protocolo_receptoras
      const protocoloReceptorasPromises = [
        ...receptorasConfirmadas.map(async (r) => {
          const { error } = await supabase
            .from('protocolo_receptoras')
            .update({ status: 'APTA', motivo_inapta: null })
            .eq('protocolo_id', protocoloId)
            .eq('receptora_id', r.id);
          if (error) throw error;
        }),
        ...receptorasDescartadas.map(async (r) => {
          const motivoInapta = motivosInapta[r.id] || r.pr_motivo_inapta || null;
          const { error } = await supabase
            .from('protocolo_receptoras')
            .update({ status: 'INAPTA', motivo_inapta: motivoInapta })
            .eq('protocolo_id', protocoloId)
            .eq('receptora_id', r.id);
          if (error) throw error;
        }),
      ];

      await Promise.all(protocoloReceptorasPromises);

      // Update protocolo
      const { error: protocoloError } = await supabase
        .from('protocolos_sincronizacao')
        .update({
          status: novoStatusProtocolo,
          passo2_data: passo2Form.data,
          passo2_tecnico_responsavel: passo2Form.tecnico.trim(),
          data_retirada: dataRetirada,
          responsavel_retirada: protocolo?.responsavel_inicio || null,
        })
        .eq('id', protocoloId);

      if (protocoloError) throw protocoloError;

      // Update local state
      setProtocolo({
        ...protocolo!,
        status: novoStatusProtocolo as 'SINCRONIZADO' | 'FECHADO',
        passo2_data: passo2Form.data,
        passo2_tecnico_responsavel: passo2Form.tecnico.trim(),
        data_retirada: dataRetirada,
        responsavel_retirada: protocolo?.responsavel_inicio || null,
      });

      // Update receptoras status
      const statusUpdatePromises = [
        ...receptorasConfirmadas.map(async (r) => {
          const { error } = await supabase
            .from('receptoras')
            .update({ status_reprodutivo: 'SINCRONIZADA' })
            .eq('id', r.id);
          if (error) throw error;
        }),
        ...receptorasDescartadas.map(async (r) => {
          const { error } = await supabase
            .from('receptoras')
            .update({ status_reprodutivo: 'VAZIA' })
            .eq('id', r.id);
          if (error) throw error;
        }),
      ];

      await Promise.all(statusUpdatePromises);

      setShowResumo(true);
    } catch (error) {
      toast({
        title: 'Erro ao finalizar 2º passo',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }, [
    submitting,
    passo2Form,
    receptoras,
    protocoloId,
    protocolo,
    motivosInapta,
    setProtocolo,
    toast,
  ]);

  const handleCloseResumo = useCallback(() => {
    setShowResumo(false);
    const confirmadas = receptoras.filter((r) => r.pr_status === 'APTA').length;
    toast({
      title: '2º passo concluído com sucesso',
      description: `${confirmadas} receptoras confirmadas para TE`,
    });
    navigate('/protocolos');
  }, [receptoras, navigate, toast]);

  return {
    submitting,
    showResumo,
    setShowResumo,
    handleStatusChange,
    handleMotivoChange,
    handleFinalizarPasso2,
    handleCloseResumo,
  };
}
