/**
 * Hook para carregamento da lista principal de Lotes FIV
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Fazenda, Doadora, Cliente } from '@/lib/types';
import { LoteFIVComNomes, PacoteComNomes } from '@/lib/types/lotesFiv';
import { handleError } from '@/lib/error-handler';
import { useToast } from '@/hooks/use-toast';
import { extractDateOnly, diffDays, getTodayDateString } from '@/lib/utils';

export interface UseLotesFIVListDataReturn {
  lotes: LoteFIVComNomes[];
  pacotes: PacoteComNomes[];
  fazendas: Fazenda[];
  setFazendas: React.Dispatch<React.SetStateAction<Fazenda[]>>;
  doadoras: Doadora[];
  setDoadoras: React.Dispatch<React.SetStateAction<Doadora[]>>;
  clientes: Cliente[];
  setClientes: React.Dispatch<React.SetStateAction<Cliente[]>>;
  loading: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  pacotesParaFiltro: PacoteComNomes[];
  fazendasAspiracaoUnicas: { id: string; nome: string }[];
  loadData: () => Promise<void>;
}

export function useLotesFIVListData(): UseLotesFIVListDataReturn {
  const { toast } = useToast();

  const [lotes, setLotes] = useState<LoteFIVComNomes[]>([]);
  const [pacotes, setPacotes] = useState<PacoteComNomes[]>([]);
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [doadoras, setDoadoras] = useState<Doadora[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [pacotesParaFiltro, setPacotesParaFiltro] = useState<PacoteComNomes[]>([]);
  const [fazendasAspiracaoUnicas, setFazendasAspiracaoUnicas] = useState<{ id: string; nome: string }[]>([]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Load pacotes FINALIZADOS
      const { data: pacotesData, error: pacotesError } = await supabase
        .from('pacotes_aspiracao')
        .select('*')
        .eq('status', 'FINALIZADO')
        .order('data_aspiracao', { ascending: false });

      if (pacotesError) throw pacotesError;

      // Load fazendas
      const { data: fazendasData, error: fazendasError } = await supabase
        .from('fazendas')
        .select('id, nome')
        .order('nome', { ascending: true });

      if (fazendasError) throw fazendasError;
      setFazendas(fazendasData || []);

      // Load clientes
      const { data: clientesData, error: clientesError } = await supabase
        .from('clientes')
        .select('id, nome')
        .order('nome', { ascending: true });

      if (!clientesError) {
        setClientes(clientesData || []);
      }

      const fazendasMap = new Map(fazendasData?.map((f) => [f.id, f.nome]));
      const fazendasDestinoPorPacote = new Map<string, string[]>();
      const quantidadePorPacote = new Map<string, number>();

      // Load fazendas destino dos pacotes
      const pacoteIds = pacotesData?.map((p) => p.id) || [];

      if (pacoteIds.length > 0) {
        const { data: fazendasDestinoData, error: fazendasDestinoError } = await supabase
          .from('pacotes_aspiracao_fazendas_destino')
          .select('pacote_aspiracao_id, fazenda_destino_id')
          .in('pacote_aspiracao_id', pacoteIds);

        if (!fazendasDestinoError && fazendasDestinoData) {
          fazendasDestinoData.forEach((fd) => {
            const nome = fazendasMap.get(fd.fazenda_destino_id);
            if (nome) {
              const atual = fazendasDestinoPorPacote.get(fd.pacote_aspiracao_id) || [];
              atual.push(nome);
              fazendasDestinoPorPacote.set(fd.pacote_aspiracao_id, atual);
            }
          });
        }

        // Load quantidade de doadoras por pacote
        const { data: aspiracoesData, error: aspiracoesError } = await supabase
          .from('aspiracoes_doadoras')
          .select('pacote_aspiracao_id')
          .in('pacote_aspiracao_id', pacoteIds);

        if (!aspiracoesError && aspiracoesData) {
          aspiracoesData.forEach((a) => {
            if (a.pacote_aspiracao_id) {
              quantidadePorPacote.set(a.pacote_aspiracao_id, (quantidadePorPacote.get(a.pacote_aspiracao_id) || 0) + 1);
            }
          });
        }
      }

      // Load lotes
      const { data: lotesData, error: lotesError } = await supabase
        .from('lotes_fiv')
        .select('*')
        .order('data_abertura', { ascending: false });

      if (lotesError) throw lotesError;

      // Filtrar pacotes não usados
      const pacotesUsadosEmLotes = new Set(lotesData?.map((l) => l.pacote_aspiracao_id).filter((id): id is string => !!id) || []);

      const pacotesDisponiveis = (pacotesData || []).filter((p) => {
        if (p.usado_em_lote_fiv !== undefined) {
          return !p.usado_em_lote_fiv;
        }
        return !pacotesUsadosEmLotes.has(p.id);
      });

      const pacotesComNomes: PacoteComNomes[] = pacotesDisponiveis.map((p) => ({
        ...p,
        fazenda_nome: fazendasMap.get(p.fazenda_id),
        fazendas_destino_nomes: fazendasDestinoPorPacote.get(p.id) || [],
        quantidade_doadoras: quantidadePorPacote.get(p.id) || 0,
      }));

      setPacotes(pacotesComNomes);

      // Load acasalamentos para contar
      const loteIds = lotesData?.map((l) => l.id) || [];
      const { data: acasalamentosData, error: acasalamentosError } = await supabase
        .from('lote_fiv_acasalamentos')
        .select('lote_fiv_id')
        .in('lote_fiv_id', loteIds);

      if (acasalamentosError) throw acasalamentosError;

      const quantidadeAcasalamentosPorLote = new Map<string, number>();
      acasalamentosData?.forEach((a) => {
        quantidadeAcasalamentosPorLote.set(a.lote_fiv_id, (quantidadeAcasalamentosPorLote.get(a.lote_fiv_id) || 0) + 1);
      });

      // Load fazendas destino dos lotes
      const { data: fazendasDestinoLotesData, error: fazendasDestinoLotesError } = await supabase
        .from('lote_fiv_fazendas_destino')
        .select('lote_fiv_id, fazenda_id')
        .in('lote_fiv_id', loteIds);

      if (fazendasDestinoLotesError) throw fazendasDestinoLotesError;

      const fazendasDestinoPorLote = new Map<string, string[]>();
      fazendasDestinoLotesData?.forEach((fd) => {
        const nome = fazendasMap.get(fd.fazenda_id);
        if (nome) {
          const atual = fazendasDestinoPorLote.get(fd.lote_fiv_id) || [];
          atual.push(nome);
          fazendasDestinoPorLote.set(fd.lote_fiv_id, atual);
        }
      });

      const pacotesMap = new Map(pacotesComNomes.map((p) => [p.id, p]));
      // Também incluir pacotes usados no mapa
      (pacotesData || []).forEach((p) => {
        if (!pacotesMap.has(p.id)) {
          pacotesMap.set(p.id, {
            ...p,
            fazenda_nome: fazendasMap.get(p.fazenda_id),
            fazendas_destino_nomes: fazendasDestinoPorPacote.get(p.id) || [],
            quantidade_doadoras: quantidadePorPacote.get(p.id) || 0,
          });
        }
      });

      const lotesComNomes: LoteFIVComNomes[] = (lotesData || []).map((l) => {
        const pacote = pacotesMap.get(l.pacote_aspiracao_id);
        let dataAspiracaoStr = extractDateOnly(pacote?.data_aspiracao || null);

        if (!dataAspiracaoStr) {
          const dataAberturaStr = extractDateOnly(l.data_abertura);
          if (dataAberturaStr) {
            const [year, month, day] = dataAberturaStr.split('-').map(Number);
            const dataAberturaDate = new Date(year, month - 1, day);
            dataAberturaDate.setDate(dataAberturaDate.getDate() - 1);
            const yearStr = dataAberturaDate.getFullYear();
            const monthStr = String(dataAberturaDate.getMonth() + 1).padStart(2, '0');
            const dayStr = String(dataAberturaDate.getDate()).padStart(2, '0');
            dataAspiracaoStr = `${yearStr}-${monthStr}-${dayStr}`;
          }
        }

        const hojeStr = getTodayDateString();
        const diaAtual = dataAspiracaoStr ? Math.max(0, diffDays(dataAspiracaoStr, hojeStr)) : 0;

        return {
          ...l,
          pacote_nome: pacote?.fazenda_nome,
          pacote_data: pacote?.data_aspiracao,
          fazendas_destino_nomes: fazendasDestinoPorLote.get(l.id) || [],
          quantidade_acasalamentos: quantidadeAcasalamentosPorLote.get(l.id) || 0,
          dia_atual: diaAtual,
        };
      });

      // Fechar automaticamente lotes que passaram do D8
      const lotesParaFechar = lotesComNomes.filter(l =>
        l.status === 'ABERTO' && l.dia_atual !== undefined && l.dia_atual > 9
      );

      if (lotesParaFechar.length > 0) {
        const lotesIdsParaFechar = lotesParaFechar.map(l => l.id);
        const { error: fechamentoError } = await supabase
          .from('lotes_fiv')
          .update({ status: 'FECHADO' })
          .in('id', lotesIdsParaFechar);

        if (fechamentoError) {
          toast({
            title: 'Aviso',
            description: 'Não foi possível fechar automaticamente alguns lotes expirados. Recarregue a página.',
            variant: 'destructive',
          });
        }

        // Atualizar o status nos lotes locais após fechamento bem-sucedido
        if (!fechamentoError) {
          lotesParaFechar.forEach(l => {
            l.status = 'FECHADO';
          });
        }
      }

      setLotes(lotesComNomes);

      // Armazenar pacotes únicos para o filtro
      const pacotesComLotes = new Set(lotesComNomes.map(l => l.pacote_aspiracao_id).filter((id): id is string => !!id));
      const pacotesParaFiltroArray: PacoteComNomes[] = [];

      (pacotesData || []).forEach((p) => {
        if (pacotesComLotes.has(p.id)) {
          pacotesParaFiltroArray.push({
            ...p,
            fazenda_nome: fazendasMap.get(p.fazenda_id),
            fazendas_destino_nomes: fazendasDestinoPorPacote.get(p.id) || [],
            quantidade_doadoras: quantidadePorPacote.get(p.id) || 0,
          });
        }
      });

      setPacotesParaFiltro(pacotesParaFiltroArray);

      // Extrair fazendas únicas para o filtro
      const fazendasUnicas = new Map<string, string>();

      pacotesParaFiltroArray.forEach((pacote) => {
        if (pacote.fazenda_id && pacote.fazenda_nome) {
          fazendasUnicas.set(pacote.fazenda_id, pacote.fazenda_nome);
        }
      });

      setFazendasAspiracaoUnicas(
        Array.from(fazendasUnicas.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome))
      );
    } catch (error) {
      handleError(error, 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  return {
    lotes,
    pacotes,
    fazendas,
    setFazendas,
    doadoras,
    setDoadoras,
    clientes,
    setClientes,
    loading,
    setLoading,
    pacotesParaFiltro,
    fazendasAspiracaoUnicas,
    loadData,
  };
}
