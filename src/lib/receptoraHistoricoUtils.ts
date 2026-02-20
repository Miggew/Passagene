/**
 * Utilitários para o histórico de receptoras
 */

import { Calendar, Syringe, Activity, Baby, MapPin, UserPlus, Tag } from 'lucide-react';

export interface HistoricoItem {
  data: string;
  tipo: 'CADASTRO' | 'MUDANCA_FAZENDA' | 'PROTOCOLO' | 'TE' | 'DG' | 'SEXAGEM' | 'CIO_LIVRE' | 'PARICAO';
  resumo: string;
  detalhes?: string;
}

export interface HistoricoAdmin {
  data: string;
  tipo: 'CADASTRO' | 'MUDANCA_FAZENDA';
  resumo: string;
}

export interface Estatisticas {
  totalCiclos: number;
  totalGestacoes: number;
  ciclosDesdeUltimaGestacao: number;
}

/**
 * Configuração de ícones por tipo de evento
 */
export const tipoIconConfig: Record<string, { icon: typeof Calendar; className: string }> = {
  'CADASTRO': { icon: UserPlus, className: 'w-4 h-4 text-indigo-600 dark:text-indigo-400' },
  'MUDANCA_FAZENDA': { icon: MapPin, className: 'w-4 h-4 text-orange-600 dark:text-orange-400' },
  'PROTOCOLO': { icon: Calendar, className: 'w-4 h-4 text-blue-600 dark:text-blue-400' },
  'TE': { icon: Syringe, className: 'w-4 h-4 text-emerald-600 dark:text-emerald-400' },
  'DG': { icon: Activity, className: 'w-4 h-4 text-purple-600 dark:text-purple-400' },
  'SEXAGEM': { icon: Baby, className: 'w-4 h-4 text-pink-600 dark:text-pink-400' },
  'PARICAO': { icon: Baby, className: 'w-4 h-4 text-teal-600 dark:text-teal-400' },
  'CIO_LIVRE': { icon: Tag, className: 'w-4 h-4 text-amber-600 dark:text-amber-400' },
};

/**
 * Configuração de badges por tipo de evento - Compatible com dark mode
 */
export const tipoBadgeConfig: Record<string, { label: string; className: string }> = {
  'CADASTRO': {
    label: 'Cadastro',
    className: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30'
  },
  'MUDANCA_FAZENDA': {
    label: 'Fazenda',
    className: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30'
  },
  'PROTOCOLO': {
    label: 'Protocolo',
    className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30'
  },
  'TE': {
    label: 'TE',
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
  },
  'DG': {
    label: 'DG',
    className: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30'
  },
  'SEXAGEM': {
    label: 'Sexagem',
    className: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/30'
  },
  'PARICAO': {
    label: 'Parição',
    className: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30'
  },
  'CIO_LIVRE': {
    label: 'Cio Livre',
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
  },
};

/**
 * Configuração de badges para status de cio livre - Compatible com dark mode
 */
export const cioLivreBadgeConfig: Record<string, { label: string; className: string }> = {
  'CONFIRMADA': {
    label: 'Confirmada',
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
  },
  'REJEITADA': {
    label: 'Rejeitada',
    className: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30'
  },
  'SUBSTITUIDA': {
    label: 'Substituída',
    className: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30'
  },
  'PENDENTE': {
    label: 'Pendente',
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
  },
};

/**
 * Retorna a configuração do badge de cio livre
 */
export const getCioLivreBadgeConfig = (status?: string | null) => {
  return cioLivreBadgeConfig[status || 'PENDENTE'] || cioLivreBadgeConfig['PENDENTE'];
};

import { supabase } from '@/lib/supabase';
import { SupabaseError } from '@/lib/types';
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

export interface CruzamentoAtual {
  doadora: string;
  touro: string;
}

export const carregarHistoricoReceptora = async (targetReceptoraId: string, customSupabaseClient?: any) => {
  const client = customSupabaseClient || supabase;
  const items: HistoricoItem[] = [];
  const itemsAdmin: HistoricoAdmin[] = [];

  // Carregar dados da receptora
  const { data: receptoraData, error: receptoraError } = await client
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
        cruzamento: null,
      };
    }
    throw receptoraError;
  }

  // Carregar histórico de fazendas
  const { data: historicoFazendas } = await client
    .from('receptora_fazenda_historico')
    .select('id, fazenda_id, data_inicio')
    .eq('receptora_id', targetReceptoraId)
    .order('data_inicio', { ascending: true });

  if (historicoFazendas && historicoFazendas.length > 0) {
    const primeiroRegistro = historicoFazendas[0];
    const { data: fazendaData } = await client
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

      const { data: fazendasData } = await client
        .from('fazendas')
        .select('id, nome')
        .in('id', [historicoAnterior.fazenda_id, historicoAtual.fazenda_id].filter(Boolean));

      const fazendasMap = new Map((fazendasData || []).map((f: any) => [f.id, f.nome]));
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
  const { data: protocoloReceptoras } = await client
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
  const { data: diagnosticosData } = await client
    .from('diagnosticos_gestacao')
    .select('*')
    .eq('receptora_id', targetReceptoraId)
    .eq('tipo_diagnostico', 'DG')
    .order('data_diagnostico', { ascending: false });

  // Carregar animais (parições)
  const { data: animaisData } = await client
    .from('animais')
    .select('id, data_nascimento, sexo')
    .eq('receptora_id', targetReceptoraId);

  if (animaisData && animaisData.length > 0) {
    animaisData.forEach((animal: any) => {
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
  const { data: tesData } = await client
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
    tesData.forEach((te: any) => {
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
      const { data: acasalamentosData, error: acasalamentosError } = await client
        .from('lote_fiv_acasalamentos')
        .select('id, aspiracao_doadora_id, dose_semen_id')
        .in('id', acasalamentoIdsArray);

      if (!acasalamentosError && acasalamentosData) {
        const aspiracaoIds = acasalamentosData.map((a: any) => a.aspiracao_doadora_id).filter(Boolean);
        const doseIds = acasalamentosData.map((a: any) => a.dose_semen_id).filter(Boolean);

        const doadorasMap = new Map<string, string>();
        if (aspiracaoIds.length > 0) {
          const { data: aspiracoesData } = await client
            .from('aspiracoes_doadoras')
            .select('id, doadora_id')
            .in('id', aspiracaoIds);

          if (aspiracoesData) {
            const doadoraIds = aspiracoesData.map((a: any) => a.doadora_id).filter(Boolean);
            if (doadoraIds.length > 0) {
              const { data: doadorasData } = await client
                .from('doadoras')
                .select('id, registro')
                .in('id', doadoraIds);

              if (doadorasData) {
                const doadorasRegistroMap = new Map(doadorasData.map((d: any) => [d.id, d.registro]));
                aspiracoesData.forEach((a: any) => {
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
          const { data: dosesData } = await client
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

        acasalamentosData.forEach((ac: any) => {
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

    tesData.forEach((te: any) => {
      const chave = te.data_te;
      if (!tesPorData.has(chave)) {
        tesPorData.set(chave, []);
      }
      tesPorData.get(chave)!.push(te);
    });

    tesPorData.forEach((tes: any[], dataTe: string) => {
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
  const { data: sexagensData } = await client
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
          const sexagensArray = match[1].split(',').map((s: string) => s.trim()).filter((s: string) => s);
          sexagensDetalhadas = sexagensArray.map((s: string) => {
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
  const { data: cioLivreData } = await client
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
      const dgsOrdenados = [...diagnosticosData].sort((a: any, b: any) => {
        const dataA = extractDateOnly(a.data_diagnostico);
        const dataB = extractDateOnly(b.data_diagnostico);
        return dataB.localeCompare(dataA);
      });

      const ultimaGestacao = dgsOrdenados.find((dg: any) =>
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
    diagnosticosData.forEach((dg: any) => {
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

  // Extrair cruzamento atual se prenhe
  let cruzamento: CruzamentoAtual | null = null;
  if (receptoraData?.status_reprodutivo?.includes('PRENHE') && tesData && tesData.length > 0) {
    // Pegar a transferência mais recente
    const teRecente = tesData[0]; // já ordenado por data_te DESC
    const embriao = Array.isArray(teRecente.embrioes) ? teRecente.embrioes[0] : teRecente.embrioes;
    if (embriao?.lote_fiv_acasalamento_id) {
      const acInfo = acasalamentosMap.get(embriao.lote_fiv_acasalamento_id);
      if (acInfo) {
        cruzamento = { doadora: acInfo.doadora, touro: acInfo.touro };
      }
    }
  }

  return { receptoraData, items, itemsAdmin, stats, cruzamento };
};
