/**
 * Hook para gerenciar o carregamento de dados dos Lotes FIV
 * Extraído de LotesFIV.tsx para melhor organização
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { DoseSemen, Fazenda, Doadora, Cliente, AspiracaoDoadora } from '@/lib/types';
import {
  LoteFIVComNomes,
  PacoteComNomes,
  AcasalamentoComNomes,
  AspiracaoComOocitosDisponiveis,
  LoteHistorico,
  DetalhesLoteHistorico,
  HistoricoDespacho,
} from '@/lib/types/lotesFiv';
import { handleError } from '@/lib/error-handler';
import { useToast } from '@/hooks/use-toast';
import { extractDateOnly, diffDays, getTodayDateString } from '@/lib/utils';

interface UseLotesFIVDataProps {
  id?: string;
  filtroHistoricoDataInicio: string;
  filtroHistoricoDataFim: string;
  filtroHistoricoFazenda: string;
  setHistoricoPage: (page: number) => void;
}

export function useLotesFIVData({
  id,
  filtroHistoricoDataInicio,
  filtroHistoricoDataFim,
  filtroHistoricoFazenda,
  setHistoricoPage,
}: UseLotesFIVDataProps) {
  const { toast } = useToast();

  // Estados principais
  const [lotes, setLotes] = useState<LoteFIVComNomes[]>([]);
  const [pacotes, setPacotes] = useState<PacoteComNomes[]>([]);
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [doadoras, setDoadoras] = useState<Doadora[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados do detalhe do lote
  const [selectedLote, setSelectedLote] = useState<LoteFIVComNomes | null>(null);
  const [showLoteDetail, setShowLoteDetail] = useState(false);
  const [acasalamentos, setAcasalamentos] = useState<AcasalamentoComNomes[]>([]);
  const [fazendasDestinoIds, setFazendasDestinoIds] = useState<string[]>([]);
  const [historicoDespachos, setHistoricoDespachos] = useState<HistoricoDespacho[]>([]);
  const [aspiracoesDisponiveis, setAspiracoesDisponiveis] = useState<AspiracaoComOocitosDisponiveis[]>([]);
  const [dosesDisponiveis, setDosesDisponiveis] = useState<DoseSemen[]>([]);
  const [fazendaOrigemNome, setFazendaOrigemNome] = useState<string>('');
  const [fazendasDestinoNomes, setFazendasDestinoNomes] = useState<string[]>([]);
  const [dosesDisponiveisNoLote, setDosesDisponiveisNoLote] = useState<DoseSemen[]>([]);
  const [dataAspiracao, setDataAspiracao] = useState<string>('');

  // Estados para filtros
  const [pacotesParaFiltro, setPacotesParaFiltro] = useState<PacoteComNomes[]>([]);
  const [fazendasAspiracaoUnicas, setFazendasAspiracaoUnicas] = useState<{ id: string; nome: string }[]>([]);

  // Estados do histórico
  const [lotesHistoricos, setLotesHistoricos] = useState<LoteHistorico[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [loteExpandido, setLoteExpandido] = useState<string | null>(null);
  const [detalhesLoteExpandido, setDetalhesLoteExpandido] = useState<DetalhesLoteHistorico | null>(null);
  const [loadingDetalhes, setLoadingDetalhes] = useState(false);

  // Carregar histórico de despachos do lote
  const loadHistoricoDespachos = useCallback(async (loteId: string) => {
    try {
      const { data: todosEmbrioes, error: embrioesError } = await supabase
        .from('embrioes')
        .select('id, lote_fiv_acasalamento_id, created_at')
        .eq('lote_fiv_id', loteId)
        .order('created_at', { ascending: false });

      if (embrioesError) {
        setHistoricoDespachos([]);
        return;
      }

      // Agrupar embriões por data de criação (data do despacho)
      const embrioesPorData = new Map<string, typeof todosEmbrioes>();

      todosEmbrioes?.forEach(embriao => {
        if (embriao.created_at) {
          const dataDespacho = embriao.created_at.split('T')[0];
          const lista = embrioesPorData.get(dataDespacho) || [];
          lista.push(embriao);
          embrioesPorData.set(dataDespacho, lista);
        }
      });

      // Buscar todos os acasalamentos do lote com dados de doadora e dose
      const acasalamentoIdsUnicos = [...new Set(todosEmbrioes?.map(e => e.lote_fiv_acasalamento_id).filter(Boolean) || [])] as string[];

      if (acasalamentoIdsUnicos.length > 0) {
        const { data: acasalamentosData, error: acasalamentosError } = await supabase
          .from('lote_fiv_acasalamentos')
          .select('id, aspiracao_doadora_id, dose_semen_id')
          .in('id', acasalamentoIdsUnicos);

        if (!acasalamentosError && acasalamentosData) {
          const aspiracaoIds = [...new Set(acasalamentosData.map(a => a.aspiracao_doadora_id).filter(Boolean))] as string[];
          const { data: aspiracoesData } = await supabase
            .from('aspiracoes_doadoras')
            .select('id, doadora_id')
            .in('id', aspiracaoIds);

          const doadoraIds = [...new Set(aspiracoesData?.map(a => a.doadora_id).filter(Boolean) || [])] as string[];
          const { data: doadorasData } = await supabase
            .from('doadoras')
            .select('id, registro, nome')
            .in('id', doadoraIds);

          const doseIds = [...new Set(acasalamentosData.map(a => a.dose_semen_id).filter(Boolean))] as string[];
          const { data: dosesData } = await supabase
            .from('doses_semen')
            .select(`id, touro_id, touro:touros(id, nome, registro, raca)`)
            .in('id', doseIds);

          const aspiracoesMap = new Map(aspiracoesData?.map(a => [a.id, a]) || []);
          const doadorasMap = new Map(doadorasData?.map(d => [d.id, d]) || []);
          const dosesMap = new Map(dosesData?.map(d => [d.id, d]) || []);
          const acasalamentosMap = new Map(acasalamentosData.map(a => [a.id, a]));

          const datasDespacho = Array.from(embrioesPorData.keys()).sort((a, b) => b.localeCompare(a));
          const historico = datasDespacho.map((dataDespacho) => {
            const embrioesDesteDespacho = embrioesPorData.get(dataDespacho) || [];
            const quantidadePorAcasalamento = new Map<string, number>();

            embrioesDesteDespacho.forEach(e => {
              if (e.lote_fiv_acasalamento_id) {
                quantidadePorAcasalamento.set(
                  e.lote_fiv_acasalamento_id,
                  (quantidadePorAcasalamento.get(e.lote_fiv_acasalamento_id) || 0) + 1
                );
              }
            });

            const acasalamentosDespacho = Array.from(quantidadePorAcasalamento.entries()).map(([acasalamentoId, quantidade]) => {
              const acasalamento = acasalamentosMap.get(acasalamentoId);
              const aspiracao = acasalamento ? aspiracoesMap.get(acasalamento.aspiracao_doadora_id) : undefined;
              const doadora = aspiracao ? doadorasMap.get(aspiracao.doadora_id) : undefined;
              const dose = acasalamento ? dosesMap.get(acasalamento.dose_semen_id) : undefined;

              return {
                acasalamento_id: acasalamentoId,
                quantidade,
                doadora: doadora?.registro || doadora?.nome || '-',
                dose: dose ? (dose.touro?.nome || 'Touro desconhecido') : '-',
              };
            });

            return {
              id: `${loteId}-${dataDespacho}`,
              data_despacho: dataDespacho,
              acasalamentos: acasalamentosDespacho,
            };
          });

          setHistoricoDespachos(historico);
          return;
        }
      }

      // Se não houver acasalamentos, criar histórico vazio baseado nas datas encontradas
      const historico = Array.from(embrioesPorData.keys()).map((dataDespacho) => ({
        id: `${loteId}-${dataDespacho}`,
        data_despacho: dataDespacho,
        acasalamentos: [],
      }));

      setHistoricoDespachos(historico);
    } catch {
      setHistoricoDespachos([]);
    }
  }, []);

  // Carregar dados da lista principal
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
        const diaAtual = dataAspiracaoStr ? Math.max(0, diffDays(hojeStr, dataAspiracaoStr)) : 0;

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
        supabase
          .from('lotes_fiv')
          .update({ status: 'FECHADO' })
          .in('id', lotesIdsParaFechar)
          .then(({ error }) => {
            if (error) {
              toast({
                title: 'Aviso',
                description: 'Não foi possível fechar automaticamente alguns lotes expirados. Recarregue a página.',
                variant: 'destructive',
              });
            }
          });
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

  // Carregar lotes históricos
  const loadLotesHistoricos = useCallback(async () => {
    try {
      setLoadingHistorico(true);
      setHistoricoPage(1);

      let query = supabase
        .from('lotes_fiv')
        .select('*')
        .eq('status', 'FECHADO');

      if (filtroHistoricoDataInicio) {
        query = query.gte('data_abertura', filtroHistoricoDataInicio);
      }
      if (filtroHistoricoDataFim) {
        query = query.lte('data_abertura', filtroHistoricoDataFim);
      }

      const { data: lotesData, error: lotesError } = await query.order('data_abertura', { ascending: false });

      if (lotesError) throw lotesError;

      if (!lotesData || lotesData.length === 0) {
        setLotesHistoricos([]);
        setLoadingHistorico(false);
        return;
      }

      const loteIds = lotesData.map(l => l.id);
      const pacoteIds = [...new Set(lotesData.map(l => l.pacote_aspiracao_id).filter(Boolean))];

      const { data: pacotesData } = await supabase
        .from('pacotes_aspiracao')
        .select('id, data_aspiracao, fazenda_id, total_oocitos')
        .in('id', pacoteIds);

      const { data: fazendasData } = await supabase
        .from('fazendas')
        .select('id, nome')
        .order('nome', { ascending: true });

      const fazendasMap = new Map(fazendasData?.map(f => [f.id, f.nome]) || []);
      const fazendasUnicasParaFiltro = fazendasData?.map(f => ({ id: f.id, nome: f.nome })) || [];

      const { data: acasalamentosData } = await supabase
        .from('lote_fiv_acasalamentos')
        .select('id, lote_fiv_id, quantidade_embrioes, aspiracao_doadora_id')
        .in('lote_fiv_id', loteIds);

      const { data: embrioesData, error: embrioesError } = await supabase
        .from('embrioes')
        .select('id, lote_fiv_id, lote_fiv_acasalamento_id, classificacao, status_atual')
        .in('lote_fiv_id', loteIds);

      if (embrioesError) {
        toast({
          title: 'Erro ao buscar embriões',
          description: embrioesError.message,
          variant: 'destructive',
        });
      }

      const { data: fazendasDestinoData } = await supabase
        .from('lote_fiv_fazendas_destino')
        .select('lote_fiv_id, fazenda_id')
        .in('lote_fiv_id', loteIds);

      const aspiracaoIds = [...new Set(acasalamentosData?.map(a => a.aspiracao_doadora_id).filter(Boolean) || [])];
      const { data: aspiracoesData } = await supabase
        .from('aspiracoes_doadoras')
        .select('id, viaveis')
        .in('id', aspiracaoIds);

      const pacotesMap = new Map(pacotesData?.map(p => [p.id, p]) || []);
      const acasalamentosPorLote = new Map<string, typeof acasalamentosData>();
      const embrioesPorLote = new Map<string, typeof embrioesData>();
      const fazendasDestinoPorLote = new Map<string, string[]>();
      const aspiracoesMap = new Map(aspiracoesData?.map(a => [a.id, a]) || []);

      acasalamentosData?.forEach(a => {
        if (!acasalamentosPorLote.has(a.lote_fiv_id)) {
          acasalamentosPorLote.set(a.lote_fiv_id, []);
        }
        acasalamentosPorLote.get(a.lote_fiv_id)!.push(a);
      });

      if (embrioesData && embrioesData.length > 0) {
        embrioesData.forEach(e => {
          if (!e.lote_fiv_id) return;
          if (!embrioesPorLote.has(e.lote_fiv_id)) {
            embrioesPorLote.set(e.lote_fiv_id, []);
          }
          embrioesPorLote.get(e.lote_fiv_id)!.push(e);
        });
      }

      fazendasDestinoData?.forEach(fd => {
        if (!fazendasDestinoPorLote.has(fd.lote_fiv_id)) {
          fazendasDestinoPorLote.set(fd.lote_fiv_id, []);
        }
        const nome = fazendasMap.get(fd.fazenda_id);
        if (nome) {
          fazendasDestinoPorLote.get(fd.lote_fiv_id)!.push(nome);
        }
      });

      let historicos: LoteHistorico[] = lotesData.map(lote => {
        const pacote = pacotesMap.get(lote.pacote_aspiracao_id);
        const acasalamentos = acasalamentosPorLote.get(lote.id) || [];
        const embrioes = embrioesPorLote.get(lote.id) || [];
        const fazendasDestino = fazendasDestinoPorLote.get(lote.id) || [];

        const totalEmbrioes = embrioes.length;
        const totalTransferidos = embrioes.filter(e => e.status_atual === 'TRANSFERIDO').length;
        const totalCongelados = embrioes.filter(e => e.status_atual === 'CONGELADO').length;
        const totalDescartados = embrioes.filter(e => e.status_atual === 'DESCARTADO').length;

        const embrioesPorClassificacao: Record<string, number> = {};
        embrioes.forEach(e => {
          if (e.classificacao) {
            embrioesPorClassificacao[e.classificacao] = (embrioesPorClassificacao[e.classificacao] || 0) + 1;
          } else {
            embrioesPorClassificacao['sem_classificacao'] = (embrioesPorClassificacao['sem_classificacao'] || 0) + 1;
          }
        });

        let totalViaveis = 0;
        acasalamentos.forEach(a => {
          if (a.aspiracao_doadora_id) {
            const aspiracao = aspiracoesMap.get(a.aspiracao_doadora_id);
            if (aspiracao?.viaveis) {
              totalViaveis += aspiracao.viaveis;
            }
          }
        });

        return {
          id: lote.id,
          data_abertura: lote.data_abertura,
          status: lote.status,
          observacoes: lote.observacoes,
          pacote_aspiracao_id: lote.pacote_aspiracao_id,
          pacote_data: pacote?.data_aspiracao,
          pacote_nome: fazendasMap.get(pacote?.fazenda_id || ''),
          fazenda_origem_nome: fazendasMap.get(pacote?.fazenda_id || ''),
          fazendas_destino_nomes: fazendasDestino,
          quantidade_acasalamentos: acasalamentos.length,
          total_embrioes_produzidos: totalEmbrioes,
          total_embrioes_transferidos: totalTransferidos,
          total_embrioes_congelados: totalCongelados,
          total_embrioes_descartados: totalDescartados,
          embrioes_por_classificacao: {
            BE: embrioesPorClassificacao['BE'],
            BN: embrioesPorClassificacao['BN'],
            BX: embrioesPorClassificacao['BX'],
            BL: embrioesPorClassificacao['BL'],
            BI: embrioesPorClassificacao['BI'],
            sem_classificacao: embrioesPorClassificacao['sem_classificacao'],
          },
          total_oocitos: pacote?.total_oocitos,
          total_viaveis: totalViaveis > 0 ? totalViaveis : undefined,
        };
      });

      // Aplicar filtro de fazenda de origem
      if (filtroHistoricoFazenda) {
        const fazendaSelecionada = fazendasUnicasParaFiltro.find(f => f.id === filtroHistoricoFazenda);
        if (fazendaSelecionada) {
          historicos = historicos.filter(lote =>
            lote.fazenda_origem_nome === fazendaSelecionada.nome
          );
        }
      }

      setLotesHistoricos(historicos);
    } catch (error) {
      handleError(error, 'Erro ao carregar histórico');
    } finally {
      setLoadingHistorico(false);
    }
  }, [filtroHistoricoDataInicio, filtroHistoricoDataFim, filtroHistoricoFazenda, setHistoricoPage, toast]);

  // Carregar detalhes de um lote histórico
  const loadDetalhesLoteHistorico = useCallback(async (loteId: string) => {
    try {
      setLoadingDetalhes(true);

      const lote = lotesHistoricos.find(l => l.id === loteId);
      if (!lote) {
        toast({
          title: 'Erro',
          description: 'Lote não encontrado',
          variant: 'destructive',
        });
        return;
      }

      const { data: pacoteData } = await supabase
        .from('pacotes_aspiracao')
        .select('*')
        .eq('id', lote.pacote_aspiracao_id)
        .single();

      const { data: acasalamentosData } = await supabase
        .from('lote_fiv_acasalamentos')
        .select('*')
        .eq('lote_fiv_id', loteId)
        .order('created_at', { ascending: true });

      const { data: embrioesData } = await supabase
        .from('embrioes')
        .select('*')
        .eq('lote_fiv_id', loteId)
        .order('created_at', { ascending: true });

      const aspiracaoIds = [...new Set(acasalamentosData?.map(a => a.aspiracao_doadora_id).filter(Boolean) || [])];
      const { data: aspiracoesData } = await supabase
        .from('aspiracoes_doadoras')
        .select('*, doadora:doadoras(id, registro, nome)')
        .in('id', aspiracaoIds);

      const doseIds = [...new Set(acasalamentosData?.map(a => a.dose_semen_id).filter(Boolean) || [])];
      const { data: dosesData } = await supabase
        .from('doses_semen')
        .select(`*, cliente:clientes(nome), touro:touros(id, nome, registro, raca)`)
        .in('id', doseIds);

      const aspiracoesMap = new Map(aspiracoesData?.map(a => [a.id, a]) || []);
      const dosesMap = new Map(dosesData?.map(d => [d.id, d]) || []);

      const embrioesPorAcasalamento = new Map<string, {
        total: number;
        porStatus: { [status: string]: number };
        porClassificacao: { [classificacao: string]: number };
      }>();

      (embrioesData || []).forEach(embriao => {
        const acasalamentoId = embriao.lote_fiv_acasalamento_id || 'sem_acasalamento';
        if (!embrioesPorAcasalamento.has(acasalamentoId)) {
          embrioesPorAcasalamento.set(acasalamentoId, {
            total: 0,
            porStatus: {},
            porClassificacao: {},
          });
        }
        const stats = embrioesPorAcasalamento.get(acasalamentoId)!;
        stats.total++;

        const status = embriao.status_atual || 'sem_status';
        stats.porStatus[status] = (stats.porStatus[status] || 0) + 1;

        const classificacao = embriao.classificacao || 'sem_classificacao';
        stats.porClassificacao[classificacao] = (stats.porClassificacao[classificacao] || 0) + 1;
      });

      const detalhes: DetalhesLoteHistorico = {
        lote,
        pacote: pacoteData ? {
          id: pacoteData.id,
          data_aspiracao: pacoteData.data_aspiracao,
          horario_inicio: pacoteData.horario_inicio,
          horario_final: pacoteData.horario_final,
          veterinario_responsavel: pacoteData.veterinario_responsavel,
          tecnico_responsavel: pacoteData.tecnico_responsavel,
          total_oocitos: pacoteData.total_oocitos,
          observacoes: pacoteData.observacoes,
        } : undefined,
        acasalamentos: (acasalamentosData || []).map(acasalamento => {
          const aspiracao = acasalamento.aspiracao_doadora_id ? aspiracoesMap.get(acasalamento.aspiracao_doadora_id) : null;
          const dose = acasalamento.dose_semen_id ? dosesMap.get(acasalamento.dose_semen_id) : null;
          const doadora = aspiracao?.doadora;
          const statsEmbrioes = embrioesPorAcasalamento.get(acasalamento.id) || {
            total: 0,
            porStatus: {},
            porClassificacao: {},
          };

          return {
            id: acasalamento.id,
            aspiracao_id: acasalamento.aspiracao_doadora_id,
            doadora: doadora ? {
              registro: doadora.registro,
              nome: doadora.nome,
            } : undefined,
            aspiracao: aspiracao ? {
              data_aspiracao: aspiracao.data_aspiracao,
              horario_aspiracao: aspiracao.horario_aspiracao,
              viaveis: aspiracao.viaveis,
              expandidos: aspiracao.expandidos,
              total_oocitos: aspiracao.total_oocitos,
              atresicos: aspiracao.atresicos,
              degenerados: aspiracao.degenerados,
              desnudos: aspiracao.desnudos,
              veterinario_responsavel: aspiracao.veterinario_responsavel,
            } : undefined,
            dose_semen: dose ? {
              nome: dose.touro?.nome || 'Touro desconhecido',
              registro: dose.touro?.registro,
              raca: dose.touro?.raca || dose.raca,
              tipo_semen: dose.tipo_semen,
              cliente: dose.cliente?.nome,
            } : undefined,
            quantidade_fracionada: acasalamento.quantidade_fracionada,
            quantidade_oocitos: acasalamento.quantidade_oocitos,
            quantidade_embrioes: acasalamento.quantidade_embrioes,
            observacoes: acasalamento.observacoes,
            resumo_embrioes: statsEmbrioes,
          };
        }),
        embrioes: (embrioesData || []).map(embriao => ({
          id: embriao.id,
          identificacao: embriao.identificacao,
          classificacao: embriao.classificacao,
          tipo_embriao: embriao.tipo_embriao,
          status_atual: embriao.status_atual,
          acasalamento_id: embriao.lote_fiv_acasalamento_id,
        })),
      };

      setDetalhesLoteExpandido(detalhes);
    } catch (error) {
      handleError(error, 'Erro ao carregar detalhes');
    } finally {
      setLoadingDetalhes(false);
    }
  }, [lotesHistoricos, toast]);

  // Expandir/recolher lote histórico
  const handleExpandirLote = useCallback(async (loteId: string) => {
    if (loteExpandido === loteId) {
      setLoteExpandido(null);
      setDetalhesLoteExpandido(null);
    } else {
      setLoteExpandido(loteId);
      await loadDetalhesLoteHistorico(loteId);
    }
  }, [loteExpandido, loadDetalhesLoteHistorico]);

  // Carregar detalhes de um lote específico
  const loadLoteDetail = useCallback(async (loteId: string) => {
    try {
      setLoading(true);

      const { data: loteData, error: loteError } = await supabase
        .from('lotes_fiv')
        .select('*')
        .eq('id', loteId)
        .single();

      if (loteError) throw loteError;

      const { data: pacoteData, error: pacoteError } = await supabase
        .from('pacotes_aspiracao')
        .select('*')
        .eq('id', loteData.pacote_aspiracao_id)
        .single();

      if (pacoteError) {
        if (pacoteError.code === 'PGRST116') {
          toast({
            title: 'Pacote não encontrado',
            description: 'O lote referencia um pacote de aspiração inexistente. Verifique o vínculo do lote.',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }
        throw pacoteError;
      }

      setDataAspiracao(pacoteData.data_aspiracao);

      const { data: fazendaOrigemData, error: fazendaOrigemError } = await supabase
        .from('fazendas')
        .select('nome')
        .eq('id', pacoteData.fazenda_id)
        .single();

      if (fazendaOrigemError) {
        setFazendaOrigemNome('');
      } else {
        setFazendaOrigemNome(fazendaOrigemData?.nome || '');
      }

      const { data: fazendasDestinoData } = await supabase
        .from('pacotes_aspiracao_fazendas_destino')
        .select('fazenda_destino_id')
        .eq('pacote_aspiracao_id', pacoteData.id);

      let fazendaDestinoIdsArray: string[] = [];
      if (!fazendasDestinoData || fazendasDestinoData.length === 0) {
        if (pacoteData.fazenda_destino_id) {
          fazendaDestinoIdsArray = [pacoteData.fazenda_destino_id];
        }
      } else {
        fazendaDestinoIdsArray = fazendasDestinoData.map((item) => item.fazenda_destino_id);
      }
      setFazendasDestinoIds(fazendaDestinoIdsArray);

      if (fazendaDestinoIdsArray.length > 0) {
        const { data: fazendasDestinoNomesData, error: fazendasDestinoNomesError } = await supabase
          .from('fazendas')
          .select('id, nome')
          .in('id', fazendaDestinoIdsArray);

        if (fazendasDestinoNomesError) {
          setFazendasDestinoNomes([]);
        } else {
          setFazendasDestinoNomes(fazendasDestinoNomesData?.map((f) => f.nome) || []);
          if (fazendasDestinoNomesData) {
            setFazendas(prev => {
              const fazendasAtualizadas = [...prev];
              fazendasDestinoNomesData.forEach(f => {
                if (!fazendasAtualizadas.find(fa => fa.id === f.id)) {
                  fazendasAtualizadas.push(f);
                }
              });
              return fazendasAtualizadas;
            });
          }
        }
      } else {
        setFazendasDestinoNomes([]);
      }

      const { data: acasalamentosData, error: acasalamentosError } = await supabase
        .from('lote_fiv_acasalamentos')
        .select('*')
        .eq('lote_fiv_id', loteId)
        .order('created_at', { ascending: true });

      if (acasalamentosError) throw acasalamentosError;

      const aspiracaoIds = acasalamentosData?.map((a) => a.aspiracao_doadora_id) || [];
      const { data: aspiracoesData, error: aspiracoesError } = await supabase
        .from('aspiracoes_doadoras')
        .select('id, doadora_id, viaveis')
        .in('id', aspiracaoIds);

      if (aspiracoesError) throw aspiracoesError;

      const doadoraIds = [...new Set(aspiracoesData?.map((a) => a.doadora_id) || [])];
      const { data: doadorasData, error: doadorasError } = await supabase
        .from('doadoras')
        .select('id, nome, registro')
        .in('id', doadoraIds);

      if (doadorasError) throw doadorasError;

      const doseIds = [...new Set(acasalamentosData?.map((a) => a.dose_semen_id) || [])];
      const { data: dosesData, error: dosesError } = await supabase
        .from('doses_semen')
        .select(`id, touro_id, touro:touros(id, nome, registro, raca)`)
        .in('id', doseIds);

      if (dosesError) throw dosesError;

      const doadorasMap = new Map(doadorasData?.map((d) => [d.id, d]));
      const dosesMap = new Map(dosesData?.map((d) => [d.id, d]));
      const aspiracoesMap = new Map(aspiracoesData?.map((a) => [a.id, a]));

      const { data: embrioesData, error: embrioesError } = await supabase
        .from('embrioes')
        .select('lote_fiv_acasalamento_id')
        .eq('lote_fiv_id', loteId);

      const quantidadeEmbrioesPorAcasalamento = new Map<string, number>();
      if (!embrioesError && embrioesData) {
        embrioesData.forEach(embriao => {
          if (embriao.lote_fiv_acasalamento_id) {
            quantidadeEmbrioesPorAcasalamento.set(
              embriao.lote_fiv_acasalamento_id,
              (quantidadeEmbrioesPorAcasalamento.get(embriao.lote_fiv_acasalamento_id) || 0) + 1
            );
          }
        });
      }

      const acasalamentosComNomes: AcasalamentoComNomes[] = (acasalamentosData || []).map((a) => {
        const aspiracao = aspiracoesMap.get(a.aspiracao_doadora_id);
        const doadora = aspiracao ? doadorasMap.get(aspiracao.doadora_id) : undefined;
        const dose = dosesMap.get(a.dose_semen_id);
        const touro = dose?.touro ?? null;

        return {
          ...a,
          doadora_nome: doadora?.nome || doadora?.registro,
          doadora_registro: doadora?.registro,
          dose_nome: touro?.nome || 'Touro desconhecido',
          viaveis: aspiracao?.viaveis,
          total_embrioes_produzidos: quantidadeEmbrioesPorAcasalamento.get(a.id) || 0,
        };
      });

      setAcasalamentos(acasalamentosComNomes);
      setSelectedLote({
        ...loteData,
        pacote_nome: pacoteData.fazenda_id,
        pacote_data: pacoteData.data_aspiracao,
      } as LoteFIVComNomes);
      setShowLoteDetail(true);

      // Carregar todas as aspirações do pacote
      const { data: todasAspiracoesData, error: todasAspiracoesError } = await supabase
        .from('aspiracoes_doadoras')
        .select('id, doadora_id, viaveis')
        .eq('pacote_aspiracao_id', loteData.pacote_aspiracao_id);

      if (!todasAspiracoesError) {
        const oocitosUsadosPorAspiracao = new Map<string, number>();
        acasalamentosData?.forEach((acasalamento) => {
          const aspiracaoId = acasalamento.aspiracao_doadora_id;
          const oocitosUsados = acasalamento.quantidade_oocitos || 0;
          oocitosUsadosPorAspiracao.set(
            aspiracaoId,
            (oocitosUsadosPorAspiracao.get(aspiracaoId) || 0) + oocitosUsados
          );
        });

        const aspiracoesDisponiveisFiltradas = (todasAspiracoesData || []).filter((a) => {
          const oocitosTotal = a.viaveis ?? 0;
          const oocitosUsados = oocitosUsadosPorAspiracao.get(a.id) || 0;
          const oocitosDisponiveis = oocitosTotal - oocitosUsados;
          return oocitosTotal > 0 && oocitosDisponiveis > 0;
        });

        const aspiracoesComOocitosDisponiveis = aspiracoesDisponiveisFiltradas.map((a) => ({
          ...a,
          oocitos_disponiveis: (a.viaveis ?? 0) - (oocitosUsadosPorAspiracao.get(a.id) || 0),
        }));

        setAspiracoesDisponiveis(aspiracoesComOocitosDisponiveis);

        const todasDoadoraIds = [...new Set(todasAspiracoesData?.map((a) => a.doadora_id) || [])];
        if (todasDoadoraIds.length > 0) {
          const { data: todasDoadorasData, error: todasDoadorasError } = await supabase
            .from('doadoras')
            .select('id, nome, registro')
            .in('id', todasDoadoraIds);

          if (!todasDoadorasError && todasDoadorasData) {
            setDoadoras(todasDoadorasData);
          }
        }
      }

      // Load doses disponíveis
      const { data: dosesDisponiveisData, error: dosesDisponiveisError } = await supabase
        .from('doses_semen')
        .select(`id, touro_id, cliente_id, tipo_semen, quantidade, touro:touros(id, nome, registro, raca)`)
        .order('created_at', { ascending: false });

      if (dosesDisponiveisError) {
        setDosesDisponiveis([]);
      } else {
        try {
          const dosesSelecionadas = loteData?.doses_selecionadas as string[] | undefined;
          if (dosesSelecionadas && Array.isArray(dosesSelecionadas) && dosesSelecionadas.length > 0) {
            setDosesDisponiveis(
              (dosesDisponiveisData || []).filter((d) => dosesSelecionadas.includes(d.id))
            );
          } else {
            setDosesDisponiveis(dosesDisponiveisData || []);
          }
        } catch {
          setDosesDisponiveis(dosesDisponiveisData || []);
        }
      }

      // Load clientes
      const { data: clientesData, error: clientesError } = await supabase
        .from('clientes')
        .select('id, nome')
        .order('nome', { ascending: true });

      if (!clientesError) {
        setClientes(clientesData || []);
      }

      await loadHistoricoDespachos(loteId);

    } catch (error) {
      handleError(error, 'Erro ao carregar detalhes do lote');
    } finally {
      setLoading(false);
    }
  }, [toast, loadHistoricoDespachos]);

  // Effect para carregar dados iniciais
  useEffect(() => {
    if (id) {
      loadLoteDetail(id);
    } else {
      loadData();
    }
  }, [id, loadData, loadLoteDetail]);

  return {
    // Estados principais
    lotes,
    pacotes,
    fazendas,
    setFazendas,
    doadoras,
    clientes,
    loading,

    // Estados do detalhe do lote
    selectedLote,
    setSelectedLote,
    showLoteDetail,
    setShowLoteDetail,
    acasalamentos,
    setAcasalamentos,
    fazendasDestinoIds,
    historicoDespachos,
    setHistoricoDespachos,
    aspiracoesDisponiveis,
    dosesDisponiveis,
    fazendaOrigemNome,
    fazendasDestinoNomes,
    dosesDisponiveisNoLote,
    dataAspiracao,

    // Estados para filtros
    pacotesParaFiltro,
    fazendasAspiracaoUnicas,

    // Estados do histórico
    lotesHistoricos,
    loadingHistorico,
    loteExpandido,
    detalhesLoteExpandido,
    loadingDetalhes,

    // Funções
    loadData,
    loadLoteDetail,
    loadLotesHistoricos,
    handleExpandirLote,
  };
}
