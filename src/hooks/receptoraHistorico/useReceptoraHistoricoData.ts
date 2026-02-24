import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { Receptora } from '@/lib/types';
import {
  HistoricoItem,
  HistoricoAdmin,
  Estatisticas,
  CruzamentoAtual,
  carregarHistoricoReceptora
} from '@/lib/receptoraHistoricoUtils';

export interface UseReceptoraHistoricoDataReturn {
  loading: boolean;
  receptora: Receptora | null;
  historico: HistoricoItem[];
  historicoAdmin: HistoricoAdmin[];
  estatisticas: Estatisticas;
  cruzamentoAtual: CruzamentoAtual | null;
  loadData: (receptoraId: string) => Promise<void>;
  setReceptora: React.Dispatch<React.SetStateAction<Receptora | null>>;
}

export function useReceptoraHistoricoData(): UseReceptoraHistoricoDataReturn {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [receptora, setReceptora] = useState<Receptora | null>(null);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [historicoAdmin, setHistoricoAdmin] = useState<HistoricoAdmin[]>([]);
  const [estatisticas, setEstatisticas] = useState<Estatisticas>({
    totalCiclos: 0,
    totalGestacoes: 0,
    ciclosDesdeUltimaGestacao: 0,
  });
  const [cruzamentoAtual, setCruzamentoAtual] = useState<CruzamentoAtual | null>(null);

  const loadData = useCallback(async (receptoraId: string) => {
    try {
      setLoading(true);
      const result = await carregarHistoricoReceptora(receptoraId);
      setReceptora(result.receptoraData);
      setHistorico(result.items);
      setHistoricoAdmin(result.itemsAdmin);
      setEstatisticas(result.stats);
      setCruzamentoAtual(result.cruzamento);
    } catch (error) {
      toast({
        title: 'Erro ao carregar histórico',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [carregarHistoricoReceptora, toast]);

  return {
    loading,
    receptora,
    historico,
    historicoAdmin,
    estatisticas,
    cruzamentoAtual,
    loadData,
    setReceptora,
  };
}
