/**
 * Hook para carregamento de histórico de Lotes FIV fechados
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { LoteHistorico, DetalhesLoteHistorico } from '@/lib/types/lotesFiv';
import { handleError } from '@/lib/error-handler';
import { useToast } from '@/hooks/use-toast';

export interface UseLotesFIVHistoricoDataProps {
  filtroHistoricoDataInicio: string;
  filtroHistoricoDataFim: string;
  filtroHistoricoFazenda: string;
  setHistoricoPage: (page: number) => void;
}

export interface UseLotesFIVHistoricoDataReturn {
  lotesHistoricos: LoteHistorico[];
  loadingHistorico: boolean;
  loteExpandido: string | null;
  detalhesLoteExpandido: DetalhesLoteHistorico | null;
  loadingDetalhes: boolean;
  loadLotesHistoricos: () => Promise<void>;
  handleExpandirLote: (loteId: string) => Promise<void>;
}

export function useLotesFIVHistoricoData({
  filtroHistoricoDataInicio,
  filtroHistoricoDataFim,
  filtroHistoricoFazenda,
  setHistoricoPage,
}: UseLotesFIVHistoricoDataProps): UseLotesFIVHistoricoDataReturn {
  const { toast } = useToast();

  const [lotesHistoricos, setLotesHistoricos] = useState<LoteHistorico[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [loteExpandido, setLoteExpandido] = useState<string | null>(null);
  const [detalhesLoteExpandido, setDetalhesLoteExpandido] = useState<DetalhesLoteHistorico | null>(null);
  const [loadingDetalhes, setLoadingDetalhes] = useState(false);

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

  return {
    lotesHistoricos,
    loadingHistorico,
    loteExpandido,
    detalhesLoteExpandido,
    loadingDetalhes,
    loadLotesHistoricos,
    handleExpandirLote,
  };
}
