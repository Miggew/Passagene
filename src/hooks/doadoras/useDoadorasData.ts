/**
 * Hook para gerenciar dados e filtros da lista de doadoras
 * - Carregamento de fazendas e doadoras
 * - Filtragem por busca
 * - Enriquecimento com dados de aspiracao
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Doadora } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export interface Fazenda {
  id: string;
  nome: string;
}

export interface DoadoraComAspiracao extends Doadora {
  ultima_aspiracao_total_oocitos?: number;
  ultima_aspiracao_data?: string;
}

export interface UseDoadorasDataReturn {
  // Loading state
  loading: boolean;

  // Data
  fazendas: Fazenda[];
  doadoras: DoadoraComAspiracao[];
  filteredDoadoras: DoadoraComAspiracao[];

  // Selection
  selectedFazendaId: string;
  setSelectedFazendaId: (id: string) => void;

  // Filters
  searchTerm: string;
  setSearchTerm: (term: string) => void;

  // Historico dialog
  historicoDoadoraId: string | null;
  setHistoricoDoadoraId: (id: string | null) => void;

  // Actions
  loadFazendas: () => Promise<void>;
  loadDoadoras: () => Promise<void>;
}

export function useDoadorasData(): UseDoadorasDataReturn {
  const { toast } = useToast();

  // Loading state
  const [loading, setLoading] = useState(true);

  // Data
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [doadoras, setDoadoras] = useState<DoadoraComAspiracao[]>([]);
  const [filteredDoadoras, setFilteredDoadoras] = useState<DoadoraComAspiracao[]>([]);

  // Selection
  const [selectedFazendaId, setSelectedFazendaId] = useState<string>('');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');

  // Historico dialog
  const [historicoDoadoraId, setHistoricoDoadoraId] = useState<string | null>(null);

  // Filter doadoras based on search term
  const filterDoadoras = useCallback(() => {
    if (!searchTerm.trim()) {
      setFilteredDoadoras(doadoras);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = doadoras.filter(
      (d) =>
        d.nome?.toLowerCase().includes(term) ||
        d.registro?.toLowerCase().includes(term) ||
        d.raca?.toLowerCase().includes(term)
    );
    setFilteredDoadoras(filtered);
  }, [doadoras, searchTerm]);

  // Apply filters when dependencies change
  useEffect(() => {
    filterDoadoras();
  }, [filterDoadoras]);

  // Load fazendas from database
  const loadFazendas = useCallback(async () => {
    try {
      setLoading(true);
      const { data: fazendasData, error: fazendasError } = await supabase
        .from('fazendas')
        .select('id, nome')
        .order('nome', { ascending: true });

      if (fazendasError) throw fazendasError;
      setFazendas(fazendasData || []);
    } catch (error) {
      toast({
        title: 'Erro ao carregar fazendas',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Load doadoras from database with aspiration data
  const loadDoadoras = useCallback(async () => {
    if (!selectedFazendaId) {
      setDoadoras([]);
      setFilteredDoadoras([]);
      return;
    }

    try {
      setLoading(true);
      const { data: doadorasData, error: doadorasError } = await supabase
        .from('doadoras')
        .select('*')
        .eq('fazenda_id', selectedFazendaId)
        .order('created_at', { ascending: false });

      if (doadorasError) throw doadorasError;

      // Fetch last aspiration for each doadora
      const doadorasComAspiracao: DoadoraComAspiracao[] = await Promise.all(
        (doadorasData || []).map(async (doadora) => {
          const { data: aspiracoesData, error } = await supabase
            .from('aspiracoes_doadoras')
            .select('total_oocitos, data_aspiracao')
            .eq('doadora_id', doadora.id)
            .order('data_aspiracao', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (error || !aspiracoesData) {
            return {
              ...doadora,
              ultima_aspiracao_total_oocitos: undefined,
              ultima_aspiracao_data: undefined,
            };
          }

          return {
            ...doadora,
            ultima_aspiracao_total_oocitos: aspiracoesData.total_oocitos,
            ultima_aspiracao_data: aspiracoesData.data_aspiracao,
          };
        })
      );

      setDoadoras(doadorasComAspiracao);
      setFilteredDoadoras(doadorasComAspiracao);
    } catch (error) {
      toast({
        title: 'Erro ao carregar doadoras',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [selectedFazendaId, toast]);

  // Load doadoras when fazenda changes
  useEffect(() => {
    if (selectedFazendaId) {
      loadDoadoras();
    } else {
      setDoadoras([]);
      setFilteredDoadoras([]);
    }
  }, [selectedFazendaId, loadDoadoras]);

  return {
    // Loading state
    loading,

    // Data
    fazendas,
    doadoras,
    filteredDoadoras,

    // Selection
    selectedFazendaId,
    setSelectedFazendaId,

    // Filters
    searchTerm,
    setSearchTerm,

    // Historico dialog
    historicoDoadoraId,
    setHistoricoDoadoraId,

    // Actions
    loadFazendas,
    loadDoadoras,
  };
}

export default useDoadorasData;
