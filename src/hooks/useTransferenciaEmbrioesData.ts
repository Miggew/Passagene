/**
 * Hook para gerenciar o carregamento de dados de Transferência de Embriões
 * Extraído de TransferenciaEmbrioes.tsx para melhor organização
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { getTodayDateString } from '@/lib/utils';
import {
  Fazenda,
  Cliente,
  PacoteEmbrioes,
  PacoteAspiracaoInfo,
  EmbrioCompleto,
  ReceptoraSincronizada,
  SessaoPersistida,
  SessaoTransferenciaStorage,
  TransferenciaFormData,
  CamposPacote,
  DoseComTouro,
  TransferenciaComReceptora,
} from '@/lib/types/transferenciaEmbrioes';

export interface UseTransferenciaEmbrioesDataProps {
  dataPasso2: string;
  filtroClienteId: string;
  filtroRaca: string;
  formData: TransferenciaFormData;
}

const AUTO_RESTORE_SESSAO = true;

export function useTransferenciaEmbrioesData({
  dataPasso2,
  filtroClienteId,
  filtroRaca,
  formData,
}: UseTransferenciaEmbrioesDataProps) {
  const { toast } = useToast();

  // Estados de dados
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [pacotes, setPacotes] = useState<PacoteEmbrioes[]>([]);
  const [pacotesFiltrados, setPacotesFiltrados] = useState<PacoteEmbrioes[]>([]);
  const [embrioesCongelados, setEmbrioesCongelados] = useState<EmbrioCompleto[]>([]);
  const [receptoras, setReceptoras] = useState<ReceptoraSincronizada[]>([]);

  // Estados de loading
  const [loading, setLoading] = useState(true);
  const [loadingCongelados, setLoadingCongelados] = useState(false);

  // Estados de sessão
  const [transferenciasSessao, setTransferenciasSessao] = useState<string[]>([]);
  const [transferenciasIdsSessao, setTransferenciasIdsSessao] = useState<string[]>([]);
  const [contagemSessaoPorReceptora, setContagemSessaoPorReceptora] = useState<Record<string, number>>({});
  const [receptorasSessaoInfo, setReceptorasSessaoInfo] = useState<Record<string, ReceptoraSincronizada>>({});

  // Salvar sessão no banco
  const salvarSessaoNoBanco = useCallback(async (estadoSessao: SessaoTransferenciaStorage) => {
    if (!estadoSessao.fazenda_id) return;
    const temTransferencias =
      (estadoSessao.transferenciasIdsSessao?.length || 0) > 0 ||
      (estadoSessao.transferenciasSessao?.length || 0) > 0;
    if (!temTransferencias) return;

    let pacoteIdLimpo: string | null = null;
    if (estadoSessao.pacote_id) {
      const possibleUuid = estadoSessao.pacote_id.substring(0, 36);
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(possibleUuid)) {
        pacoteIdLimpo = possibleUuid;
      }
    }

    const payload = {
      pacote_id: pacoteIdLimpo,
      data_passo2: estadoSessao.data_passo2 || null,
      data_te: estadoSessao.data_te || null,
      veterinario_responsavel: estadoSessao.veterinario_responsavel || null,
      tecnico_responsavel: estadoSessao.tecnico_responsavel || null,
      origem_embriao: estadoSessao.origem_embriao || null,
      filtro_cliente_id: estadoSessao.filtro_cliente_id || null,
      filtro_raca: estadoSessao.filtro_raca || null,
      transferencias_ids: estadoSessao.transferenciasIdsSessao || [],
      protocolo_receptora_ids: estadoSessao.transferenciasSessao || [],
      updated_at: new Date().toISOString(),
    };

    try {
      // Estratégia: sempre deletar sessões antigas e criar nova (evita conflito 409)
      // Deletar todas as sessões ABERTAS desta fazenda
      await supabase
        .from('transferencias_sessoes')
        .delete()
        .eq('fazenda_id', estadoSessao.fazenda_id)
        .eq('status', 'ABERTA');

      // Criar nova sessão
      await supabase
        .from('transferencias_sessoes')
        .insert({
          ...payload,
          fazenda_id: estadoSessao.fazenda_id,
          status: 'ABERTA',
        });
    } catch {
      // Ignorar erros silenciosamente - a sessão é apenas para conveniência
    }
  }, []);

  // Encerrar sessão no banco (deletar em vez de atualizar para evitar 409)
  const encerrarSessaoNoBanco = useCallback(async (fazendaId?: string) => {
    if (!fazendaId) return;
    try {
      await supabase
        .from('transferencias_sessoes')
        .delete()
        .eq('fazenda_id', fazendaId)
        .eq('status', 'ABERTA');
    } catch {
      // Ignorar erros silenciosamente
    }
  }, []);

  // Extrair dados de sessão persistida (retorna dados para serem aplicados externamente)
  const extrairDadosSessao = useCallback((sessao: SessaoPersistida) => {
    const transferenciasIds = Array.isArray(sessao?.transferencias_ids)
      ? sessao.transferencias_ids
      : [];
    const protocoloReceptoraIds = Array.isArray(sessao?.protocolo_receptora_ids)
      ? sessao.protocolo_receptora_ids
      : [];
    const origem = sessao?.origem_embriao === 'CONGELADO' ? 'CONGELADO' : 'PACOTE';
    const dataTe = sessao?.data_te || new Date().toISOString().split('T')[0];

    return {
      transferenciasIds,
      protocoloReceptoraIds,
      filtros: {
        origem_embriao: origem,
        filtro_cliente_id: sessao?.filtro_cliente_id || '',
        filtro_raca: sessao?.filtro_raca || '',
        data_passo2: sessao?.data_passo2 || new Date().toISOString().split('T')[0],
      },
      camposPacote: {
        data_te: dataTe,
        veterinario_responsavel: sessao?.veterinario_responsavel || '',
        tecnico_responsavel: sessao?.tecnico_responsavel || '',
      },
      formData: {
        fazenda_id: sessao?.fazenda_id || '',
        pacote_id: sessao?.pacote_id || '',
        protocolo_id: sessao?.protocolo_id || '',
        data_te: dataTe,
        veterinario_responsavel: sessao?.veterinario_responsavel || '',
        tecnico_responsavel: sessao?.tecnico_responsavel || '',
      },
    };
  }, []);

  // Aplicar dados da sessão internamente (para transferenciasIds e protocoloReceptoraIds)
  const aplicarDadosSessaoInternos = useCallback((dados: { transferenciasIds: string[]; protocoloReceptoraIds: string[] }) => {
    setTransferenciasIdsSessao(dados.transferenciasIds);
    setTransferenciasSessao(dados.protocoloReceptoraIds);
  }, []);

  // Restaurar sessão em andamento - retorna dados da sessão para aplicação externa
  const restaurarSessaoEmAndamento = useCallback(async () => {
    try {
      if (!AUTO_RESTORE_SESSAO) return null;

      const { data: sessoesData } = await supabase
        .from('transferencias_sessoes')
        .select('*')
        .eq('status', 'ABERTA')
        .order('updated_at', { ascending: false })
        .limit(1);

      if (sessoesData && sessoesData.length > 0) {
        const sessao = sessoesData[0];
        const transferenciasIds = Array.isArray(sessao?.transferencias_ids)
          ? sessao.transferencias_ids
          : [];
        let protocoloReceptoraIds = Array.isArray(sessao?.protocolo_receptora_ids)
          ? sessao.protocolo_receptora_ids
          : [];

        // Se não há transferências registradas, não há sessão para restaurar
        if (transferenciasIds.length === 0) {
          try {
            await supabase
              .from('transferencias_sessoes')
              .delete()
              .eq('id', sessao.id);
          } catch {
            // Ignorar erros silenciosamente
          }
          return null;
        }

        // Verificar se as transferências ainda existem e estão válidas
        const { data: transferenciasExistentes } = await supabase
          .from('transferencias_embrioes')
          .select('id, protocolo_receptora_id')
          .in('id', transferenciasIds);

        if (!transferenciasExistentes || transferenciasExistentes.length === 0) {
          // Transferências foram deletadas, limpar sessão
          try {
            await supabase
              .from('transferencias_sessoes')
              .delete()
              .eq('id', sessao.id);
          } catch {
            // Ignorar erros silenciosamente
          }
          return null;
        }

        // Atualizar protocoloReceptoraIds com os dados reais das transferências
        protocoloReceptoraIds = [...new Set(
          transferenciasExistentes
            .map(t => t.protocolo_receptora_id)
            .filter((id): id is string => !!id)
        )];

        // Sessão é válida se há transferências existentes
        // Não verificar status dos protocolos - a sessão pode ter receptoras
        // que já receberam embrião e ainda assim precisar ser restaurada
        // para que o usuário possa encerrar/visualizar o relatório

        // Extrair e retornar dados da sessão
        const dadosSessao = extrairDadosSessao(sessao);
        // Aplicar dados internos (IDs de transferência)
        aplicarDadosSessaoInternos({
          transferenciasIds: dadosSessao.transferenciasIds,
          protocoloReceptoraIds: dadosSessao.protocoloReceptoraIds,
        });
        return dadosSessao;
      }
      return null;
    } catch {
      return null;
    }
  }, [extrairDadosSessao, aplicarDadosSessaoInternos]);

  // Carregar clientes
  const loadClientes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome')
        .order('nome', { ascending: true });
      if (error) throw error;
      setClientes(data || []);
    } catch {
      setClientes([]);
    }
  }, []);

  // Carregar fazendas
  const loadFazendas = useCallback(async (dataPasso2Override?: string) => {
    const dataPasso2Efetivo = dataPasso2Override ?? dataPasso2;
    try {
      let protocolosQuery = supabase
        .from('protocolos_sincronizacao')
        .select('id');
      if (dataPasso2Efetivo) {
        protocolosQuery = protocolosQuery.eq('passo2_data', dataPasso2Efetivo);
      }
      const { data: protocolosData, error: protocolosError } = await protocolosQuery;
      if (protocolosError) throw protocolosError;

      const protocoloIds = [...new Set((protocolosData || []).map(p => p.id).filter(Boolean))];
      if (protocoloIds.length === 0) {
        setFazendas([]);
        setLoading(false);
        return [];
      }

      const { data: statusData, error: statusError } = await supabase
        .from('v_protocolo_receptoras_status')
        .select('receptora_id')
        .eq('fase_ciclo', 'SINCRONIZADA')
        .in('protocolo_id', protocoloIds);
      if (statusError) throw statusError;

      const receptoraIds = [...new Set((statusData || []).map(s => s.receptora_id).filter(Boolean))];
      if (receptoraIds.length === 0) {
        setFazendas([]);
        setLoading(false);
        return [];
      }

      const { data: viewData, error: viewError } = await supabase
        .from('vw_receptoras_fazenda_atual')
        .select('fazenda_id_atual')
        .in('receptora_id', receptoraIds);
      if (viewError) throw viewError;

      const fazendaIds = [...new Set((viewData || []).map(v => v.fazenda_id_atual).filter(Boolean))];
      if (fazendaIds.length === 0) {
        setFazendas([]);
        setLoading(false);
        return [];
      }

      const { data: fazendasData, error: fazendasError } = await supabase
        .from('fazendas')
        .select('id, nome')
        .in('id', fazendaIds)
        .order('nome', { ascending: true });
      if (fazendasError) throw fazendasError;

      setFazendas(fazendasData || []);
      setLoading(false);
      return fazendasData || [];
    } catch (error) {
      toast({
        title: 'Erro ao carregar fazendas',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      setLoading(false);
      return [];
    }
  }, [dataPasso2, toast]);

  // Carregar pacotes de embriões
  const loadPacotes = useCallback(async () => {
    try {
      // Nota: O descarte automático de embriões D9+ deve ser implementado via
      // cron job ou trigger no banco de dados, não via chamada do frontend

      const [transferenciasResult, frescosResult] = await Promise.all([
        supabase.from('transferencias_embrioes').select('embriao_id'),
        supabase.from('embrioes').select('*').eq('status_atual', 'FRESCO').order('created_at', { ascending: false }),
      ]);

      const embrioesTransferidosIds = transferenciasResult.data?.map(t => t.embriao_id) || [];

      if (frescosResult.error) throw frescosResult.error;

      const embrioesData = [...(frescosResult.data || [])]
        .filter(e => !embrioesTransferidosIds.includes(e.id) && e.status_atual !== 'TRANSFERIDO')
        .sort((a, b) => {
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          return dateB - dateA;
        });

      if (!embrioesData || embrioesData.length === 0) {
        setPacotes([]);
        return [];
      }

      const disponibilidadeIds = embrioesData.map(e => e.id);
      const loteFivIds = [...new Set(embrioesData.filter(e => e.lote_fiv_id).map(e => e.lote_fiv_id))] as string[];

      let pacotesAspiracaoMap = new Map<string, PacoteAspiracaoInfo>();
      let pacoteParaLoteMap = new Map<string, string>();
      let fazendasDestinoPorPacoteMap = new Map<string, string[]>();
      let fazendasMap = new Map<string, string>();

      const [disponibilidadeResult, fazendasResult, lotesFivResult] = await Promise.all([
        disponibilidadeIds.length > 0
          ? supabase.from('v_embrioes_disponiveis_te').select('embriao_id, d7_pronto, d8_limite').in('embriao_id', disponibilidadeIds)
          : Promise.resolve({ data: null, error: null }),
        supabase.from('fazendas').select('id, nome'),
        loteFivIds.length > 0
          ? supabase.from('lotes_fiv').select('id, pacote_aspiracao_id').in('id', loteFivIds)
          : Promise.resolve({ data: null, error: null }),
      ]);

      const disponibilidadeMap = new Map<string, { d7_pronto?: boolean; d8_limite?: boolean }>(
        (disponibilidadeResult.data || []).map(d => [d.embriao_id, { d7_pronto: d.d7_pronto, d8_limite: d.d8_limite }])
      );

      if (fazendasResult.data) {
        fazendasMap = new Map(fazendasResult.data.map(f => [f.id, f.nome]));
      }

      const lotesFivData = lotesFivResult.data;
      if (lotesFivData && lotesFivData.length > 0) {
        lotesFivData.forEach(lote => {
          if (lote.pacote_aspiracao_id) {
            pacoteParaLoteMap.set(lote.id, lote.pacote_aspiracao_id);
          }
        });

        const pacoteIds = [...new Set(lotesFivData.map(l => l.pacote_aspiracao_id).filter(Boolean))] as string[];

        if (pacoteIds.length > 0) {
          const [pacotesAspiracaoResult, fazendasDestinoResult] = await Promise.all([
            supabase.from('pacotes_aspiracao').select('*').in('id', pacoteIds),
            supabase.from('pacotes_aspiracao_fazendas_destino').select('pacote_aspiracao_id, fazenda_destino_id').in('pacote_aspiracao_id', pacoteIds),
          ]);

          const fazendasDestinoData = fazendasDestinoResult.data;
          if (fazendasDestinoData) {
            fazendasDestinoData.forEach(item => {
              const atual = fazendasDestinoPorPacoteMap.get(item.pacote_aspiracao_id) || [];
              if (!atual.includes(item.fazenda_destino_id)) {
                atual.push(item.fazenda_destino_id);
              }
              fazendasDestinoPorPacoteMap.set(item.pacote_aspiracao_id, atual);
            });
          }

          const pacotesData = pacotesAspiracaoResult.data;
          if (pacotesData) {
            pacotesData.forEach(pacote => {
              if (pacote.fazenda_destino_id) {
                const atual = fazendasDestinoPorPacoteMap.get(pacote.id) || [];
                if (!atual.includes(pacote.fazenda_destino_id)) {
                  atual.push(pacote.fazenda_destino_id);
                }
                fazendasDestinoPorPacoteMap.set(pacote.id, atual);
              }

              pacotesAspiracaoMap.set(pacote.id, {
                id: pacote.id,
                data_aspiracao: pacote.data_aspiracao,
                fazenda_nome: fazendasMap.get(pacote.fazenda_id),
                quantidade_doadoras: 0,
                horario_inicio: pacote.horario_inicio,
                veterinario_responsavel: pacote.veterinario_responsavel,
                total_oocitos: pacote.total_oocitos,
              });
            });
          }
        }
      }

      const acasalamentoIds = embrioesData.map(e => e.lote_fiv_acasalamento_id).filter((id): id is string => !!id);

      let acasalamentosMap = new Map();
      let dosesMap = new Map<string, string>();

      if (acasalamentoIds.length > 0) {
        const { data: acasalamentosData } = await supabase
          .from('lote_fiv_acasalamentos')
          .select('id, aspiracao_doadora_id, dose_semen_id')
          .in('id', acasalamentoIds);

        if (acasalamentosData) {
          acasalamentosMap = new Map(acasalamentosData.map(a => [a.id, a]));

          const aspiracaoIds = [...new Set(acasalamentosData.map(a => a.aspiracao_doadora_id).filter(Boolean))];
          const doseIds = [...new Set(acasalamentosData.map(a => a.dose_semen_id).filter(Boolean))];

          const [aspiracoesResult, dosesResult] = await Promise.all([
            aspiracaoIds.length > 0
              ? supabase.from('aspiracoes_doadoras').select('id, doadora_id').in('id', aspiracaoIds)
              : Promise.resolve({ data: null }),
            doseIds.length > 0
              ? supabase.from('doses_semen').select('id, touro_id, touro:touros(id, nome, registro, raca)').in('id', doseIds)
              : Promise.resolve({ data: null }),
          ]);

          const aspiracoesData = aspiracoesResult.data;
          const dosesData = dosesResult.data;

          if (dosesData) {
            dosesMap = new Map(
              dosesData.map(d => {
                const touroRaw = (d as DoseComTouro).touro;
                const touro = Array.isArray(touroRaw) ? touroRaw[0] : touroRaw;
                return [d.id, touro?.nome || 'Touro desconhecido'];
              })
            );

            acasalamentosData.forEach(ac => {
              if (ac.dose_semen_id) {
                const touroNome = dosesMap.get(ac.dose_semen_id);
                if (touroNome) {
                  const acasalamentoAtual = acasalamentosMap.get(ac.id);
                  acasalamentosMap.set(ac.id, { ...acasalamentoAtual, touro_nome: touroNome });
                }
              }
            });
          }

          if (aspiracoesData) {
            const doadoraIds = [...new Set(aspiracoesData.map(a => a.doadora_id))];
            if (doadoraIds.length > 0) {
              const { data: doadorasData } = await supabase.from('doadoras').select('id, registro').in('id', doadoraIds);

              if (doadorasData) {
                const doadorasMap = new Map(doadorasData.map(d => [d.id, d.registro]));
                const aspiracaoDoadoraMap = new Map(aspiracoesData.map(a => [a.id, a.doadora_id]));

                acasalamentosData.forEach(ac => {
                  if (ac.aspiracao_doadora_id) {
                    const doadoraId = aspiracaoDoadoraMap.get(ac.aspiracao_doadora_id);
                    if (doadoraId) {
                      const registro = doadorasMap.get(doadoraId);
                      if (registro) {
                        const acasalamentoAtual = acasalamentosMap.get(ac.id);
                        acasalamentosMap.set(ac.id, { ...acasalamentoAtual, doadora_registro: registro });
                      }
                    }
                  }
                });
              }
            }
          }
        }
      }

      const pacotesMap = new Map<string, PacoteEmbrioes>();

      embrioesData.forEach(embriao => {
        if (!embriao.lote_fiv_id || !embriao.created_at) return;

        const dataDespacho = embriao.created_at.split('T')[0];
        const chavePacote = `${embriao.lote_fiv_id}-${dataDespacho}`;

        let pacote = pacotesMap.get(chavePacote);
        if (!pacote) {
          const pacoteAspiracaoIdOriginal = pacoteParaLoteMap.get(embriao.lote_fiv_id);
          const pacoteInfo = pacoteAspiracaoIdOriginal ? pacotesAspiracaoMap.get(pacoteAspiracaoIdOriginal) : undefined;
          const fazendasDestinoIds = pacoteAspiracaoIdOriginal ? (fazendasDestinoPorPacoteMap.get(pacoteAspiracaoIdOriginal) || []) : [];
          const fazendasDestinoNomes = fazendasDestinoIds.map(id => fazendasMap.get(id)).filter((nome): nome is string => !!nome);

          pacote = {
            id: chavePacote,
            lote_fiv_id: embriao.lote_fiv_id,
            data_despacho: dataDespacho,
            fazendas_destino_ids: fazendasDestinoIds,
            fazendas_destino_nomes: fazendasDestinoNomes,
            pacote_info: pacoteInfo || { id: pacoteAspiracaoIdOriginal || '', data_aspiracao: dataDespacho, quantidade_doadoras: 0 },
            embrioes: [],
            total: 0,
            frescos: 0,
            congelados: 0,
          };
          pacotesMap.set(chavePacote, pacote);
        }

        const acasalamento = acasalamentosMap.get(embriao.lote_fiv_acasalamento_id || '');

        pacote.embrioes.push({
          ...embriao,
          doadora_registro: acasalamento?.doadora_registro,
          touro_nome: acasalamento?.touro_nome,
          d7_pronto: disponibilidadeMap.get(embriao.id)?.d7_pronto,
          d8_limite: disponibilidadeMap.get(embriao.id)?.d8_limite,
        });
        pacote.total++;

        if (embriao.status_atual === 'FRESCO') pacote.frescos++;
        if (embriao.status_atual === 'CONGELADO') pacote.congelados++;
      });

      const loteFivIdsParaPacotes = [...new Set(Array.from(pacotesMap.values()).map(p => p.lote_fiv_id))];
      const { data: lotesFivDisponibilidade } = await supabase
        .from('lotes_fiv')
        .select('id, disponivel_para_transferencia')
        .in('id', loteFivIdsParaPacotes);

      const lotesDisponiveisMap = new Map(
        lotesFivDisponibilidade?.map(l => [l.id, l.disponivel_para_transferencia === true]) || []
      );

      const pacotesComResumo = Array.from(pacotesMap.values()).map(pacote => {
        const semClassificacao = pacote.embrioes.filter(e => !e.classificacao || e.classificacao.trim() === '').length;
        return { pacote, semClassificacao, total: pacote.total, disponivel: lotesDisponiveisMap.get(pacote.lote_fiv_id) };
      });

      const pacotesArray = pacotesComResumo
        .filter(pacote => pacote.disponivel !== false && pacote.total > 0 && pacote.semClassificacao === 0)
        .map(item => item.pacote)
        .sort((a, b) => b.data_despacho.localeCompare(a.data_despacho));

      setPacotes(pacotesArray);
      return pacotesArray;
    } catch (error) {
      toast({
        title: 'Erro ao carregar pacotes de embriões',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      setPacotes([]);
      return [];
    }
  }, [toast]);

  // Carregar embriões congelados
  const loadEmbrioesCongelados = useCallback(async () => {
    const filtroRacaNormalizado = filtroRaca.trim().toLowerCase();
    if (!filtroClienteId && !filtroRacaNormalizado) {
      setEmbrioesCongelados([]);
      return;
    }

    try {
      setLoadingCongelados(true);

      let congeladosQuery = supabase
        .from('embrioes')
        .select('*')
        .eq('status_atual', 'CONGELADO')
        .not('cliente_id', 'is', null);

      if (filtroClienteId) {
        congeladosQuery = congeladosQuery.eq('cliente_id', filtroClienteId);
      }

      const [transferenciasResult, embrioesResult] = await Promise.all([
        supabase.from('transferencias_embrioes').select('embriao_id'),
        congeladosQuery.order('created_at', { ascending: false }),
      ]);

      if (transferenciasResult.error) throw transferenciasResult.error;
      if (embrioesResult.error) throw embrioesResult.error;

      const embrioesTransferidosIds = transferenciasResult.data?.map(t => t.embriao_id) || [];
      const embrioesFiltradosBase = (embrioesResult.data || [])
        .filter(e => !embrioesTransferidosIds.includes(e.id) && e.status_atual !== 'TRANSFERIDO');

      if (embrioesFiltradosBase.length === 0) {
        setEmbrioesCongelados([]);
        return;
      }

      // Enriquecer com dados de doadora e touro (simplificado)
      setEmbrioesCongelados(embrioesFiltradosBase);
    } catch (error) {
      toast({
        title: 'Erro ao carregar embriões congelados',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      setEmbrioesCongelados([]);
    } finally {
      setLoadingCongelados(false);
    }
  }, [filtroClienteId, filtroRaca, toast]);

  // Carregar receptoras de cio livre
  // Filtra por data_cio = dataCioFiltro (mesma lógica que passo2_data para protocolos)
  const carregarReceptorasCioLivre = useCallback(async (
    fazendaId: string,
    dataCioFiltro?: string
  ): Promise<{ receptoras: ReceptoraSincronizada[]; receptorasDisponiveis: number }> => {
    try {
      let query = supabase
        .from('receptoras_cio_livre')
        .select('receptora_id, data_cio')
        .eq('ativa', true)
        .eq('fazenda_id', fazendaId);

      // Filtrar por data_cio se fornecida (mesma lógica que passo2_data)
      if (dataCioFiltro) {
        query = query.eq('data_cio', dataCioFiltro);
      }

      const { data: cioLivreData, error: cioLivreError } = await query;

      if (cioLivreError && cioLivreError.code !== 'PGRST205') {
        throw cioLivreError;
      }

      const receptoraIdsCioLivre = (cioLivreData || []).map(c => c.receptora_id).filter((id): id is string => !!id);
      if (receptoraIdsCioLivre.length === 0) {
        return { receptoras: [], receptorasDisponiveis: 0 };
      }

      const { data: receptorasCioLivreInfo, error: receptorasError } = await supabase
        .from('receptoras')
        .select('id, identificacao, status_reprodutivo')
        .in('id', receptoraIdsCioLivre);
      if (receptorasError) throw receptorasError;

      const dataCioPorReceptora = new Map((cioLivreData || []).map(c => [c.receptora_id, c.data_cio]));

      // CIO LIVRE: a receptora aparece independente do status anterior
      // O status anterior (PRENHE, VAZIA, etc) é mantido até a TE confirmar o cio livre
      // Na TE, se receber embrião, o cio livre é confirmado e status vira SERVIDA
      // Se for descartada, o cio livre é cancelado e ela volta ao status anterior
      const receptorasBase = (receptorasCioLivreInfo || []).map(r => ({
        receptora_id: r.id,
        brinco: r.identificacao || 'N/A',
        identificacao: r.identificacao || '',
        protocolo_id: undefined,
        protocolo_receptora_id: undefined,
        data_te_prevista: undefined,
        data_limite_te: undefined,
        quantidade_embrioes: 0,
        ciclando_classificacao: undefined,
        qualidade_semaforo: undefined,
        origem: 'CIO_LIVRE' as const,
        data_cio: dataCioPorReceptora.get(r.id),
        status_reprodutivo: r.status_reprodutivo,
      }));

      return { receptoras: receptorasBase, receptorasDisponiveis: receptorasBase.length };
    } catch (error) {
      toast({
        title: 'Erro ao carregar receptoras CIO LIVRE',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      return { receptoras: [], receptorasDisponiveis: 0 };
    }
  }, [toast]);

  // Carregar receptoras da fazenda (protocolo + CIO LIVRE unificados)
  // Ambos são filtrados pela mesma data (passo2_data = data_cio)
  const carregarReceptorasDaFazenda = useCallback(async (
    fazendaId: string,
    sessaoOverride?: { contagem: Record<string, number>; info: Record<string, ReceptoraSincronizada> }
  ) => {
    const contagemAtual = sessaoOverride?.contagem ?? contagemSessaoPorReceptora;
    const infoAtual = sessaoOverride?.info ?? receptorasSessaoInfo;

    try {
      let receptorasProtocolo: ReceptoraSincronizada[] = [];

      // 1. Carregar receptoras de PROTOCOLO (se houver protocolos com passo2_data)
      let protocolosQuery = supabase.from('protocolos_sincronizacao').select('id');
      if (dataPasso2) {
        protocolosQuery = protocolosQuery.eq('passo2_data', dataPasso2);
      }
      const { data: protocolosData, error: protocolosError } = await protocolosQuery;
      if (protocolosError) throw protocolosError;

      const protocoloIds = [...new Set((protocolosData || []).map(p => p.id).filter(Boolean))];

      // Carregar receptoras de protocolo se houver protocolos
      if (protocoloIds.length > 0) {
        const { data: statusViewData, error: statusViewError } = await supabase
          .from('v_protocolo_receptoras_status')
          .select('receptora_id, brinco, data_te_prevista, data_limite_te, protocolo_id')
          .eq('fase_ciclo', 'SINCRONIZADA')
          .in('protocolo_id', protocoloIds);
        if (statusViewError && statusViewError.code !== 'PGRST205') throw statusViewError;

        const statusViewSafe = statusViewData || [];
        const receptoraIds = [...new Set(statusViewSafe.map(s => s.receptora_id).filter(Boolean))];

        if (receptoraIds.length > 0) {
          const { data: viewData, error: viewError } = await supabase
            .from('vw_receptoras_fazenda_atual')
            .select('receptora_id')
            .in('receptora_id', receptoraIds)
            .eq('fazenda_id_atual', fazendaId);
          if (viewError) throw viewError;

          const receptoraIdsNaFazenda = new Set((viewData || []).map(v => v.receptora_id).filter(Boolean));
          const statusFiltrado = statusViewSafe.filter(s => receptoraIdsNaFazenda.has(s.receptora_id));
          const receptoraIdsFiltradas = [...new Set(statusFiltrado.map(s => s.receptora_id).filter(Boolean))];

          if (receptoraIdsFiltradas.length > 0) {
            const { data: receptorasStatusData, error: receptorasStatusError } = await supabase
              .from('receptoras')
              .select('id, identificacao, status_reprodutivo')
              .in('id', receptoraIdsFiltradas);
            if (receptorasStatusError) throw receptorasStatusError;

            const receptoraInfoMap = new Map((receptorasStatusData || []).map(r => [r.id, r]));

            const protocoloIdsView = [...new Set(statusFiltrado.map(s => s.protocolo_id).filter(Boolean))];
            let prData: Array<{ id: string; receptora_id: string; protocolo_id: string; status: string; ciclando_classificacao?: 'N' | 'CL' | null; qualidade_semaforo?: 1 | 2 | 3 | null; observacoes?: string | null }> = [];
            if (protocoloIdsView.length > 0) {
              const { data: prDataRaw, error: prError } = await supabase
                .from('protocolo_receptoras')
                .select('id, receptora_id, protocolo_id, status, ciclando_classificacao, qualidade_semaforo, observacoes')
                .in('protocolo_id', protocoloIdsView)
                .neq('status', 'INAPTA')
                .neq('status', 'UTILIZADA');
              if (prError && prError.code !== 'PGRST205') throw prError;
              prData = prDataRaw || [];
            }

            const prMap = new Map(prData.map(pr => [pr.receptora_id, pr]));

            receptorasProtocolo = statusFiltrado
              .map(viewInfo => {
                const info = receptoraInfoMap.get(viewInfo.receptora_id);
                const pr = prMap.get(viewInfo.receptora_id);
                const quantidadeSessao = contagemAtual[viewInfo.receptora_id] || 0;
                return {
                  receptora_id: viewInfo.receptora_id,
                  brinco: viewInfo.brinco || info?.identificacao || 'N/A',
                  identificacao: info?.identificacao || '',
                  protocolo_id: pr?.protocolo_id || viewInfo.protocolo_id,
                  protocolo_receptora_id: pr?.id || '',
                  data_te_prevista: viewInfo.data_te_prevista,
                  data_limite_te: viewInfo.data_limite_te,
                  quantidade_embrioes: quantidadeSessao,
                  ciclando_classificacao: pr?.ciclando_classificacao ?? null,
                  qualidade_semaforo: pr?.qualidade_semaforo ?? null,
                  observacoes: pr?.observacoes ?? null,
                  origem: 'PROTOCOLO' as const,
                  status_reprodutivo: info?.status_reprodutivo,
                };
              })
              .filter(r => r.status_reprodutivo === 'SINCRONIZADA' || contagemAtual[r.receptora_id] > 0);
          }
        }
      }

      // 2. SEMPRE carregar receptoras CIO LIVRE com filtro de data (data_cio = dataPasso2)
      const { receptoras: receptorasCioLivre } = await carregarReceptorasCioLivre(fazendaId, dataPasso2);

      // 3. Mesclar ambas as listas
      let receptorasFinal = [...receptorasProtocolo, ...receptorasCioLivre];

      // 4. Adicionar receptoras da sessão atual que não estão na lista
      const receptorasSessao = Object.values(infoAtual).filter(r => (contagemAtual[r.receptora_id] || 0) >= 1);
      const existentes = new Set(receptorasFinal.map(r => r.receptora_id));
      receptorasSessao.forEach(r => {
        if (!existentes.has(r.receptora_id)) {
          receptorasFinal.push({ ...r, quantidade_embrioes: contagemAtual[r.receptora_id] || 0 });
        }
      });

      // 5. Atualizar contagem de embriões para todas
      receptorasFinal = receptorasFinal.map(r => ({ ...r, quantidade_embrioes: contagemAtual[r.receptora_id] || 0 }));

      setReceptoras(receptorasFinal);
      return { receptorasDisponiveis: receptorasFinal.length };
    } catch (error) {
      toast({
        title: 'Erro ao carregar receptoras',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      setReceptoras([]);
      return { receptorasDisponiveis: 0 };
    }
  }, [dataPasso2, contagemSessaoPorReceptora, receptorasSessaoInfo, carregarReceptorasCioLivre, toast]);

  // Recarregar receptoras
  const recarregarReceptoras = useCallback(async (
    fazendaId: string,
    sessaoOverride?: { contagem: Record<string, number>; info: Record<string, ReceptoraSincronizada> }
  ) => {
    await carregarReceptorasDaFazenda(fazendaId, sessaoOverride);
  }, [carregarReceptorasDaFazenda]);

  // Efeito para filtrar pacotes por fazenda
  useEffect(() => {
    if (formData.fazenda_id) {
      const filtrados = pacotes.filter(pacote => pacote.fazendas_destino_ids.includes(formData.fazenda_id));
      setPacotesFiltrados(filtrados);
    } else {
      setPacotesFiltrados([]);
    }
  }, [formData.fazenda_id, pacotes]);

  // Efeito para carregar contagem da sessão
  useEffect(() => {
    const carregarContagemSessao = async () => {
      if (transferenciasIdsSessao.length === 0) {
        setContagemSessaoPorReceptora({});
        setReceptorasSessaoInfo({});
        return;
      }
      const { data, error } = await supabase
        .from('transferencias_embrioes')
        .select('id, receptora_id, protocolo_receptora_id, receptoras(id, identificacao, status_reprodutivo)')
        .in('id', transferenciasIdsSessao);
      if (error) return;

      const contagem: Record<string, number> = {};
      const info: Record<string, ReceptoraSincronizada> = {};
      (data || []).forEach((item: TransferenciaComReceptora) => {
        if (!item.receptora_id) return;
        contagem[item.receptora_id] = (contagem[item.receptora_id] || 0) + 1;
        const receptora = Array.isArray(item.receptoras) ? item.receptoras[0] : item.receptoras;
        info[item.receptora_id] = {
          receptora_id: item.receptora_id,
          brinco: receptora?.identificacao || 'N/A',
          identificacao: receptora?.identificacao || '',
          protocolo_id: undefined,
          protocolo_receptora_id: item.protocolo_receptora_id || '',
          quantidade_embrioes: contagem[item.receptora_id],
          origem: item.protocolo_receptora_id ? 'PROTOCOLO' : 'CIO_LIVRE',
          status_reprodutivo: receptora?.status_reprodutivo || 'SERVIDA',
        };
      });
      setContagemSessaoPorReceptora(contagem);
      setReceptorasSessaoInfo(info);
    };
    void carregarContagemSessao();
  }, [transferenciasIdsSessao]);

  return {
    // Estados de dados
    fazendas,
    clientes,
    pacotes,
    pacotesFiltrados,
    embrioesCongelados,
    receptoras,
    setReceptoras,

    // Estados de loading
    loading,
    loadingCongelados,

    // Estados de sessão
    transferenciasSessao,
    setTransferenciasSessao,
    transferenciasIdsSessao,
    setTransferenciasIdsSessao,
    contagemSessaoPorReceptora,
    setContagemSessaoPorReceptora,
    receptorasSessaoInfo,
    setReceptorasSessaoInfo,

    // Funções de carregamento
    loadFazendas,
    loadPacotes,
    loadClientes,
    loadEmbrioesCongelados,
    carregarReceptorasDaFazenda,
    recarregarReceptoras,

    // Funções de sessão
    salvarSessaoNoBanco,
    encerrarSessaoNoBanco,
    restaurarSessaoEmAndamento,
  };
}

export type UseTransferenciaEmbrioesDataReturn = ReturnType<typeof useTransferenciaEmbrioesData>;
