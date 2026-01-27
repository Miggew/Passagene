/**
 * Hook para ações do histórico de receptoras (cio livre)
 */

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Receptora } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export interface UseReceptoraHistoricoActionsProps {
  receptora: Receptora | null;
  onSuccess: () => Promise<void>;
}

export interface UseReceptoraHistoricoActionsReturn {
  submitting: boolean;
  showCioLivreDialog: boolean;
  setShowCioLivreDialog: React.Dispatch<React.SetStateAction<boolean>>;
  cioLivreForm: { data_cio: string };
  setCioLivreForm: React.Dispatch<React.SetStateAction<{ data_cio: string }>>;
  handleRegistrarCioLivre: () => Promise<void>;
  handleRejeitarCioLivre: () => Promise<void>;
}

export function useReceptoraHistoricoActions({
  receptora,
  onSuccess,
}: UseReceptoraHistoricoActionsProps): UseReceptoraHistoricoActionsReturn {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [showCioLivreDialog, setShowCioLivreDialog] = useState(false);
  const [cioLivreForm, setCioLivreForm] = useState({
    data_cio: new Date().toISOString().split('T')[0],
  });

  const handleRegistrarCioLivre = async () => {
    if (!receptora) {
      toast({
        title: 'Receptora não carregada',
        description: 'Abra novamente o histórico para registrar o cio livre.',
        variant: 'destructive',
      });
      return;
    }

    // Buscar fazenda atual
    let fazendaId = receptora.fazenda_atual_id;
    if (!fazendaId) {
      const { data: fazendaAtualData, error: fazendaAtualError } = await supabase
        .from('vw_receptoras_fazenda_atual')
        .select('fazenda_id_atual')
        .eq('receptora_id', receptora.id)
        .limit(1);
      if (!fazendaAtualError && fazendaAtualData && fazendaAtualData.length > 0) {
        fazendaId = fazendaAtualData[0]?.fazenda_id_atual || undefined;
      }
    }
    if (!fazendaId) {
      const { data: historicoFazendaData, error: historicoFazendaError } = await supabase
        .from('receptora_fazenda_historico')
        .select('fazenda_id, data_inicio')
        .eq('receptora_id', receptora.id)
        .order('data_inicio', { ascending: false })
        .limit(1);
      if (!historicoFazendaError && historicoFazendaData && historicoFazendaData.length > 0) {
        fazendaId = historicoFazendaData[0]?.fazenda_id || undefined;
      }
    }
    if (!fazendaId) {
      toast({
        title: 'Fazenda não encontrada',
        description: 'A receptora não possui fazenda atual vinculada.',
        variant: 'destructive',
      });
      return;
    }

    if (!cioLivreForm.data_cio) {
      toast({
        title: 'Data do cio não informada',
        description: 'Informe a data do cio livre.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const { error: atualizarReceptoraError } = await supabase
        .from('receptoras')
        .update({
          is_cio_livre: true,
          status_cio_livre: 'PENDENTE',
        })
        .eq('id', receptora.id);
      if (atualizarReceptoraError) throw atualizarReceptoraError;

      const { error: cioLivreError } = await supabase
        .from('receptoras_cio_livre')
        .insert([{
          receptora_id: receptora.id,
          fazenda_id: fazendaId,
          data_cio: cioLivreForm.data_cio,
          observacoes: null,
          ativa: true,
        }]);
      if (cioLivreError) throw cioLivreError;

      toast({
        title: 'Cio livre registrado',
        description: 'Receptora liberada para TE. Confirmação automática após a transferência.',
      });
      setShowCioLivreDialog(false);
      setCioLivreForm({ data_cio: new Date().toISOString().split('T')[0] });
      await onSuccess();
    } catch (error) {
      toast({
        title: 'Erro ao registrar cio livre',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejeitarCioLivre = async () => {
    if (!receptora || !receptora.is_cio_livre) {
      return;
    }
    if (!confirm('Rejeitar este cio livre? A receptora não ficará disponível para TE.')) {
      return;
    }
    try {
      setSubmitting(true);

      const { error: copiaError } = await supabase
        .from('receptoras')
        .update({ is_cio_livre: false, status_cio_livre: 'REJEITADA' })
        .eq('id', receptora.id);
      if (copiaError) throw copiaError;

      const { error: cioLivreError } = await supabase
        .from('receptoras_cio_livre')
        .update({ ativa: false })
        .eq('receptora_id', receptora.id)
        .eq('ativa', true);
      if (cioLivreError) throw cioLivreError;

      toast({
        title: 'Cio livre rejeitado',
        description: 'O cio livre foi marcado como rejeitado.',
      });
      await onSuccess();
    } catch (error) {
      toast({
        title: 'Erro ao rejeitar cio livre',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return {
    submitting,
    showCioLivreDialog,
    setShowCioLivreDialog,
    cioLivreForm,
    setCioLivreForm,
    handleRegistrarCioLivre,
    handleRejeitarCioLivre,
  };
}
