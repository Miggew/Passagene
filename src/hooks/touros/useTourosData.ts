/**
 * Hook para gerenciar dados e filtros da lista de touros
 * - Carregamento de touros
 * - Filtragem por busca e raça
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Touro } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export const racasBovinas = [
  'Holandesa',
  'Jersey',
  'Gir',
  'Girolando',
  'Nelore',
  'Angus',
  'Brahman',
  'Hereford',
  'Simmental',
  'Tabapuã',
  'Sindi',
  'Caracu',
  'Canchim',
  'Senepol',
  'Brangus',
  'Gir Leiteiro',
  'Guzerá',
];

export interface UseTourosDataReturn {
  // Loading state
  loading: boolean;

  // Data
  touros: Touro[];
  filteredTouros: Touro[];

  // Filters
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filtroRaca: string;
  setFiltroRaca: (raca: string) => void;

  // Actions
  loadTouros: () => Promise<void>;
}

export function useTourosData(): UseTourosDataReturn {
  const { toast } = useToast();

  // Loading state
  const [loading, setLoading] = useState(true);

  // Data
  const [touros, setTouros] = useState<Touro[]>([]);
  const [filteredTouros, setFilteredTouros] = useState<Touro[]>([]);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroRaca, setFiltroRaca] = useState('');

  // Filter touros based on search and race
  const filterTouros = useCallback(() => {
    let filtered = [...touros];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.nome?.toLowerCase().includes(term) ||
          t.registro?.toLowerCase().includes(term) ||
          t.raca?.toLowerCase().includes(term)
      );
    }

    if (filtroRaca) {
      filtered = filtered.filter((t) => t.raca === filtroRaca);
    }

    setFilteredTouros(filtered);
  }, [touros, searchTerm, filtroRaca]);

  // Apply filters when dependencies change
  useEffect(() => {
    filterTouros();
  }, [filterTouros]);

  // Load touros from database
  const loadTouros = useCallback(async () => {
    try {
      setLoading(true);
      const { data: tourosData, error: tourosError } = await supabase
        .from('touros')
        .select('*')
        .order('nome', { ascending: true });

      if (tourosError) throw tourosError;
      setTouros(tourosData || []);
      setFilteredTouros(tourosData || []);
    } catch (error) {
      toast({
        title: 'Erro ao carregar touros',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return {
    // Loading state
    loading,

    // Data
    touros,
    filteredTouros,

    // Filters
    searchTerm,
    setSearchTerm,
    filtroRaca,
    setFiltroRaca,

    // Actions
    loadTouros,
  };
}

export default useTourosData;
