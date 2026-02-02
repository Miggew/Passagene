/**
 * Hook para carregar dados do catálogo genético
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

export interface CatalogoDoadora {
  catalogo_id: string;
  preco: number | null;
  preco_negociavel: boolean;
  descricao: string | null;
  destaque: boolean;
  ordem: number;
  foto_principal: string | null;
  fotos_galeria: string[];
  publicado_em: string;
  doadora_id: string;
  registro: string;
  nome: string | null;
  raca: string | null;
  pai_nome: string | null;
  pai_registro: string | null;
  mae_nome: string | null;
  mae_registro: string | null;
  genealogia_texto: string | null;
  foto_url: string | null;
  classificacao_genetica: string | null;
  fazenda_id: string | null;
  fazenda_nome: string | null;
  cliente_id: string | null;
  cliente_nome: string | null;
  embrioes_disponiveis: number;
}

export interface CatalogoTouro {
  catalogo_id: string;
  preco: number | null;
  preco_negociavel: boolean;
  descricao: string | null;
  destaque: boolean;
  ordem: number;
  foto_principal: string | null;
  fotos_galeria: string[];
  publicado_em: string;
  touro_id: string;
  nome: string;
  registro: string;
  raca: string | null;
  pai_nome: string | null;
  pai_registro: string | null;
  mae_nome: string | null;
  mae_registro: string | null;
  genealogia_texto: string | null;
  foto_url: string | null;
  proprietario: string | null;
  doses_disponiveis: number;
}

export interface CatalogoDestaque {
  catalogo_id: string;
  tipo: 'doadora' | 'touro';
  preco: number | null;
  destaque: boolean;
  ordem: number;
  foto_principal: string | null;
  nome: string;
  registro: string;
  raca: string | null;
  pai_nome: string | null;
  mae_nome: string | null;
  foto_url: string | null;
  fazenda_nome: string | null;
  doadora_id: string | null;
  touro_id: string | null;
}

export function useCatalogoData() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [doadoras, setDoadoras] = useState<CatalogoDoadora[]>([]);
  const [touros, setTouros] = useState<CatalogoTouro[]>([]);
  const [destaques, setDestaques] = useState<CatalogoDestaque[]>([]);

  const loadDestaques = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('vw_catalogo_destaques')
        .select('*')
        .order('ordem')
        .order('publicado_em', { ascending: false });

      if (error) throw error;
      setDestaques((data as CatalogoDestaque[]) || []);
    } catch (error) {
      console.error('[useCatalogoData] Erro ao carregar destaques:', error);
      toast({
        title: 'Erro ao carregar destaques',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadDoadoras = useCallback(async (filters?: { raca?: string; busca?: string }) => {
    try {
      setLoading(true);
      let query = supabase
        .from('vw_catalogo_doadoras')
        .select('*')
        .order('destaque', { ascending: false })
        .order('ordem')
        .order('publicado_em', { ascending: false });

      if (filters?.raca) {
        query = query.eq('raca', filters.raca);
      }

      if (filters?.busca) {
        query = query.or(`nome.ilike.%${filters.busca}%,registro.ilike.%${filters.busca}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setDoadoras((data as CatalogoDoadora[]) || []);
    } catch (error) {
      console.error('[useCatalogoData] Erro ao carregar doadoras:', error);
      toast({
        title: 'Erro ao carregar doadoras',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadTouros = useCallback(async (filters?: { raca?: string; busca?: string }) => {
    try {
      setLoading(true);
      let query = supabase
        .from('vw_catalogo_touros')
        .select('*')
        .order('destaque', { ascending: false })
        .order('ordem')
        .order('publicado_em', { ascending: false });

      if (filters?.raca) {
        query = query.eq('raca', filters.raca);
      }

      if (filters?.busca) {
        query = query.or(`nome.ilike.%${filters.busca}%,registro.ilike.%${filters.busca}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTouros((data as CatalogoTouro[]) || []);
    } catch (error) {
      console.error('[useCatalogoData] Erro ao carregar touros:', error);
      toast({
        title: 'Erro ao carregar touros',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadDoadoraById = useCallback(async (catalogoId: string): Promise<CatalogoDoadora | null> => {
    try {
      const { data, error } = await supabase
        .from('vw_catalogo_doadoras')
        .select('*')
        .eq('catalogo_id', catalogoId)
        .single();

      if (error) throw error;
      return data as CatalogoDoadora;
    } catch (error) {
      console.error('[useCatalogoData] Erro ao carregar doadora:', error);
      toast({
        title: 'Erro ao carregar doadora',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      return null;
    }
  }, [toast]);

  const loadTouroById = useCallback(async (catalogoId: string): Promise<CatalogoTouro | null> => {
    try {
      const { data, error } = await supabase
        .from('vw_catalogo_touros')
        .select('*')
        .eq('catalogo_id', catalogoId)
        .single();

      if (error) throw error;
      return data as CatalogoTouro;
    } catch (error) {
      console.error('[useCatalogoData] Erro ao carregar touro:', error);
      toast({
        title: 'Erro ao carregar touro',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      return null;
    }
  }, [toast]);

  const loadHomeData = useCallback(async () => {
    try {
      setLoading(true);
      const [destaquesRes, doadorasRes, tourosRes] = await Promise.all([
        supabase
          .from('vw_catalogo_destaques')
          .select('*')
          .order('ordem')
          .limit(8),
        supabase
          .from('vw_catalogo_doadoras')
          .select('*')
          .order('destaque', { ascending: false })
          .order('ordem')
          .limit(4),
        supabase
          .from('vw_catalogo_touros')
          .select('*')
          .order('destaque', { ascending: false })
          .order('ordem')
          .limit(4),
      ]);

      if (destaquesRes.error) throw destaquesRes.error;
      if (doadorasRes.error) throw doadorasRes.error;
      if (tourosRes.error) throw tourosRes.error;

      setDestaques((destaquesRes.data as CatalogoDestaque[]) || []);
      setDoadoras((doadorasRes.data as CatalogoDoadora[]) || []);
      setTouros((tourosRes.data as CatalogoTouro[]) || []);
    } catch (error) {
      console.error('[useCatalogoData] Erro ao carregar dados home:', error);
      toast({
        title: 'Erro ao carregar catálogo',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return {
    loading,
    doadoras,
    touros,
    destaques,
    loadDestaques,
    loadDoadoras,
    loadTouros,
    loadDoadoraById,
    loadTouroById,
    loadHomeData,
  };
}
