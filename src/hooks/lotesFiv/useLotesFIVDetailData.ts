/**
 * Hook para carregamento de detalhes de um Lote FIV específico
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { DoseSemen, Fazenda, Doadora, Cliente } from '@/lib/types';
import {
  LoteFIVComNomes,
  AcasalamentoComNomes,
  AspiracaoComOocitosDisponiveis,
  HistoricoDespacho,
} from '@/lib/types/lotesFiv';
import { handleError } from '@/lib/error-handler';
import { useToast } from '@/hooks/use-toast';

export interface UseLotesFIVDetailDataProps {
  setFazendas: React.Dispatch<React.SetStateAction<Fazenda[]>>;
  setDoadoras: React.Dispatch<React.SetStateAction<Doadora[]>>;
  setClientes: React.Dispatch<React.SetStateAction<Cliente[]>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
}

export interface UseLotesFIVDetailDataReturn {
  selectedLote: LoteFIVComNomes | null;
  setSelectedLote: React.Dispatch<React.SetStateAction<LoteFIVComNomes | null>>;
  showLoteDetail: boolean;
  setShowLoteDetail: React.Dispatch<React.SetStateAction<boolean>>;
  acasalamentos: AcasalamentoComNomes[];
  setAcasalamentos: React.Dispatch<React.SetStateAction<AcasalamentoComNomes[]>>;
  fazendasDestinoIds: string[];
  historicoDespachos: HistoricoDespacho[];
  setHistoricoDespachos: React.Dispatch<React.SetStateAction<HistoricoDespacho[]>>;
  aspiracoesDisponiveis: AspiracaoComOocitosDisponiveis[];
  dosesDisponiveis: DoseSemen[];
  fazendaOrigemNome: string;
  fazendasDestinoNomes: string[];
  dosesDisponiveisNoLote: DoseSemen[];
  dataAspiracao: string;
  loadLoteDetail: (loteId: string) => Promise<void>;
  loadHistoricoDespachos: (loteId: string) => Promise<void>;
}

export function useLotesFIVDetailData({
  setFazendas,
  setDoadoras,
  setClientes,
  setLoading,
}: UseLotesFIVDetailDataProps): UseLotesFIVDetailDataReturn {
  const { toast } = useToast();

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

        // Filtrar aspirações: só mostrar doadoras com oócitos ainda disponíveis
        const aspiracoesDisponiveisFiltradas = (todasAspiracoesData || []).filter((a) => {
          const oocitosTotal = a.viaveis ?? 0;
          const oocitosUsados = oocitosUsadosPorAspiracao.get(a.id) || 0;
          const oocitosDisponiveis = oocitosTotal - oocitosUsados;
          return oocitosTotal > 0 && oocitosDisponiveis > 0;
        });

        const aspiracoesComOocitosDisponiveis = aspiracoesDisponiveisFiltradas.map((a) => ({
          ...a,
          oocitos_disponiveis: Math.max(0, (a.viaveis ?? 0) - (oocitosUsadosPorAspiracao.get(a.id) || 0)),
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
  }, [toast, loadHistoricoDespachos, setFazendas, setDoadoras, setClientes, setLoading]);

  return {
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
    loadLoteDetail,
    loadHistoricoDespachos,
  };
}
