import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { ProtocoloSincronizacao, ProtocoloReceptoraQuery } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { isReceptoraDisponivel, getReceptoraIndisponivelMotivo } from '@/lib/receptoraStatus';
import type { ReceptoraWithStatus } from './useProtocoloData';

interface UseAddReceptoraProtocoloProps {
  protocoloId: string | undefined;
  protocolo: ProtocoloSincronizacao | null;
  receptoras: ReceptoraWithStatus[];
  onSuccess: () => void;
}

export interface AddReceptoraFormData {
  receptora_id: string;
  observacoes: string;
}

export function useAddReceptoraProtocolo({
  protocoloId,
  protocolo,
  receptoras,
  onSuccess,
}: UseAddReceptoraProtocoloProps) {
  const { toast } = useToast();
  const isAddingRef = useRef(false);

  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<AddReceptoraFormData>({
    receptora_id: '',
    observacoes: '',
  });

  const resetForm = useCallback(() => {
    setFormData({ receptora_id: '', observacoes: '' });
  }, []);

  const updateField = useCallback((field: keyof AddReceptoraFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleAddReceptora = useCallback(async () => {
    if (submitting || isAddingRef.current) return;

    if (!formData.receptora_id) {
      toast({
        title: 'Erro',
        description: 'Selecione uma receptora',
        variant: 'destructive',
      });
      return;
    }

    try {
      isAddingRef.current = true;
      setSubmitting(true);

      // Buscar informações da receptora
      const { data: receptoraData, error: receptoraDataError } = await supabase
        .from('receptoras')
        .select('id, identificacao, status_reprodutivo')
        .eq('id', formData.receptora_id)
        .single();

      if (receptoraDataError) throw receptoraDataError;

      // Verificar se já existe receptora com o mesmo brinco no protocolo
      const { data: prData } = await supabase
        .from('protocolo_receptoras')
        .select('receptora_id')
        .eq('protocolo_id', protocoloId);

      if (prData && prData.length > 0) {
        const receptoraIdsNoProtocolo = prData.map(pr => pr.receptora_id);

        // Verificar se a mesma receptora já está no protocolo
        if (receptoraIdsNoProtocolo.includes(formData.receptora_id)) {
          toast({
            title: 'Receptora já está no protocolo',
            description: 'Essa receptora já está adicionada a este protocolo.',
            variant: 'destructive',
          });
          return;
        }

        // Buscar dados das receptoras no protocolo para verificar por brinco
        const { data: receptorasNoProtocolo } = await supabase
          .from('receptoras')
          .select('id, identificacao')
          .in('id', receptoraIdsNoProtocolo);

        const mesmoBrinco = receptorasNoProtocolo?.find(
          r => r.identificacao === receptoraData.identificacao
        );

        if (mesmoBrinco) {
          toast({
            title: 'Brinco já está no protocolo',
            description: `Já existe uma receptora com o brinco "${receptoraData.identificacao}" neste protocolo.`,
            variant: 'destructive',
          });
          return;
        }
      }

      // Verificar protocolos ativos
      const { data: protocolosAtivos } = await supabase
        .from('protocolo_receptoras')
        .select(`
          id,
          protocolo_id,
          status,
          motivo_inapta,
          protocolos_sincronizacao!inner (
            id,
            status,
            data_inicio
          )
        `)
        .eq('receptora_id', formData.receptora_id)
        .neq('protocolos_sincronizacao.status', 'SINCRONIZADO');

      if (protocolosAtivos && protocolosAtivos.length > 0) {
        const noProtocoloAtual = protocolosAtivos.find(
          (pr: ProtocoloReceptoraQuery) => pr.protocolo_id === protocoloId
        );

        if (noProtocoloAtual) {
          toast({
            title: 'Receptora já está no protocolo',
            description: `Esta receptora já foi adicionada (Status: ${noProtocoloAtual.status}).`,
            variant: 'destructive',
          });
          onSuccess();
          return;
        }

        // Filtrar protocolos bloqueantes
        const protocolosBloqueantes = protocolosAtivos.filter((pr: ProtocoloReceptoraQuery) => {
          const protocoloStatus = pr.protocolos_sincronizacao?.status;
          const receptoraStatus = pr.status;

          if (receptoraStatus === 'INAPTA') return false;

          if ((receptoraStatus === 'APTA' || receptoraStatus === 'INICIADA') &&
              protocoloStatus !== 'SINCRONIZADO' && protocoloStatus !== 'FECHADO') {
            return true;
          }

          return false;
        });

        if (protocolosBloqueantes.length > 0) {
          const outroProtocolo = protocolosBloqueantes[0];
          const protocoloInfo = outroProtocolo.protocolos_sincronizacao;
          toast({
            title: 'Receptora em outro protocolo ativo',
            description: `Esta receptora está vinculada a outro protocolo ativo (ID: ${protocoloInfo?.id?.substring(0, 8)}). Finalize o protocolo anterior antes de adicionar a um novo.`,
            variant: 'destructive',
          });
          return;
        }
      }

      // Verificar status da receptora
      const status = receptoraData?.status_reprodutivo || 'VAZIA';
      if (!isReceptoraDisponivel(status)) {
        toast({
          title: 'Receptora não disponível',
          description: getReceptoraIndisponivelMotivo(status),
          variant: 'destructive',
        });
        return;
      }

      // Inserir no protocolo
      const insertData = {
        protocolo_id: protocoloId,
        receptora_id: formData.receptora_id,
        evento_fazenda_id: protocolo?.fazenda_id,
        data_inclusao: protocolo?.data_inicio,
        status: 'INICIADA',
        observacoes: formData.observacoes || null,
      };

      const { error } = await supabase
        .from('protocolo_receptoras')
        .insert([insertData])
        .select();

      if (error) {
        if (error.code === '23505') {
          toast({
            title: 'Receptora já está no protocolo',
            description: 'Esta receptora já foi adicionada a este protocolo.',
            variant: 'destructive',
          });
          onSuccess();
          return;
        }
        throw error;
      }

      toast({
        title: 'Receptora adicionada',
        description: 'Receptora adicionada ao protocolo com sucesso',
      });

      resetForm();
      onSuccess();
    } catch (error) {
      toast({
        title: 'Erro ao adicionar receptora',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
      isAddingRef.current = false;
    }
  }, [submitting, formData, protocoloId, protocolo, onSuccess, resetForm, toast]);

  return {
    formData,
    setFormData,
    updateField,
    submitting,
    resetForm,
    handleAddReceptora,
  };
}
