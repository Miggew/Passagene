import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { PacoteAspiracao, AspiracaoDoadora, Doadora } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export interface AspiracaoDoadoraComNome extends AspiracaoDoadora {
  doadora_nome?: string;
  doadora_registro?: string;
}

interface UsePacoteAspiracaoDataProps {
  pacoteId: string | undefined;
}

export function usePacoteAspiracaoData({ pacoteId }: UsePacoteAspiracaoDataProps) {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [pacote, setPacote] = useState<PacoteAspiracao | null>(null);
  const [fazendaNome, setFazendaNome] = useState('');
  const [fazendasDestinoNomes, setFazendasDestinoNomes] = useState<string[]>([]);
  const [aspiracoes, setAspiracoes] = useState<AspiracaoDoadoraComNome[]>([]);
  const [doadorasDisponiveis, setDoadorasDisponiveis] = useState<Doadora[]>([]);

  const totalOocitos = aspiracoes.reduce((sum, a) => sum + (a.total_oocitos || 0), 0);
  const isFinalizado = pacote?.status === 'FINALIZADO';
  // Horário de fim = hora_final da última doadora aspirada
  const horarioFim = aspiracoes.length > 0 ? aspiracoes[aspiracoes.length - 1].hora_final || '' : '';

  const loadAspiracoes = useCallback(async (): Promise<AspiracaoDoadoraComNome[]> => {
    if (!pacoteId) return [];

    const { data: aspiracoesData, error: aspiracoesError } = await supabase
      .from('aspiracoes_doadoras')
      .select('*')
      .eq('pacote_aspiracao_id', pacoteId)
      .order('created_at', { ascending: true });

    if (aspiracoesError) throw aspiracoesError;

    if (!aspiracoesData || aspiracoesData.length === 0) {
      return [];
    }

    // Buscar dados das doadoras
    const doadoraIds = aspiracoesData.map(a => a.doadora_id);
    const { data: doadorasData, error: doadorasError } = await supabase
      .from('doadoras')
      .select('id, registro, nome')
      .in('id', doadoraIds);

    if (doadorasError) throw doadorasError;

    const doadorasMap = new Map(doadorasData?.map(d => [d.id, d]) || []);

    return aspiracoesData.map(a => {
      const doadora = doadorasMap.get(a.doadora_id);
      return {
        ...a,
        doadora_nome: doadora?.nome,
        doadora_registro: doadora?.registro,
      };
    });
  }, [pacoteId]);

  const loadDoadorasDisponiveis = useCallback(async (fazendaId: string, aspiracoesAtuais: AspiracaoDoadoraComNome[]) => {
    const doadoraIdsJaAdicionadas = new Set(aspiracoesAtuais.map(a => a.doadora_id));

    const { data, error } = await supabase
      .from('doadoras')
      .select('id, registro, nome')
      .eq('fazenda_id', fazendaId)
      .order('registro', { ascending: true });

    if (error) throw error;

    // Filtrar doadoras já adicionadas
    const disponiveis = (data || []).filter(d => !doadoraIdsJaAdicionadas.has(d.id));
    setDoadorasDisponiveis(disponiveis);
  }, []);

  const loadFazendasDestino = useCallback(async (pacoteData: PacoteAspiracao): Promise<string[]> => {
    // Load múltiplas fazendas destino
    const { data: fazendasDestinoData } = await supabase
      .from('pacotes_aspiracao_fazendas_destino')
      .select('fazenda_destino_id')
      .eq('pacote_aspiracao_id', pacoteData.id);

    // Se não houver na tabela de relacionamento, usar a fazenda_destino_id legacy
    if (!fazendasDestinoData || fazendasDestinoData.length === 0) {
      if (pacoteData.fazenda_destino_id) {
        const { data: fazendaDestinoLegacy } = await supabase
          .from('fazendas')
          .select('nome')
          .eq('id', pacoteData.fazenda_destino_id)
          .single();
        if (fazendaDestinoLegacy) {
          return [fazendaDestinoLegacy.nome];
        }
      }
      return [];
    }

    // Buscar nomes das fazendas destino
    const fazendaDestinoIds = fazendasDestinoData.map((item) => item.fazenda_destino_id);
    const { data: fazendasData } = await supabase
      .from('fazendas')
      .select('id, nome')
      .in('id', fazendaDestinoIds);

    if (fazendasData) {
      return fazendasData.map((f) => f.nome).filter(Boolean);
    }
    return [];
  }, []);

  const loadData = useCallback(async () => {
    if (!pacoteId) return;

    try {
      setLoading(true);

      // 1. Load pacote first (needed for fazenda_id)
      const { data: pacoteData, error: pacoteError } = await supabase
        .from('pacotes_aspiracao')
        .select('*')
        .eq('id', pacoteId)
        .single();

      if (pacoteError) throw pacoteError;
      setPacote(pacoteData);

      // 2. Load data in parallel
      const [fazendaResult, fazendasDestinoResult, aspiracoesResult] = await Promise.all([
        // Load fazenda da aspiração
        supabase.from('fazendas').select('nome').eq('id', pacoteData.fazenda_id).single(),
        // Load fazendas destino
        loadFazendasDestino(pacoteData),
        // Load aspirações
        loadAspiracoes(),
      ]);

      if (fazendaResult.error) throw fazendaResult.error;
      setFazendaNome(fazendaResult.data.nome);
      setFazendasDestinoNomes(fazendasDestinoResult);
      setAspiracoes(aspiracoesResult);

      // 3. Load doadoras disponíveis (se em andamento)
      if (pacoteData.status === 'EM_ANDAMENTO') {
        await loadDoadorasDisponiveis(pacoteData.fazenda_id, aspiracoesResult);
      }

    } catch (error) {
      toast({
        title: 'Erro ao carregar dados',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [pacoteId, loadAspiracoes, loadFazendasDestino, loadDoadorasDisponiveis, toast]);

  const reloadDoadorasDisponiveis = useCallback(async () => {
    if (!pacote) return;

    // Reload aspirações primeiro para ter a lista atualizada
    const aspiracoesAtuais = await loadAspiracoes();
    setAspiracoes(aspiracoesAtuais);
    await loadDoadorasDisponiveis(pacote.fazenda_id, aspiracoesAtuais);
  }, [pacote, loadAspiracoes, loadDoadorasDisponiveis]);

  const updatePacoteTotal = useCallback(async (novoTotal: number) => {
    if (!pacoteId) return;
    await supabase
      .from('pacotes_aspiracao')
      .update({ total_oocitos: novoTotal })
      .eq('id', pacoteId);
  }, [pacoteId]);

  return {
    loading,
    pacote,
    setPacote,
    fazendaNome,
    fazendasDestinoNomes,
    aspiracoes,
    setAspiracoes,
    doadorasDisponiveis,
    totalOocitos,
    horarioFim,
    isFinalizado,
    loadData,
    reloadDoadorasDisponiveis,
    updatePacoteTotal,
  };
}
