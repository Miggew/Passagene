import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { ProtocoloSincronizacao } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { isReceptoraDisponivel, getReceptoraIndisponivelMotivo } from '@/lib/receptoraStatus';
import { todayISO as getTodayDateString } from '@/lib/dateUtils';

interface UseCreateReceptoraProtocoloProps {
  protocoloId: string | undefined;
  protocolo: ProtocoloSincronizacao | null;
  onSuccess: () => void;
}

export interface CreateReceptoraFormData {
  identificacao: string;
  nome: string;
  observacoes: string;
}

export function useCreateReceptoraProtocolo({
  protocoloId,
  protocolo,
  onSuccess,
}: UseCreateReceptoraProtocoloProps) {
  const { toast } = useToast();

  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<CreateReceptoraFormData>({
    identificacao: '',
    nome: '',
    observacoes: '',
  });

  const resetForm = useCallback(() => {
    setFormData({ identificacao: '', nome: '', observacoes: '' });
  }, []);

  const updateField = useCallback((field: keyof CreateReceptoraFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleCreateReceptora = useCallback(async () => {
    if (!formData.identificacao.trim()) {
      toast({
        title: 'Erro de validação',
        description: 'Identificação (brinco) é obrigatória',
        variant: 'destructive',
      });
      return;
    }

    if (!protocolo || !protocoloId) return;

    try {
      setSubmitting(true);

      const brinco = formData.identificacao.trim();

      // Verificar se já existe receptora com esse brinco
      const { data: receptorasComBrinco } = await supabase
        .from('receptoras')
        .select('id, identificacao, status_reprodutivo')
        .ilike('identificacao', brinco);

      if (receptorasComBrinco && receptorasComBrinco.length > 0) {
        // Verificar se alguma já está no protocolo atual
        const { data: prData } = await supabase
          .from('protocolo_receptoras')
          .select('receptora_id, status')
          .eq('protocolo_id', protocoloId);

        if (prData && prData.length > 0) {
          const receptoraIds = receptorasComBrinco.map(r => r.id);
          const prJaNoProtocolo = prData.find(pr => receptoraIds.includes(pr.receptora_id));

          if (prJaNoProtocolo) {
            toast({
              title: 'Receptora já está no protocolo',
              description: `Esta receptora já foi adicionada (Status: ${prJaNoProtocolo.status}).`,
              variant: 'destructive',
            });
            return;
          }

          // Verificar por brinco
          const receptoraIdsNoProtocolo = prData.map(pr => pr.receptora_id);
          const { data: receptorasNoProtocolo } = await supabase
            .from('receptoras')
            .select('id, identificacao')
            .in('id', receptoraIdsNoProtocolo);

          const mesmoBrincoNoProtocolo = receptorasNoProtocolo?.find(
            r => r.identificacao === brinco
          );

          if (mesmoBrincoNoProtocolo) {
            const prComMesmoBrinco = prData.find(pr => pr.receptora_id === mesmoBrincoNoProtocolo.id);
            toast({
              title: 'Brinco já está no protocolo',
              description: `Já existe uma receptora com o brinco "${brinco}" neste protocolo (Status: ${prComMesmoBrinco?.status || 'N/A'}).`,
              variant: 'destructive',
            });
            return;
          }
        }

        // Verificar status de cada receptora existente
        for (const receptoraExistente of receptorasComBrinco) {
          const status = receptoraExistente.status_reprodutivo || 'VAZIA';
          if (!isReceptoraDisponivel(status)) {
            toast({
              title: 'Receptora não disponível',
              description: `Já existe uma receptora com esse brinco que está ${getReceptoraIndisponivelMotivo(status)}`,
              variant: 'destructive',
            });
            return;
          }
        }

        // Verificar se alguma está na fazenda do protocolo
        const receptoraIds = receptorasComBrinco.map(r => r.id);
        const { data: historicoFazendas } = await supabase
          .from('receptora_fazenda_historico')
          .select('receptora_id, fazenda_id')
          .in('receptora_id', receptoraIds)
          .eq('fazenda_id', protocolo.fazenda_id)
          .is('data_fim', null);

        if (historicoFazendas && historicoFazendas.length > 0) {
          // Receptora existe na fazenda - usar a existente
          const receptoraIdNaFazenda = historicoFazendas[0].receptora_id;
          const receptoraExistente = receptorasComBrinco.find(r => r.id === receptoraIdNaFazenda);

          if (receptoraExistente) {
            const { error: protocoloError } = await supabase
              .from('protocolo_receptoras')
              .insert([{
                protocolo_id: protocoloId,
                receptora_id: receptoraExistente.id,
                evento_fazenda_id: protocolo.fazenda_id,
                data_inclusao: protocolo.data_inicio,
                status: 'INICIADA',
                observacoes: formData.observacoes || null,
              }]);

            if (protocoloError) {
              if (protocoloError.code === '23505') {
                toast({
                  title: 'Receptora já está no protocolo',
                  description: 'Esta receptora já foi adicionada.',
                  variant: 'destructive',
                });
                onSuccess();
                return;
              }
              throw protocoloError;
            }

            toast({
              title: 'Receptora adicionada',
              description: 'Receptora existente foi adicionada ao protocolo',
            });

            resetForm();
            onSuccess();
            return;
          }
        }
      }

      // Criar nova receptora
      const receptoraData: Record<string, string> = {
        identificacao: brinco,
      };

      if (formData.nome.trim()) {
        receptoraData.nome = formData.nome.trim();
      }

      const { data: novaReceptora, error: receptoraError } = await supabase
        .from('receptoras')
        .insert([receptoraData])
        .select()
        .single();

      if (receptoraError) {
        if (receptoraError.code === '23505') {
          throw new Error('Já existe uma receptora com esse brinco.');
        }
        throw receptoraError;
      }

      // Inserir no histórico de fazendas
      const { data: historicoExistente } = await supabase
        .from('receptora_fazenda_historico')
        .select('id')
        .eq('receptora_id', novaReceptora.id)
        .eq('fazenda_id', protocolo.fazenda_id)
        .is('data_fim', null)
        .maybeSingle();

      if (!historicoExistente) {
        const { error: historicoError } = await supabase
          .from('receptora_fazenda_historico')
          .insert([{
            receptora_id: novaReceptora.id,
            fazenda_id: protocolo.fazenda_id,
            data_inicio: getTodayDateString(),
            data_fim: null,
          }]);

        if (historicoError) {
          if (historicoError.message?.includes('brinco') || historicoError.code === 'P0001') {
            await supabase.from('receptoras').delete().eq('id', novaReceptora.id);
            throw new Error('Já existe uma receptora com esse brinco nesta fazenda.');
          }
          throw historicoError;
        }
      }

      // Verificar se histórico foi criado
      const { data: historicoVerificado } = await supabase
        .from('receptora_fazenda_historico')
        .select('id')
        .eq('receptora_id', novaReceptora.id)
        .eq('fazenda_id', protocolo.fazenda_id)
        .is('data_fim', null)
        .maybeSingle();

      if (!historicoVerificado) {
        await supabase.from('receptoras').delete().eq('id', novaReceptora.id);
        toast({
          title: 'Erro ao criar receptora',
          description: 'Não foi possível vincular a receptora à fazenda.',
          variant: 'destructive',
        });
        return;
      }

      // Adicionar ao protocolo
      const { error: protocoloError } = await supabase
        .from('protocolo_receptoras')
        .insert([{
          protocolo_id: protocoloId,
          receptora_id: novaReceptora.id,
          evento_fazenda_id: protocolo.fazenda_id,
          data_inclusao: protocolo.data_inicio,
          status: 'INICIADA',
          observacoes: formData.observacoes || null,
        }]);

      if (protocoloError) {
        await supabase.from('receptoras').delete().eq('id', novaReceptora.id);
        if (protocoloError.code === '23505') {
          toast({
            title: 'Receptora já está no protocolo',
            description: 'Esta receptora já foi adicionada.',
            variant: 'destructive',
          });
          onSuccess();
          return;
        }
        throw protocoloError;
      }

      toast({
        title: 'Receptora criada e adicionada',
        description: 'Receptora criada e adicionada ao protocolo com sucesso',
      });

      resetForm();
      onSuccess();
    } catch (error) {
      toast({
        title: 'Erro ao criar receptora',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }, [formData, protocoloId, protocolo, onSuccess, resetForm, toast]);

  return {
    formData,
    setFormData,
    updateField,
    submitting,
    resetForm,
    handleCreateReceptora,
  };
}
