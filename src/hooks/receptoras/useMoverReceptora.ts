/**
 * Hook para gerenciar movimentação de receptora entre fazendas
 */

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Receptora, Fazenda } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export interface UseMoverReceptoraProps {
  fazendas: Fazenda[];
  selectedFazendaId: string;
  editingReceptora: Receptora | null;
  onSuccess?: () => void;
  onClose?: () => void;
}

export interface UseMoverReceptoraReturn {
  // State
  showMoverFazendaDialog: boolean;
  setShowMoverFazendaDialog: (show: boolean) => void;
  novaFazendaId: string;
  setNovaFazendaId: (id: string) => void;
  novoBrincoProposto: string;
  temConflitoBrinco: boolean;
  temConflitoNome: boolean;
  submittingMover: boolean;

  // Available fazendas (excluding current)
  fazendasDisponiveis: Fazenda[];

  // Actions
  handleMoverFazenda: () => Promise<void>;
  resetMoverState: () => void;
}

export function useMoverReceptora({
  fazendas,
  selectedFazendaId,
  editingReceptora,
  onSuccess,
  onClose,
}: UseMoverReceptoraProps): UseMoverReceptoraReturn {
  const { toast } = useToast();

  // State
  const [showMoverFazendaDialog, setShowMoverFazendaDialog] = useState(false);
  const [novaFazendaId, setNovaFazendaId] = useState<string>('');
  const [novoBrincoProposto, setNovoBrincoProposto] = useState<string>('');
  const [temConflitoBrinco, setTemConflitoBrinco] = useState(false);
  const [temConflitoNome, setTemConflitoNome] = useState(false);
  const [submittingMover, setSubmittingMover] = useState(false);

  // Reset state
  const resetMoverState = useCallback(() => {
    setNovaFazendaId('');
    setNovoBrincoProposto('');
    setTemConflitoBrinco(false);
    setTemConflitoNome(false);
  }, []);

  // Filter out current fazenda
  const fazendasDisponiveis = fazendas.filter(f => f.id !== selectedFazendaId);

  // Check for conflicts when destination fazenda is selected
  useEffect(() => {
    const verificarConflitos = async () => {
      if (!editingReceptora || !novaFazendaId) {
        setTemConflitoBrinco(false);
        setNovoBrincoProposto('');
        setTemConflitoNome(false);
        return;
      }

      try {
        const { data: viewData, error: viewError } = await supabase
          .from('vw_receptoras_fazenda_atual')
          .select('receptora_id')
          .eq('fazenda_id_atual', novaFazendaId);

        if (viewError) return;

        const receptoraIdsNaFazendaDestino = viewData?.map(v => v.receptora_id) || [];

        if (receptoraIdsNaFazendaDestino.length === 0) {
          setTemConflitoBrinco(false);
          setNovoBrincoProposto('');
          setTemConflitoNome(false);
          return;
        }

        // Check name conflict
        if (editingReceptora.nome && editingReceptora.nome.trim()) {
          const { data: receptorasComNome, error: nomeError } = await supabase
            .from('receptoras')
            .select('id, nome, identificacao')
            .in('id', receptoraIdsNaFazendaDestino)
            .ilike('nome', editingReceptora.nome.trim());

          if (!nomeError && receptorasComNome && receptorasComNome.length > 0) {
            setTemConflitoNome(true);
          } else {
            setTemConflitoNome(false);
          }
        } else {
          setTemConflitoNome(false);
        }

        // Check brinco conflict
        const { data: receptorasComBrinco, error: brincoError } = await supabase
          .from('receptoras')
          .select('id, identificacao')
          .in('id', receptoraIdsNaFazendaDestino)
          .ilike('identificacao', editingReceptora.identificacao);

        if (brincoError) return;

        if (receptorasComBrinco && receptorasComBrinco.length > 0) {
          setTemConflitoBrinco(true);

          // Generate available brinco
          const gerarBrincoDisponivel = async (brincoBase: string, tentativa: number = 0): Promise<string> => {
            if (tentativa > 10) {
              throw new Error('Não foi possível gerar um brinco disponível após várias tentativas');
            }

            const dataAtual = new Date();
            const dia = String(dataAtual.getDate()).padStart(2, '0');
            const mes = String(dataAtual.getMonth() + 1).padStart(2, '0');
            const sufixo = tentativa === 0 ? `-MOV${dia}${mes}` : `-MOV${dia}${mes}-${tentativa}`;
            const novoBrinco = `${brincoBase}${sufixo}`;

            const { data: receptorasComNovoBrinco, error: novoBrincoError } = await supabase
              .from('receptoras')
              .select('id, identificacao')
              .in('id', receptoraIdsNaFazendaDestino)
              .ilike('identificacao', novoBrinco);

            if (novoBrincoError) return novoBrinco;

            if (receptorasComNovoBrinco && receptorasComNovoBrinco.length > 0) {
              return gerarBrincoDisponivel(brincoBase, tentativa + 1);
            }

            return novoBrinco;
          };

          try {
            const brincoDisponivel = await gerarBrincoDisponivel(editingReceptora.identificacao);
            setNovoBrincoProposto(brincoDisponivel);
          } catch {
            const dataAtual = new Date();
            const dia = String(dataAtual.getDate()).padStart(2, '0');
            const mes = String(dataAtual.getMonth() + 1).padStart(2, '0');
            setNovoBrincoProposto(`${editingReceptora.identificacao}-MOV${dia}${mes}`);
          }
        } else {
          setTemConflitoBrinco(false);
          setNovoBrincoProposto('');
        }
      } catch {
        setTemConflitoBrinco(false);
        setNovoBrincoProposto('');
      }
    };

    verificarConflitos();
  }, [editingReceptora, novaFazendaId]);

  // Move receptora to another fazenda
  const handleMoverFazenda = useCallback(async () => {
    if (!editingReceptora || !novaFazendaId) {
      toast({
        title: 'Erro de validação',
        description: 'Selecione uma fazenda de destino',
        variant: 'destructive',
      });
      return;
    }

    if (temConflitoNome && editingReceptora.nome && editingReceptora.nome.trim()) {
      toast({
        title: 'Conflito de nome',
        description: `Já existe uma receptora com o nome "${editingReceptora.nome.trim()}" na fazenda destino. Não é possível mover esta receptora.`,
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmittingMover(true);

      const brincoAnterior = editingReceptora.identificacao;
      let brincoFinal = brincoAnterior;

      // Handle brinco conflict
      if (temConflitoBrinco && novoBrincoProposto) {
        brincoFinal = novoBrincoProposto;

        const { error: updateError } = await supabase
          .from('receptoras')
          .update({ identificacao: brincoFinal })
          .eq('id', editingReceptora.id);

        if (updateError) {
          throw new Error(`Erro ao atualizar brinco: ${updateError.message}`);
        }

        // Record rename in history
        try {
          await supabase
            .from('receptora_renomeacoes_historico')
            .insert([{
              receptora_id: editingReceptora.id,
              brinco_anterior: brincoAnterior,
              brinco_novo: brincoFinal,
              data_renomeacao: new Date().toISOString(),
              motivo: 'MUDANCA_FAZENDA',
              observacoes: 'Renomeação automática devido a conflito de brinco na fazenda destino',
            }]);
        } catch {
          // Don't fail the operation
        }
      }

      // Call RPC to move receptora
      const { error } = await supabase.rpc('mover_receptora_fazenda', {
        p_receptora_id: editingReceptora.id,
        p_nova_fazenda_id: novaFazendaId,
        p_data_mudanca: new Date().toISOString().split('T')[0],
        p_observacoes: null,
      });

      if (error) {
        let errorMessage = 'Erro ao mover receptora';
        if (error.message) {
          errorMessage = error.message;
        } else if (error.details) {
          errorMessage = error.details;
        }

        toast({
          title: 'Erro ao mover receptora',
          description: errorMessage,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Receptora movida',
        description: temConflitoBrinco
          ? `Receptora movida com sucesso. Brinco atualizado de "${brincoAnterior}" para "${brincoFinal}" devido a conflito na fazenda destino.`
          : 'Receptora movida para a nova fazenda com sucesso. Protocolos e histórico não foram afetados.',
      });

      setShowMoverFazendaDialog(false);
      resetMoverState();
      onClose?.();
      onSuccess?.();
    } catch (error) {
      toast({
        title: 'Erro ao mover receptora',
        description: error instanceof Error ? error.message : 'Erro desconhecido ao mover receptora',
        variant: 'destructive',
      });
    } finally {
      setSubmittingMover(false);
    }
  }, [editingReceptora, novaFazendaId, temConflitoBrinco, temConflitoNome, novoBrincoProposto, toast, resetMoverState, onClose, onSuccess]);

  return {
    // State
    showMoverFazendaDialog,
    setShowMoverFazendaDialog,
    novaFazendaId,
    setNovaFazendaId,
    novoBrincoProposto,
    temConflitoBrinco,
    temConflitoNome,
    submittingMover,

    // Available fazendas
    fazendasDisponiveis,

    // Actions
    handleMoverFazenda,
    resetMoverState,
  };
}

export default useMoverReceptora;
