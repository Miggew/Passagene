/**
 * Hook para carregamento de dados do 2º passo do protocolo
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { ProtocoloSincronizacao, Receptora } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export interface ReceptoraHistoricoStats {
  totalProtocolos: number;
  gestacoes: number;
  protocolosDesdeUltimaGestacao: number;
}

export interface ReceptoraWithStatus extends Receptora {
  pr_id: string;
  pr_status: string;
  pr_motivo_inapta?: string;
  pr_observacoes?: string;
  pr_ciclando_classificacao?: 'N' | 'CL' | null;
  pr_qualidade_semaforo?: 1 | 2 | 3 | null;
  historicoStats?: ReceptoraHistoricoStats;
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

  // Carregar estatísticas de histórico das receptoras
  const loadHistoricoStats = useCallback(async (receptoraIds: string[]): Promise<Map<string, ReceptoraHistoricoStats>> => {
    const statsMap = new Map<string, ReceptoraHistoricoStats>();

    if (receptoraIds.length === 0) return statsMap;

    try {
      // Buscar todos os protocolos das receptoras
      const { data: protocolosData } = await supabase
        .from('protocolo_receptoras')
        .select('receptora_id, created_at')
        .in('receptora_id', receptoraIds)
        .order('created_at', { ascending: false });

      // Buscar todos os diagnósticos com resultado PRENHE
      const { data: diagnosticosData } = await supabase
        .from('diagnosticos_gestacao')
        .select('receptora_id, data_diagnostico')
        .in('receptora_id', receptoraIds)
        .in('resultado', ['PRENHE', 'PRENHE_IA'])
        .order('data_diagnostico', { ascending: false });

      // Processar dados por receptora
      const protocolosPorReceptora = new Map<string, string[]>();
      (protocolosData || []).forEach(p => {
        const list = protocolosPorReceptora.get(p.receptora_id) || [];
        list.push(p.created_at);
        protocolosPorReceptora.set(p.receptora_id, list);
      });

      const gestacoesPorReceptora = new Map<string, string[]>();
      (diagnosticosData || []).forEach(d => {
        const list = gestacoesPorReceptora.get(d.receptora_id) || [];
        list.push(d.data_diagnostico);
        gestacoesPorReceptora.set(d.receptora_id, list);
      });

      // Calcular stats para cada receptora
      receptoraIds.forEach(id => {
        const protocolos = protocolosPorReceptora.get(id) || [];
        const gestacoes = gestacoesPorReceptora.get(id) || [];

        const totalProtocolos = protocolos.length;
        const totalGestacoes = gestacoes.length;

        // Calcular protocolos desde última gestação
        let protocolosDesdeUltimaGestacao = totalProtocolos;
        if (gestacoes.length > 0 && protocolos.length > 0) {
          const ultimaGestacao = new Date(gestacoes[0]);
          protocolosDesdeUltimaGestacao = protocolos.filter(
            p => new Date(p) > ultimaGestacao
          ).length;
        }

        statsMap.set(id, {
          totalProtocolos,
          gestacoes: totalGestacoes,
          protocolosDesdeUltimaGestacao,
        });
      });
    } catch (error) {
      console.error('Erro ao carregar histórico stats:', error);
    }

    return statsMap;
  }, []);

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

      // Obter IDs das receptoras
      const receptoraIds = finalPrData.map(pr => pr.receptora_id);

      // Carregar dados das receptoras e histórico stats em paralelo
      const [receptorasResult, historicoStatsMap] = await Promise.all([
        supabase
          .from('receptoras')
          .select('*')
          .in('id', receptoraIds),
        loadHistoricoStats(receptoraIds),
      ]);

      if (receptorasResult.error) {
        toast({
          title: 'Erro ao carregar dados das receptoras',
          description: receptorasResult.error.message,
          variant: 'destructive',
        });
        setReceptoras([]);
        return;
      }

      const receptorasData = receptorasResult.data || [];

      // Mapear dados das receptoras por ID
      const receptorasMap = new Map(receptorasData.map(r => [r.id, r]));

      const receptorasWithStatus: ReceptoraWithStatus[] = [];

      for (const pr of finalPrData) {
        const receptoraData = receptorasMap.get(pr.receptora_id);
        if (!receptoraData) continue;

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
          historicoStats: historicoStatsMap.get(pr.receptora_id),
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
  }, [toast, loadHistoricoStats]);

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
