/**
 * Hook para carregamento de dados do 2º passo do protocolo
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { ProtocoloSincronizacao, Receptora } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export interface ReceptoraWithStatus extends Receptora {
  pr_id: string;
  pr_status: string;
  pr_motivo_inapta?: string;
  pr_observacoes?: string;
  pr_ciclando_classificacao?: 'N' | 'CL' | null;
  pr_qualidade_semaforo?: 1 | 2 | 3 | null;
}

export interface UseProtocoloPasso2DataReturn {
  loading: boolean;
  protocolo: ProtocoloSincronizacao | null;
  setProtocolo: React.Dispatch<React.SetStateAction<ProtocoloSincronizacao | null>>;
  fazendaNome: string;
  receptoras: ReceptoraWithStatus[];
  setReceptoras: React.Dispatch<React.SetStateAction<ReceptoraWithStatus[]>>;
  loadData: (id: string) => Promise<void>;
  loadReceptoras: (id: string) => Promise<void>;
}

export function useProtocoloPasso2Data(): UseProtocoloPasso2DataReturn {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [protocolo, setProtocolo] = useState<ProtocoloSincronizacao | null>(null);
  const [fazendaNome, setFazendaNome] = useState('');
  const [receptoras, setReceptoras] = useState<ReceptoraWithStatus[]>([]);

  const loadReceptoras = useCallback(async (id: string) => {
    try {
      const { data: finalPrData, error: prError } = await supabase
        .from('protocolo_receptoras')
        .select('*')
        .eq('protocolo_id', id);

      if (prError) {
        toast({
          title: 'Erro ao carregar receptoras',
          description: prError.message,
          variant: 'destructive',
        });
        setReceptoras([]);
        return;
      }

      if (!finalPrData || finalPrData.length === 0) {
        toast({
          title: 'Erro: Protocolo inconsistente',
          description: 'Este protocolo não possui receptoras vinculadas.',
          variant: 'destructive',
        });
        setReceptoras([]);
        return;
      }

      const receptorasWithStatus: ReceptoraWithStatus[] = [];

      for (const pr of finalPrData) {
        const { data: receptoraData, error: receptoraError } = await supabase
          .from('receptoras')
          .select('*')
          .eq('id', pr.receptora_id)
          .single();

        if (receptoraError) continue;

        receptorasWithStatus.push({
          ...receptoraData,
          pr_id: pr.id,
          pr_status: pr.status,
          pr_motivo_inapta: pr.motivo_inapta,
          pr_observacoes: pr.observacoes,
          pr_ciclando_classificacao:
            'ciclando_classificacao' in pr &&
            (pr.ciclando_classificacao === 'CL' || pr.ciclando_classificacao === 'N')
              ? (pr.ciclando_classificacao as 'N' | 'CL')
              : null,
          pr_qualidade_semaforo:
            'qualidade_semaforo' in pr &&
            typeof pr.qualidade_semaforo === 'number' &&
            pr.qualidade_semaforo >= 1 &&
            pr.qualidade_semaforo <= 3
              ? (pr.qualidade_semaforo as 1 | 2 | 3)
              : null,
        });
      }

      setReceptoras(receptorasWithStatus);
    } catch (error) {
      toast({
        title: 'Erro ao carregar receptoras',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const loadData = useCallback(async (id: string) => {
    try {
      setLoading(true);

      // Load protocolo
      const { data: protocoloData, error: protocoloError } = await supabase
        .from('protocolos_sincronizacao')
        .select('*')
        .eq('id', id)
        .single();

      if (protocoloError) throw protocoloError;

      // Validate status
      if (
        protocoloData.status !== 'PASSO1_FECHADO' &&
        protocoloData.status !== 'PRIMEIRO_PASSO_FECHADO' &&
        protocoloData.status !== 'SINCRONIZADO'
      ) {
        toast({
          title: 'Erro',
          description: 'Este protocolo não está aguardando o 2º passo',
          variant: 'destructive',
        });
        navigate('/protocolos');
        return;
      }

      setProtocolo(protocoloData);

      // Load fazenda nome
      const { data: fazendaData, error: fazendaError } = await supabase
        .from('fazendas')
        .select('nome')
        .eq('id', protocoloData.fazenda_id)
        .single();

      if (fazendaError) throw fazendaError;
      setFazendaNome(fazendaData.nome);

      // Load receptoras
      await loadReceptoras(id);
    } catch (error) {
      toast({
        title: 'Erro ao carregar dados',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [navigate, toast, loadReceptoras]);

  return {
    loading,
    protocolo,
    setProtocolo,
    fazendaNome,
    receptoras,
    setReceptoras,
    loadData,
    loadReceptoras,
  };
}
