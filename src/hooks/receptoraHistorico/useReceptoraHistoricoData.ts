/**
 * Hook para carregamento de dados do histórico de receptoras
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Receptora, SupabaseError } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import {
  HistoricoItem,
  HistoricoAdmin,
  Estatisticas,
} from '@/lib/receptoraHistoricoUtils';
import { extractDateOnly } from '@/lib/dateUtils';

interface DoseQueryLocal {
  id: string;
  touro_id?: string;
  touro?: {
    id: string;
    nome: string;
    registro?: string;
    raca?: string;
  } | null;
}

export interface UseReceptoraHistoricoDataReturn {
  loading: boolean;
  receptora: Receptora | null;
  historico: HistoricoItem[];
  historicoAdmin: HistoricoAdmin[];
  estatisticas: Estatisticas;
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

  const carregarHistoricoReceptora = useCallback(async (targetReceptoraId: string) => {
    const items: HistoricoItem[] = [];
    const itemsAdmin: HistoricoAdmin[] = [];

    // Carregar dados da receptora
    const { data: receptoraData, error: receptoraError } = await supabase
      .from('receptoras')
      .select('*')
      .eq('id', targetReceptoraId)
      .single();

    if (receptoraError) {
      if ((receptoraError as SupabaseError)?.code === 'PGRST116') {
        return {
          receptoraData: null,
          items: [],
          itemsAdmin: [],
          stats: { totalCiclos: 0, totalGestacoes: 0, ciclosDesdeUltimaGestacao: 0 },
        };
      }
      throw receptoraError;
    }

    // Carregar histórico de fazendas
    const { data: historicoFazendas } = await supabase
      .from('receptora_fazenda_historico')
      .select('id, fazenda_id, data_inicio')
      .eq('receptora_id', targetReceptoraId)
      .order('data_inicio', { ascending: true });

    if (historicoFazendas && historicoFazendas.length > 0) {
      const primeiroRegistro = historicoFazendas[0];
      const { data: fazendaData } = await supabase
        .from('fazendas')
        .select('nome')
        .eq('id', primeiroRegistro.fazenda_id)
        .single();

      itemsAdmin.push({
        data: extractDateOnly(primeiroRegistro.data_inicio),
        tipo: 'CADASTRO',
        resumo: `Cadastro na fazenda ${fazendaData?.nome || 'desconhecida'}`,
      });

      for (let i = 1; i < historicoFazendas.length; i++) {
        const historicoAtual = historicoFazendas[i];
        const historicoAnterior = historicoFazendas[i - 1];

        const { data: fazendasData } = await supabase
          .from('fazendas')
          .select('id, nome')
          .in('id', [historicoAnterior.fazenda_id, historicoAtual.fazenda_id].filter(Boolean));

        const fazendasMap = new Map(fazendasData?.map(f => [f.id, f.nome]) || []);
        const origemNome = fazendasMap.get(historicoAnterior.fazenda_id) || '?';
        const destinoNome = fazendasMap.get(historicoAtual.fazenda_id) || '?';

        itemsAdmin.push({
          data: extractDateOnly(historicoAtual.data_inicio),
          tipo: 'MUDANCA_FAZENDA',
          resumo: `${origemNome} → ${destinoNome}`,
        });
      }
    }

    // Carregar protocolos
    const { data: protocoloReceptoras } = await supabase
      .from('protocolo_receptoras')
      .select(`
        id,
        data_inclusao,
        status,
        motivo_inapta,
        protocolos_sincronizacao (
          id,
          data_inicio,
          passo2_data
        )
      `)
      .eq('receptora_id', targetReceptoraId)
      .order('data_inclusao', { ascending: false });

    // Carregar diagnósticos
    const { data: diagnosticosData } = await supabase
      .from('diagnosticos_gestacao')
      .select('*')
      .eq('receptora_id', targetReceptoraId)
      .eq('tipo_diagnostico', 'DG')
      .order('data_diagnostico', { ascending: false });

    // Carregar animais (parições)
    const { data: animaisData } = await supabase
      .from('animais')
      .select('id, data_nascimento, sexo')
      .eq('receptora_id', targetReceptoraId);

    if (animaisData && animaisData.length > 0) {
      animaisData.forEach((animal) => {
        if (!animal.data_nascimento) return;
        items.push({
          data: extractDateOnly(animal.data_nascimento),
          tipo: 'PARICAO',
          resumo: 'Parição registrada',
          detalhes: `Animal ${animal.id.substring(0, 8)} • Sexo: ${animal.sexo || '—'}`,
        });
      });
    }

    // Processar protocolos
    if (protocoloReceptoras) {
      for (const pr of protocoloReceptoras) {
        const protocolo = Array.isArray(pr.protocolos_sincronizacao)
          ? pr.protocolos_sincronizacao[0]
          : pr.protocolos_sincronizacao;

        if (!protocolo || !protocolo.data_inicio) continue;

        const dataInicio = extractDateOnly(protocolo.data_inicio);
        let resumo = `1º Passo`;

        if (protocolo.passo2_data) {
          const dataPasso2 = extractDateOnly(protocolo.passo2_data);
          if (pr.status === 'APTA') {
            resumo = `1º Passo • 2º Passo: APTA`;
          } else if (pr.status === 'INAPTA') {
            resumo = `1º Passo • 2º Passo: DESCARTADA`;
            if (pr.motivo_inapta) {
              resumo += ` (${pr.motivo_inapta})`;
            }
          } else {
            resumo = `1º Passo • 2º Passo`;
          }
          items.push({ data: dataPasso2, tipo: 'PROTOCOLO', resumo });
        } else {
          items.push({ data: dataInicio, tipo: 'PROTOCOLO', resumo });
        }
      }
    }

    // Carregar transferências de embriões
    const { data: tesData } = await supabase
      .from('transferencias_embrioes')
      .select(`
        id,
        embriao_id,
        data_te,
        status_te,
        embrioes (
          id,
          identificacao,
          classificacao,
          lote_fiv_acasalamento_id
        )
      `)
      .eq('receptora_id', targetReceptoraId)
      .order('data_te', { ascending: false });

    // Coletar IDs de acasalamentos
    const acasalamentoIds = new Set<string>();
    if (tesData) {
      tesData.forEach(te => {
        const embriao = Array.isArray(te.embrioes) ? te.embrioes[0] : te.embrioes;
        if (embriao?.lote_fiv_acasalamento_id) {
          acasalamentoIds.add(embriao.lote_fiv_acasalamento_id);
        }
      });
    }

    // Carregar dados dos acasalamentos
    const acasalamentosMap = new Map<string, { doadora: string; touro: string }>();
    if (acasalamentoIds.size > 0) {
      const acasalamentoIdsArray = Array.from(acasalamentoIds).filter(Boolean);
      if (acasalamentoIdsArray.length > 0) {
        const { data: acasalamentosData, error: acasalamentosError } = await supabase
          .from('lote_fiv_acasalamentos')
          .select('id, aspiracao_doadora_id, dose_semen_id')
          .in('id', acasalamentoIdsArray);

        if (!acasalamentosError && acasalamentosData) {
          const aspiracaoIds = acasalamentosData.map(a => a.aspiracao_doadora_id).filter(Boolean);
          const doseIds = acasalamentosData.map(a => a.dose_semen_id).filter(Boolean);

          const doadorasMap = new Map<string, string>();
          if (aspiracaoIds.length > 0) {
            const { data: aspiracoesData } = await supabase
              .from('aspiracoes_doadoras')
              .select('id, doadora_id')
              .in('id', aspiracaoIds);

            if (aspiracoesData) {
              const doadoraIds = aspiracoesData.map(a => a.doadora_id).filter(Boolean);
              if (doadoraIds.length > 0) {
                const { data: doadorasData } = await supabase
                  .from('doadoras')
                  .select('id, registro')
                  .in('id', doadoraIds);

                if (doadorasData) {
                  const doadorasRegistroMap = new Map(doadorasData.map(d => [d.id, d.registro]));
                  aspiracoesData.forEach(a => {
                    const registro = doadorasRegistroMap.get(a.doadora_id);
                    if (registro) {
                      doadorasMap.set(a.id, registro);
                    }
                  });
                }
              }
            }
          }

          const tourosMap = new Map<string, string>();
          if (doseIds.length > 0) {
            const { data: dosesData } = await supabase
              .from('doses_semen')
              .select('id, touro_id, touro:touros(id, nome, registro, raca)')
              .in('id', doseIds);

            if (dosesData) {
              dosesData.forEach((d: DoseQueryLocal) => {
                const touro = d.touro;
                tourosMap.set(d.id, touro?.nome || 'Touro desconhecido');
              });
            }
          }

          acasalamentosData.forEach(ac => {
            const doadoraRegistro = doadorasMap.get(ac.aspiracao_doadora_id) || '?';
            const touroNome = tourosMap.get(ac.dose_semen_id) || '?';
            acasalamentosMap.set(ac.id, { doadora: doadoraRegistro, touro: touroNome });
          });
        }
      }
    }

    // Processar TEs
    const acasalamentosPorDataTe = new Map<string, string[]>();
    if (tesData) {
      const tesPorData = new Map<string, typeof tesData>();

      tesData.forEach(te => {
        const chave = te.data_te;
        if (!tesPorData.has(chave)) {
          tesPorData.set(chave, []);
        }
        tesPorData.get(chave)!.push(te);
      });

      tesPorData.forEach((tes, dataTe) => {
        const tesRealizadas = tes.filter(t => t.status_te === 'REALIZADA');
        const tesDescartadas = tes.filter(t => t.status_te === 'DESCARTADA');

        if (tesRealizadas.length > 0) {
          const embrioesInfo: string[] = [];
          const acasalamentosInfo: string[] = [];

          tesRealizadas.forEach(te => {
            const embriao = Array.isArray(te.embrioes) ? te.embrioes[0] : te.embrioes;
            const identificacao = embriao?.identificacao || 'Embrião';
            embrioesInfo.push(identificacao);

            if (embriao?.lote_fiv_acasalamento_id) {
              const acasalamento = acasalamentosMap.get(embriao.lote_fiv_acasalamento_id);
              if (acasalamento) {
                const acasalamentoStr = `${acasalamento.doadora} × ${acasalamento.touro}`;
                if (!acasalamentosInfo.includes(acasalamentoStr)) {
                  acasalamentosInfo.push(acasalamentoStr);
                }
              }
            }
          });

          let resumo = `${tesRealizadas.length} embrião(ões): ${embrioesInfo.join(', ')}`;
          if (acasalamentosInfo.length > 0) {
            resumo += ` | ${acasalamentosInfo.join('; ')}`;
          }

          items.push({ data: extractDateOnly(dataTe), tipo: 'TE', resumo });
          acasalamentosPorDataTe.set(dataTe, acasalamentosInfo);
        } else if (tesDescartadas.length > 0) {
          items.push({ data: extractDateOnly(dataTe), tipo: 'TE', resumo: 'Descartada para TE' });
        }
      });
    }

    // Processar diagnósticos de gestação
    if (diagnosticosData) {
      for (const dg of diagnosticosData) {
        let resumo = dg.resultado === 'PRENHE' ? 'PRENHE' :
                     dg.resultado === 'RETOQUE' ? 'PRENHE (RETOQUE)' : 'VAZIA';

        if (dg.numero_gestacoes && dg.numero_gestacoes > 0 && dg.resultado !== 'VAZIA') {
          resumo += ` (${dg.numero_gestacoes} gestação${dg.numero_gestacoes > 1 ? 'ões' : ''})`;
        }

        if ((dg.resultado === 'PRENHE' || dg.resultado === 'RETOQUE') && dg.data_te) {
          const acasalamentos = acasalamentosPorDataTe.get(dg.data_te);
          if (acasalamentos && acasalamentos.length > 0) {
            resumo += ` | ${acasalamentos.join('; ')}`;
          }
        }

        items.push({ data: extractDateOnly(dg.data_diagnostico), tipo: 'DG', resumo });
      }
    }

    // Carregar sexagens
    const { data: sexagensData } = await supabase
      .from('diagnosticos_gestacao')
      .select('*')
      .eq('receptora_id', targetReceptoraId)
      .eq('tipo_diagnostico', 'SEXAGEM')
      .order('data_diagnostico', { ascending: false });

    if (sexagensData) {
      for (const sexagem of sexagensData) {
        let resumo = 'Sexagem: ';
        let sexagensDetalhadas: string[] = [];

        if (sexagem.observacoes) {
          const match = sexagem.observacoes.match(/SEXAGENS:([^|]+)/);
          if (match) {
            const sexagensArray = match[1].split(',').map(s => s.trim()).filter(s => s);
            sexagensDetalhadas = sexagensArray.map(s => {
              const map: Record<string, string> = {
                'FEMEA': 'Fêmea', 'MACHO': 'Macho', 'SEM_SEXO': 'Sem Sexo', 'VAZIA': 'Vazia'
              };
              return map[s] || s;
            });
          }
        }

        if (sexagensDetalhadas.length === 0 && sexagem.sexagem) {
          const map: Record<string, string> = { 'FEMEA': 'Fêmea', 'MACHO': 'Macho' };
          sexagensDetalhadas.push(map[sexagem.sexagem] || sexagem.sexagem);
        }

        if (sexagensDetalhadas.length > 0) {
          if (sexagensDetalhadas.length === 1) {
            resumo += sexagensDetalhadas[0];
          } else if (sexagensDetalhadas.length === 2) {
            if (sexagensDetalhadas[0] === sexagensDetalhadas[1]) {
              resumo += `2 ${sexagensDetalhadas[0]}s`;
            } else {
              resumo += `${sexagensDetalhadas[0]} e ${sexagensDetalhadas[1]}`;
            }
          } else {
            resumo += sexagensDetalhadas.join(', ');
          }

          if (sexagem.numero_gestacoes && sexagem.numero_gestacoes > 1) {
            resumo += ` (${sexagem.numero_gestacoes} gestações)`;
          }
        } else {
          if (sexagem.resultado === 'PRENHE') {
            resumo += 'PRENHE';
          } else if (sexagem.resultado === 'VAZIA') {
            resumo += 'VAZIA';
          } else {
            resumo += 'Resultado não disponível';
          }
        }

        items.push({ data: extractDateOnly(sexagem.data_diagnostico), tipo: 'SEXAGEM', resumo });
      }
    }

    // Carregar cio livre
    const { data: cioLivreData } = await supabase
      .from('receptoras_cio_livre')
      .select('data_cio, observacoes, ativa')
      .eq('receptora_id', targetReceptoraId)
      .order('data_cio', { ascending: false });

    if (cioLivreData && receptoraData?.status_cio_livre === 'CONFIRMADA') {
      const cio = cioLivreData[0];
      if (cio?.data_cio) {
        items.push({ data: extractDateOnly(cio.data_cio), tipo: 'CIO_LIVRE', resumo: 'Cio livre' });
      }
    }

    // Calcular estatísticas
    const stats: Estatisticas = {
      totalCiclos: 0,
      totalGestacoes: 0,
      ciclosDesdeUltimaGestacao: 0,
    };

    if (protocoloReceptoras) {
      stats.totalCiclos = protocoloReceptoras.length;

      let dataUltimaGestacao: string | null = null;
      if (diagnosticosData && diagnosticosData.length > 0) {
        const dgsOrdenados = [...diagnosticosData].sort((a, b) => {
          const dataA = extractDateOnly(a.data_diagnostico);
          const dataB = extractDateOnly(b.data_diagnostico);
          return dataB.localeCompare(dataA);
        });

        const ultimaGestacao = dgsOrdenados.find(dg =>
          dg.resultado === 'PRENHE' || dg.resultado === 'RETOQUE'
        );

        if (ultimaGestacao) {
          dataUltimaGestacao = extractDateOnly(ultimaGestacao.data_diagnostico);
        }
      }

      if (dataUltimaGestacao) {
        for (const pr of protocoloReceptoras) {
          const protocolo = Array.isArray(pr.protocolos_sincronizacao)
            ? pr.protocolos_sincronizacao[0]
            : pr.protocolos_sincronizacao;

          if (!protocolo) continue;

          const dataReferencia = protocolo.passo2_data || protocolo.data_inicio;
          if (!dataReferencia) continue;

          const dataRefNormalizada = extractDateOnly(dataReferencia);

          if (dataRefNormalizada > dataUltimaGestacao) {
            stats.ciclosDesdeUltimaGestacao++;
          }
        }
      } else {
        stats.ciclosDesdeUltimaGestacao = stats.totalCiclos;
      }
    }

    if (diagnosticosData) {
      const gestacoesUnicas = new Set<string>();
      diagnosticosData.forEach(dg => {
        if (dg.resultado === 'PRENHE' || dg.resultado === 'RETOQUE') {
          const chave = dg.data_te || dg.data_diagnostico;
          gestacoesUnicas.add(chave);
        }
      });
      stats.totalGestacoes = gestacoesUnicas.size;
    }

    // Ordenar históricos
    items.sort((a, b) => b.data.localeCompare(a.data));
    itemsAdmin.sort((a, b) => b.data.localeCompare(a.data));

    return { receptoraData, items, itemsAdmin, stats };
  }, []);

  const loadData = useCallback(async (receptoraId: string) => {
    try {
      setLoading(true);
      const result = await carregarHistoricoReceptora(receptoraId);
      setReceptora(result.receptoraData);
      setHistorico(result.items);
      setHistoricoAdmin(result.itemsAdmin);
      setEstatisticas(result.stats);
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
    loadData,
    setReceptora,
  };
}
