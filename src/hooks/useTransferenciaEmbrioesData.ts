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

interface UseTransferenciaEmbrioesDataProps {
  dataPasso2: string;
  incluirCioLivre: boolean;
  origemEmbriao: 'PACOTE' | 'CONGELADO';
  filtroClienteId: string;
  filtroRaca: string;
  formData: TransferenciaFormData;
  setFormData: React.Dispatch<React.SetStateAction<TransferenciaFormData>>;
  camposPacote: CamposPacote;
  setCamposPacote: React.Dispatch<React.SetStateAction<CamposPacote>>;
  setOrigemEmbriao: React.Dispatch<React.SetStateAction<'PACOTE' | 'CONGELADO'>>;
  setFiltroClienteId: React.Dispatch<React.SetStateAction<string>>;
  setFiltroRaca: React.Dispatch<React.SetStateAction<string>>;
  setDataPasso2: React.Dispatch<React.SetStateAction<string>>;
  setIncluirCioLivre: React.Dispatch<React.SetStateAction<boolean>>;
}

const AUTO_RESTORE_SESSAO = true;

export function useTransferenciaEmbrioesData({
  dataPasso2,
  incluirCioLivre,
  origemEmbriao,
  filtroClienteId,
  filtroRaca,
  formData,
  setFormData,
  camposPacote,
  setCamposPacote,
  setOrigemEmbriao,
  setFiltroClienteId,
  setFiltroRaca,
  setDataPasso2,
  setIncluirCioLivre,
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
      fazenda_id: estadoSessao.fazenda_id,
      pacote_id: pacoteIdLimpo,
      data_passo2: estadoSessao.data_passo2 || null,
      data_te: estadoSessao.data_te || null,
      veterinario_responsavel: estadoSessao.veterinario_responsavel || null,
      tecnico_responsavel: estadoSessao.tecnico_responsavel || null,
      origem_embriao: estadoSessao.origem_embriao || null,
      filtro_cliente_id: estadoSessao.filtro_cliente_id || null,
      filtro_raca: estadoSessao.filtro_raca || null,
      incluir_cio_livre: !!estadoSessao.incluir_cio_livre,
      transferencias_ids: estadoSessao.transferenciasIdsSessao || [],
      protocolo_receptora_ids: estadoSessao.transferenciasSessao || [],
      status: 'ABERTA',
      updated_at: new Date().toISOString(),
    };

    await supabase
      .from('transferencias_sessoes')
      .upsert(payload, { onConflict: 'fazenda_id,status' });
  }, []);

  // Encerrar sessão no banco
  const encerrarSessaoNoBanco = useCallback(async (fazendaId?: string) => {
    if (!fazendaId) return;
    await supabase
      .from('transferencias_sessoes')
      .update({ status: 'ENCERRADA', updated_at: new Date().toISOString() })
      .eq('fazenda_id', fazendaId)
      .eq('status', 'ABERTA');
  }, []);

  // Aplicar sessão persistida
  const aplicarSessaoPersistida = useCallback((sessao: SessaoPersistida) => {
    const transferenciasIds = Array.isArray(sessao?.transferencias_ids)
      ? sessao.transferencias_ids
      : [];
    const protocoloReceptoraIds = Array.isArray(sessao?.protocolo_receptora_ids)
      ? sessao.protocolo_receptora_ids
      : [];
    const origem = sessao?.origem_embriao === 'CONGELADO' ? 'CONGELADO' : 'PACOTE';
    const dataTe = sessao?.data_te || new Date().toISOString().split('T')[0];

    setTransferenciasIdsSessao(transferenciasIds);
    setTransferenciasSessao(protocoloReceptoraIds);
    setOrigemEmbriao(origem);
    setFiltroClienteId(sessao?.filtro_cliente_id || '');
    setFiltroRaca(sessao?.filtro_raca || '');
    setDataPasso2(sessao?.data_passo2 || new Date().toISOString().split('T')[0]);
    setIncluirCioLivre(!!sessao?.incluir_cio_livre);
    setCamposPacote({
      data_te: dataTe,
      veterinario_responsavel: sessao?.veterinario_responsavel || '',
      tecnico_responsavel: sessao?.tecnico_responsavel || '',
    });
    setFormData((prev) => ({
      ...prev,
      fazenda_id: sessao?.fazenda_id || '',
      pacote_id: sessao?.pacote_id || '',
      protocolo_id: sessao?.protocolo_id || '',
      embriao_id: '',
      receptora_id: '',
      protocolo_receptora_id: '',
      data_te: dataTe,
      veterinario_responsavel: sessao?.veterinario_responsavel || '',
      tecnico_responsavel: sessao?.tecnico_responsavel || '',
      observacoes: '',
    }));
  }, [setOrigemEmbriao, setFiltroClienteId, setFiltroRaca, setDataPasso2, setIncluirCioLivre, setCamposPacote, setFormData]);

  // Restaurar sessão em andamento
  const restaurarSessaoEmAndamento = useCallback(async () => {
    try {
      if (!AUTO_RESTORE_SESSAO) return false;

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

        if (protocoloReceptoraIds.length === 0 && transferenciasIds.length > 0) {
          const { data: transferenciasSessaoData } = await supabase
            .from('transferencias_embrioes')
            .select('protocolo_receptora_id')
            .in('id', transferenciasIds);
          if (transferenciasSessaoData) {
            protocoloReceptoraIds = [...new Set(
              transferenciasSessaoData
                .map(t => t.protocolo_receptora_id)
                .filter((id): id is string => !!id)
            )];
          }
        }

        let temProtocolosAtivos = false;
        if (protocoloReceptoraIds.length > 0) {
          const { data: protocolosData } = await supabase
            .from('protocolo_receptoras')
            .select('id, status')
            .in('id', protocoloReceptoraIds);
          if (protocolosData) {
            temProtocolosAtivos = protocolosData.some(p => p.status !== 'UTILIZADA');
          }
        }

        if (!temProtocolosAtivos) {
          await supabase
            .from('transferencias_sessoes')
            .update({ status: 'ENCERRADA', updated_at: new Date().toISOString() })
            .eq('id', sessao.id);
          return false;
        }

        aplicarSessaoPersistida(sessao);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [aplicarSessaoPersistida]);

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
  const loadFazendas = useCallback(async () => {
    try {
      let protocolosQuery = supabase
        .from('protocolos_sincronizacao')
        .select('id');
      if (dataPasso2) {
        protocolosQuery = protocolosQuery.eq('passo2_data', dataPasso2);
      }
      const { data: protocolosData, error: protocolosError } = await protocolosQuery;
      if (protocolosError) throw protocolosError;

      const protocoloIds = [...new Set((protocolosData || []).map(p => p.id).filter(Boolean))];
      if (protocoloIds.length === 0) {
        setFazendas([]);
        setLoading(false);
        return;
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
        return;
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
        return;
      }

      const { data: fazendasData, error: fazendasError } = await supabase
        .from('fazendas')
        .select('id, nome')
        .in('id', fazendaIds)
        .order('nome', { ascending: true });
      if (fazendasError) throw fazendasError;

      setFazendas(fazendasData || []);
      setLoading(false);
    } catch (error) {
      toast({
        title: 'Erro ao carregar fazendas',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      setLoading(false);
    }
  }, [dataPasso2, toast]);

  // Carregar pacotes de embriões
  const loadPacotes = useCallback(async () => {
    try {
      const hojeLocal = getTodayDateString();
      const hojeUtc = new Date().toISOString().slice(0, 10);

      const deveDescartar = hojeLocal === hojeUtc;
      if (deveDescartar) {
        await supabase.rpc('descartar_embrioes_d9');
      }

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
        return;
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
    } catch (error) {
      toast({
        title: 'Erro ao carregar pacotes de embriões',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      setPacotes([]);
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
  const carregarReceptorasCioLivre = useCallback(async (fazendaId: string): Promise<{ receptoras: ReceptoraSincronizada[]; receptorasDisponiveis: number }> => {
    try {
      const { data: cioLivreData, error: cioLivreError } = await supabase
        .from('cio_livre')
        .select('receptora_id, data_cio')
        .eq('status', 'DISPONIVEL')
        .eq('fazenda_id', fazendaId);

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
        title: 'Erro ao carregar receptoras',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      return { receptoras: [], receptorasDisponiveis: 0 };
    }
  }, [toast]);

  // Carregar receptoras da fazenda
  const carregarReceptorasDaFazenda = useCallback(async (
    fazendaId: string,
    sessaoOverride?: { contagem: Record<string, number>; info: Record<string, ReceptoraSincronizada> }
  ) => {
    const contagemAtual = sessaoOverride?.contagem ?? contagemSessaoPorReceptora;
    const infoAtual = sessaoOverride?.info ?? receptorasSessaoInfo;

    try {
      let protocolosQuery = supabase.from('protocolos_sincronizacao').select('id');
      if (dataPasso2) {
        protocolosQuery = protocolosQuery.eq('passo2_data', dataPasso2);
      }
      const { data: protocolosData, error: protocolosError } = await protocolosQuery;
      if (protocolosError) throw protocolosError;

      const protocoloIds = [...new Set((protocolosData || []).map(p => p.id).filter(Boolean))];
      if (protocoloIds.length === 0) {
        setReceptoras([]);
        return { receptorasDisponiveis: 0 };
      }

      const { data: statusViewData, error: statusViewError } = await supabase
        .from('v_protocolo_receptoras_status')
        .select('receptora_id, brinco, data_te_prevista, data_limite_te, protocolo_id')
        .eq('fase_ciclo', 'SINCRONIZADA')
        .in('protocolo_id', protocoloIds);
      if (statusViewError && statusViewError.code !== 'PGRST205') throw statusViewError;

      const statusViewSafe = statusViewData || [];
      const receptoraIds = [...new Set(statusViewSafe.map(s => s.receptora_id).filter(Boolean))];
      if (receptoraIds.length === 0) {
        setReceptoras([]);
        return { receptorasDisponiveis: 0 };
      }

      const { data: viewData, error: viewError } = await supabase
        .from('vw_receptoras_fazenda_atual')
        .select('receptora_id')
        .in('receptora_id', receptoraIds)
        .eq('fazenda_id_atual', fazendaId);
      if (viewError) throw viewError;

      const receptoraIdsNaFazenda = new Set((viewData || []).map(v => v.receptora_id).filter(Boolean));
      const statusFiltrado = statusViewSafe.filter(s => receptoraIdsNaFazenda.has(s.receptora_id));
      const receptoraIdsFiltradas = [...new Set(statusFiltrado.map(s => s.receptora_id).filter(Boolean))];

      if (receptoraIdsFiltradas.length === 0) {
        setReceptoras([]);
        return { receptorasDisponiveis: 0 };
      }

      const { data: receptorasStatusData, error: receptorasStatusError } = await supabase
        .from('receptoras')
        .select('id, identificacao, status_reprodutivo')
        .in('id', receptoraIdsFiltradas);
      if (receptorasStatusError) throw receptorasStatusError;

      const receptoraInfoMap = new Map((receptorasStatusData || []).map(r => [r.id, r]));

      const protocoloIdsView = [...new Set(statusFiltrado.map(s => s.protocolo_id).filter(Boolean))];
      let prData: Array<{ id: string; receptora_id: string; protocolo_id: string; status: string; ciclando_classificacao?: 'N' | 'CL' | null; qualidade_semaforo?: 1 | 2 | 3 | null }> = [];
      if (protocoloIdsView.length > 0) {
        const { data: prDataRaw, error: prError } = await supabase
          .from('protocolo_receptoras')
          .select('id, receptora_id, protocolo_id, status, ciclando_classificacao, qualidade_semaforo')
          .in('protocolo_id', protocoloIdsView)
          .neq('status', 'INAPTA')
          .neq('status', 'UTILIZADA');
        if (prError && prError.code !== 'PGRST205') throw prError;
        prData = prDataRaw || [];
      }

      const prMap = new Map(prData.map(pr => [pr.receptora_id, pr]));

      const receptorasProtocolo: ReceptoraSincronizada[] = statusFiltrado
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
            origem: 'PROTOCOLO' as const,
            status_reprodutivo: info?.status_reprodutivo,
          };
        })
        .filter(r => r.status_reprodutivo === 'SINCRONIZADA' || contagemAtual[r.receptora_id] > 0);

      let receptorasFinal = receptorasProtocolo;

      if (incluirCioLivre) {
        const { receptoras: receptorasCioLivre } = await carregarReceptorasCioLivre(fazendaId);
        receptorasFinal = [...receptorasFinal, ...receptorasCioLivre];
      }

      const receptorasSessao = Object.values(infoAtual).filter(r => (contagemAtual[r.receptora_id] || 0) >= 1);
      const existentes = new Set(receptorasFinal.map(r => r.receptora_id));
      receptorasSessao.forEach(r => {
        if (!existentes.has(r.receptora_id)) {
          receptorasFinal.push({ ...r, quantidade_embrioes: contagemAtual[r.receptora_id] || 0 });
        }
      });

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
  }, [dataPasso2, incluirCioLivre, contagemSessaoPorReceptora, receptorasSessaoInfo, carregarReceptorasCioLivre, toast]);

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
    aplicarSessaoPersistida,
  };
}
