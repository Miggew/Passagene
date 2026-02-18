import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { todayISO } from '@/lib/dateUtils';
import { useFazendasComLotes, useLotesTE } from '@/hooks/loteTE';
import type { LoteTEDiagnostico, LoteFormDataBase } from '@/lib/gestacao';
import type { ReceptoraServida, DiagnosticoFormData } from '@/lib/types/diagnostico';
import type { EmbriaoQuery, DiagnosticoGestacaoInsert, DiagnosticoGestacaoUpdate } from '@/lib/types';
import { buscarDadosGenealogia, extrairAcasalamentoIds, calcularDiasGestacao } from '@/lib/dataEnrichment';
import { validarResponsaveis, calcularDataProvavelParto, DIAS_MINIMOS } from '@/lib/gestacao';
import { validarTransicaoStatus } from '@/lib/receptoraStatus';
import type { EmbriaoTransferido } from '@/lib/gestacao';

// Configuração de rascunho
const RASCUNHO_KEY = 'passagene_dg_rascunho';
const RASCUNHO_EXPIRACAO_HORAS = 24;

interface RascunhoDG {
    fazenda_id: string;
    lote_id: string;
    lote_data_te: string;
    formData: DiagnosticoFormData;
    loteFormData: LoteFormDataBase;
    timestamp: number;
}

export function useDiagnosticoGestacao() {
    const { toast } = useToast();
    const hoje = todayISO();

    // State
    const [fazendaSelecionada, setFazendaSelecionada] = useState<string>('');
    const [loteSelecionado, setLoteSelecionado] = useState<LoteTEDiagnostico | null>(null);
    const [receptoras, setReceptoras] = useState<ReceptoraServida[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState<DiagnosticoFormData>({});
    const [loteFormData, setLoteFormData] = useState<LoteFormDataBase>({
        veterinario_responsavel: '',
        tecnico_responsavel: '',
    });
    const [showRestaurarDialog, setShowRestaurarDialog] = useState(false);

    // Hooks compartilhados
    const { fazendas, loadFazendas } = useFazendasComLotes({
        statusReceptoraFiltro: 'SERVIDA',
    });

    const transformLote = useCallback((
        loteBase: { id: string; fazenda_id: string; fazenda_nome: string; data_te: string; quantidade_receptoras: number; status: 'ABERTO' | 'FECHADO' },
        diagnosticoLote: { veterinario_responsavel?: string; tecnico_responsavel?: string } | undefined
    ): LoteTEDiagnostico => ({
        ...loteBase,
        veterinario_dg: diagnosticoLote?.veterinario_responsavel,
        tecnico_dg: diagnosticoLote?.tecnico_responsavel,
    }), []);

    const { lotesTE, loading: loadingLotes, loadLotesTE } = useLotesTE<LoteTEDiagnostico>({
        statusReceptoraFiltro: 'SERVIDA',
        transformLote,
    });

    // ========== RASCUNHO ==========
    const getRascunho = (): RascunhoDG | null => {
        try {
            const raw = localStorage.getItem(RASCUNHO_KEY);
            if (!raw) return null;
            const rascunho: RascunhoDG = JSON.parse(raw);
            const horasPassadas = (Date.now() - rascunho.timestamp) / (1000 * 60 * 60);
            if (horasPassadas > RASCUNHO_EXPIRACAO_HORAS) {
                localStorage.removeItem(RASCUNHO_KEY);
                return null;
            }
            return Object.keys(rascunho.formData).length > 0 ? rascunho : null;
        } catch {
            return null;
        }
    };

    const salvarRascunho = useCallback(() => {
        if (!loteSelecionado || Object.keys(formData).length === 0) return;
        const temDadosPreenchidos = Object.values(formData).some(
            dados => dados.resultado || dados.numero_gestacoes || dados.observacoes
        );
        if (!temDadosPreenchidos) return;

        const rascunho: RascunhoDG = {
            fazenda_id: fazendaSelecionada,
            lote_id: loteSelecionado.id,
            lote_data_te: loteSelecionado.data_te,
            formData,
            loteFormData,
            timestamp: Date.now(),
        };
        localStorage.setItem(RASCUNHO_KEY, JSON.stringify(rascunho));
    }, [fazendaSelecionada, loteSelecionado, formData, loteFormData]);

    const limparRascunho = () => {
        localStorage.removeItem(RASCUNHO_KEY);
    };

    const restaurarRascunho = async () => {
        const rascunho = getRascunho();
        if (rascunho) {
            setFazendaSelecionada(rascunho.fazenda_id);
            setLoteFormData(rascunho.loteFormData);
            sessionStorage.setItem('dg_formdata_restore', JSON.stringify(rascunho.formData));
            toast({
                title: 'Sessão restaurada',
                description: 'Continuando o diagnóstico de onde você parou.',
            });
        }
        setShowRestaurarDialog(false);
    };

    const descartarRascunho = () => {
        limparRascunho();
        sessionStorage.removeItem('dg_formdata_restore');
        setShowRestaurarDialog(false);
    };

    // ========== EFFECTS ==========
    useEffect(() => {
        if (getRascunho()) {
            setShowRestaurarDialog(true);
        }
    }, []);

    useEffect(() => {
        salvarRascunho();
    }, [salvarRascunho]);

    useEffect(() => {
        const formDataRestore = sessionStorage.getItem('dg_formdata_restore');
        if (formDataRestore && receptoras.length > 0) {
            try {
                const savedFormData = JSON.parse(formDataRestore);
                const restoredFormData: DiagnosticoFormData = {};
                receptoras.forEach(r => {
                    restoredFormData[r.receptora_id] = savedFormData[r.receptora_id] || {
                        resultado: '',
                        numero_gestacoes: '1',
                        observacoes: '',
                        data_diagnostico: hoje,
                    };
                });
                setFormData(restoredFormData);
                sessionStorage.removeItem('dg_formdata_restore');
            } catch {
                sessionStorage.removeItem('dg_formdata_restore');
            }
        }
    }, [receptoras, hoje]);

    useEffect(() => {
        loadFazendas();
    }, [loadFazendas]);

    useEffect(() => {
        if (fazendaSelecionada) {
            const fazendaNome = fazendas.find(f => f.id === fazendaSelecionada)?.nome;
            loadLotesTE(fazendaSelecionada, fazendaNome);
        } else {
            setLoteSelecionado(null);
            setReceptoras([]);
            setFormData({});
        }
    }, [fazendaSelecionada, fazendas, loadLotesTE]);

    useEffect(() => {
        if (loteSelecionado) {
            if (loteSelecionado.veterinario_dg || loteSelecionado.tecnico_dg) {
                setLoteFormData({
                    veterinario_responsavel: loteSelecionado.veterinario_dg || loteFormData.veterinario_responsavel,
                    tecnico_responsavel: loteSelecionado.tecnico_dg || loteFormData.tecnico_responsavel,
                });
            }
            loadReceptorasLote(loteSelecionado);
        } else {
            setReceptoras([]);
            setFormData({});
        }
    }, [loteSelecionado]);

    // ========== LOAD LOGIC ==========
    const loadReceptorasLote = async (lote: LoteTEDiagnostico) => {
        try {
            setLoading(true);

            const { data: viewData, error: viewError } = await supabase
                .from('receptoras')
                .select('id')
                .eq('fazenda_atual_id', lote.fazenda_id);

            if (viewError) throw viewError;

            const receptoraIds = viewData?.map(v => v.id) || [];
            if (receptoraIds.length === 0) {
                setReceptoras([]);
                return;
            }

            const [receptorasResult, teResult] = await Promise.all([
                supabase
                    .from('receptoras')
                    .select('id, identificacao, nome, status_reprodutivo')
                    .in('id', receptoraIds)
                    .eq('status_reprodutivo', 'SERVIDA'),
                supabase
                    .from('transferencias_embrioes')
                    .select('id, receptora_id, embriao_id, data_te')
                    .in('receptora_id', receptoraIds)
                    .eq('data_te', lote.data_te)
                    .eq('status_te', 'REALIZADA'),
            ]);

            if (receptorasResult.error) throw receptorasResult.error;
            if (teResult.error) throw teResult.error;

            const receptorasData = receptorasResult.data;
            const teData = teResult.data;

            if (!teData || teData.length === 0) {
                setReceptoras([]);
                return;
            }

            const servidasIds = receptorasData?.map(r => r.id) || [];
            const embriaoIds = teData.map(t => t.embriao_id).filter(Boolean);
            let embrioesMap = new Map();

            if (embriaoIds.length > 0) {
                const { data: embrioesData, error: embrioesError } = await supabase
                    .from('embrioes')
                    .select('id, identificacao, classificacao, lote_fiv_id, lote_fiv_acasalamento_id')
                    .in('id', embriaoIds);

                if (embrioesError) throw embrioesError;
                embrioesMap = new Map(embrioesData?.map(e => [e.id, e]) || []);
            }

            const loteIds = [...new Set(Array.from(embrioesMap.values()).map((e: EmbriaoQuery) => e.lote_fiv_id).filter(Boolean))];
            const acasalamentoIds = extrairAcasalamentoIds(Array.from(embrioesMap.values()));

            const [lotesResult, genealogiaResult, diagnosticosResult] = await Promise.all([
                loteIds.length > 0
                    ? supabase.from('lotes_fiv').select('id, data_abertura').in('id', loteIds)
                    : Promise.resolve({ data: [], error: null }),
                buscarDadosGenealogia(acasalamentoIds),
                supabase
                    .from('diagnosticos_gestacao')
                    .select('*')
                    .in('receptora_id', servidasIds)
                    .eq('tipo_diagnostico', 'DG')
                    .eq('data_te', lote.data_te)
                    .order('data_diagnostico', { ascending: false }),
            ]);

            if (lotesResult.error) throw lotesResult.error;
            const lotesMap = new Map((lotesResult.data || []).map(l => [l.id, l] as [string, typeof l]));
            const { doadorasMap, tourosMap } = genealogiaResult;

            const diagnosticosPorReceptora = new Map<string, typeof diagnosticosResult.data[0]>();
            diagnosticosResult.data?.forEach(dg => {
                if (!diagnosticosPorReceptora.has(dg.receptora_id)) {
                    diagnosticosPorReceptora.set(dg.receptora_id, dg);
                }
            });

            const tesPorReceptora = new Map<string, typeof teData>();
            teData.forEach(te => {
                const chave = `${te.receptora_id}-${te.data_te}`;
                if (!tesPorReceptora.has(chave)) {
                    tesPorReceptora.set(chave, []);
                }
                tesPorReceptora.get(chave)!.push(te);
            });

            const receptorasCompletas: ReceptoraServida[] = [];

            tesPorReceptora.forEach((tes) => {
                const primeiraTE = tes[0];
                const receptora = receptorasData?.find(r => r.id === primeiraTE.receptora_id);
                if (!receptora) return;

                const embrioesDoGrupo: EmbriaoTransferido[] = [];
                let dataAberturalote: string | null = null;
                let diasGestacao: number | null = null;

                tes.forEach(te => {
                    const embriao = embrioesMap.get(te.embriao_id);
                    if (!embriao) return;

                    const loteFiv = lotesMap.get(embriao.lote_fiv_id);
                    if (!loteFiv) return;

                    if (!dataAberturalote) {
                        dataAberturalote = loteFiv.data_abertura;
                        diasGestacao = calcularDiasGestacao(loteFiv.data_abertura);
                    }

                    const doadoraRegistro = embriao.lote_fiv_acasalamento_id
                        ? doadorasMap.get(embriao.lote_fiv_acasalamento_id)
                        : undefined;
                    const touroNome = embriao.lote_fiv_acasalamento_id
                        ? tourosMap.get(embriao.lote_fiv_acasalamento_id)
                        : undefined;

                    embrioesDoGrupo.push({
                        te_id: te.id,
                        embriao_id: embriao.id,
                        embriao_identificacao: embriao.identificacao,
                        embriao_classificacao: embriao.classificacao,
                        lote_fiv_id: embriao.lote_fiv_id,
                        lote_fiv_acasalamento_id: embriao.lote_fiv_acasalamento_id,
                        doadora_registro: doadoraRegistro,
                        touro_nome: touroNome,
                    });
                });

                if (embrioesDoGrupo.length === 0 || !dataAberturalote || diasGestacao === null) return;

                const diagnosticoExistente = diagnosticosPorReceptora.get(primeiraTE.receptora_id);

                receptorasCompletas.push({
                    receptora_id: primeiraTE.receptora_id,
                    brinco: receptora.identificacao,
                    nome: receptora.nome,
                    status_reprodutivo: receptora.status_reprodutivo,
                    data_te: primeiraTE.data_te,
                    embrioes: embrioesDoGrupo,
                    data_abertura_lote: dataAberturalote,
                    dias_gestacao: diasGestacao,
                    diagnostico_existente: diagnosticoExistente ? {
                        id: diagnosticoExistente.id,
                        data_diagnostico: diagnosticoExistente.data_diagnostico,
                        resultado: diagnosticoExistente.resultado,
                        numero_gestacoes: diagnosticoExistente.numero_gestacoes || undefined,
                        observacoes: diagnosticoExistente.observacoes || undefined,
                    } : undefined,
                });
            });

            receptorasCompletas.sort((a, b) => a.brinco.localeCompare(b.brinco));
            setReceptoras(receptorasCompletas);

            const initialFormData: DiagnosticoFormData = {};
            receptorasCompletas.forEach(r => {
                if (r.diagnostico_existente) {
                    const resultado = r.diagnostico_existente.resultado as 'PRENHE' | 'VAZIA' | 'RETOQUE';
                    const numeroGestacoes = r.diagnostico_existente.numero_gestacoes?.toString() ||
                        ((resultado === 'PRENHE' || resultado === 'RETOQUE') ? '1' : '');

                    initialFormData[r.receptora_id] = {
                        resultado,
                        numero_gestacoes: numeroGestacoes,
                        observacoes: r.diagnostico_existente.observacoes || '',
                        data_diagnostico: r.diagnostico_existente.data_diagnostico,
                    };
                } else {
                    initialFormData[r.receptora_id] = {
                        resultado: '',
                        numero_gestacoes: '',
                        observacoes: '',
                        data_diagnostico: hoje,
                    };
                }
            });
            setFormData(initialFormData);
        } catch (error) {
            toast({
                title: 'Erro ao carregar receptoras',
                description: error instanceof Error ? error.message : 'Erro desconhecido',
                variant: 'destructive',
            });
            setReceptoras([]);
        } finally {
            setLoading(false);
        }
    };

    // ========== HANDLERS ==========
    const handleResultadoChange = (receptoraId: string, resultado: 'PRENHE' | 'VAZIA' | 'RETOQUE' | '') => {
        setFormData(prev => {
            const dadosAtuais = prev[receptoraId] || {
                resultado: '',
                numero_gestacoes: '',
                observacoes: '',
                data_diagnostico: hoje
            };
            let numero_gestacoes = dadosAtuais.numero_gestacoes || '';

            if ((resultado === 'PRENHE' || resultado === 'RETOQUE') && !numero_gestacoes) {
                numero_gestacoes = '1';
            } else if (resultado === 'VAZIA' || resultado === '') {
                numero_gestacoes = '';
            }

            return {
                ...prev,
                [receptoraId]: {
                    ...dadosAtuais,
                    resultado,
                    numero_gestacoes: numero_gestacoes,
                },
            };
        });
    };

    const handleFieldChange = (receptoraId: string, field: keyof DiagnosticoFormData[string], value: string) => {
        setFormData(prev => ({
            ...prev,
            [receptoraId]: {
                ...prev[receptoraId],
                [field]: value,
            },
        }));
    };

    const handleSalvarLote = async () => {
        if (!loteSelecionado) return;

        if (!validarResponsaveis(loteFormData)) {
            toast({
                title: 'Erro de validação',
                description: 'Veterinário responsável é obrigatório',
                variant: 'destructive',
            });
            return;
        }

        const receptorasSemResultado = receptoras.filter(r => {
            const dados = formData[r.receptora_id];
            return !dados || !dados.resultado || !dados.data_diagnostico;
        });

        if (receptorasSemResultado.length > 0) {
            toast({
                title: 'Erro de validação',
                description: `Há ${receptorasSemResultado.length} receptora(s) sem resultado definido`,
                variant: 'destructive',
            });
            return;
        }

        try {
            setSubmitting(true);

            for (const receptora of receptoras) {
                const statusAtual = receptora.status_reprodutivo || 'VAZIA';
                const validacao = validarTransicaoStatus(statusAtual, 'REALIZAR_DG');

                if (!validacao.valido) {
                    toast({
                        title: 'Erro de validação',
                        description: `Receptora ${receptora.brinco}: ${validacao.mensagem}`,
                        variant: 'destructive',
                    });
                    return;
                }
            }

            const diagnosticosParaInserir: DiagnosticoGestacaoInsert[] = [];
            const diagnosticosParaAtualizar: DiagnosticoGestacaoUpdate[] = [];
            const atualizacoesStatus: Array<{ receptora_id: string; status: string; dataParto: string | null }> = [];

            receptoras.forEach(receptora => {
                const dados = formData[receptora.receptora_id];
                if (!dados || !dados.resultado || !dados.data_diagnostico) return;

                const insertData: DiagnosticoGestacaoInsert = {
                    receptora_id: receptora.receptora_id,
                    data_te: receptora.data_te,
                    tipo_diagnostico: 'DG',
                    data_diagnostico: dados.data_diagnostico,
                    resultado: dados.resultado,
                    observacoes: dados.observacoes?.trim() || undefined,
                };

                if (dados.resultado === 'PRENHE' || dados.resultado === 'RETOQUE') {
                    insertData.numero_gestacoes = dados.numero_gestacoes ? parseInt(dados.numero_gestacoes) : 1;
                } else {
                    insertData.numero_gestacoes = 0;
                }

                if (loteFormData.veterinario_responsavel?.trim()) {
                    insertData.veterinario_responsavel = loteFormData.veterinario_responsavel.trim();
                }
                if (loteFormData.tecnico_responsavel?.trim()) {
                    insertData.tecnico_responsavel = loteFormData.tecnico_responsavel.trim();
                }

                if (receptora.diagnostico_existente) {
                    diagnosticosParaAtualizar.push({ id: receptora.diagnostico_existente.id, ...insertData });
                } else {
                    diagnosticosParaInserir.push(insertData);
                }

                let novoStatus: 'PRENHE' | 'PRENHE_RETOQUE' | 'VAZIA';
                let dataParto: string | null = null;

                if (dados.resultado === 'PRENHE') {
                    novoStatus = 'PRENHE';
                    dataParto = calcularDataProvavelParto(receptora.data_abertura_lote);
                } else if (dados.resultado === 'RETOQUE') {
                    novoStatus = 'PRENHE_RETOQUE';
                    dataParto = calcularDataProvavelParto(receptora.data_abertura_lote);
                } else {
                    novoStatus = 'VAZIA';
                }

                atualizacoesStatus.push({
                    receptora_id: receptora.receptora_id,
                    status: novoStatus,
                    dataParto,
                });
            });

            if (diagnosticosParaInserir.length > 0) {
                const { data: existentes } = await supabase
                    .from('diagnosticos_gestacao')
                    .select('id, receptora_id, data_te, tipo_diagnostico')
                    .in('receptora_id', [...new Set(diagnosticosParaInserir.map(dg => dg.receptora_id))])
                    .eq('tipo_diagnostico', 'DG');

                const existentesMap = new Map<string, string>();
                existentes?.forEach(dg => {
                    const chave = `${dg.receptora_id}-${dg.data_te}-${dg.tipo_diagnostico}`;
                    existentesMap.set(chave, dg.id);
                });

                const diagnosticosParaInserirFinal: DiagnosticoGestacaoInsert[] = [];

                diagnosticosParaInserir.forEach(dg => {
                    const chave = `${dg.receptora_id}-${dg.data_te}-${dg.tipo_diagnostico}`;
                    const existingId = existentesMap.get(chave);

                    if (existingId) {
                        diagnosticosParaAtualizar.push({ id: existingId, ...dg });
                    } else {
                        diagnosticosParaInserirFinal.push(dg);
                    }
                });

                if (diagnosticosParaInserirFinal.length > 0) {
                    // Tentativa resiliente de insert
                    const { error: insertError } = await supabase
                        .from('diagnosticos_gestacao')
                        .insert(diagnosticosParaInserirFinal);

                    if (insertError) {
                        // Tenta inserir sem os responsáveis se falhar (caso as colunas não existam)
                        if (insertError.message?.includes('column') || insertError.code === '42703') {
                            const insertDataSemCampos = diagnosticosParaInserirFinal.map(({ veterinario_responsavel, tecnico_responsavel, ...rest }) => rest);
                            const { error: retryError } = await supabase.from('diagnosticos_gestacao').insert(insertDataSemCampos);
                            if (retryError) throw new Error(`Erro ao inserir diagnósticos: ${retryError.message}`);
                        } else {
                            throw new Error(`Erro ao inserir diagnósticos: ${insertError.message}`);
                        }
                    }
                }
            }

            const updatePromises = diagnosticosParaAtualizar.map(async (dg) => {
                const { id, ...updateData } = dg;
                let { error: updateError } = await supabase.from('diagnosticos_gestacao').update(updateData).eq('id', id);

                if (updateError && (updateError.message?.includes('column') || updateError.code === '42703')) {
                    const { veterinario_responsavel, tecnico_responsavel, ...updateDataSemCampos } = updateData;
                    const { error: retryError } = await supabase.from('diagnosticos_gestacao').update(updateDataSemCampos).eq('id', id);
                    if (retryError) throw new Error(`Erro ao atualizar diagnóstico: ${retryError.message}`);
                } else if (updateError) {
                    throw new Error(`Erro ao atualizar diagnóstico: ${updateError.message}`);
                }
            });

            await Promise.all(updatePromises);

            const statusGroups = new Map<string, { ids: string[]; dataParto: string | null }>();
            atualizacoesStatus.forEach(({ receptora_id, status, dataParto }) => {
                const key = `${status}|${dataParto || 'null'}`;
                if (!statusGroups.has(key)) {
                    statusGroups.set(key, { ids: [], dataParto: dataParto || null });
                }
                statusGroups.get(key)!.ids.push(receptora_id);
            });

            const statusPromises = Array.from(statusGroups.entries()).map(async ([key, { ids, dataParto }]) => {
                const status = key.split('|')[0];
                const updateData: Record<string, string | null> = { status_reprodutivo: status };
                if (dataParto) {
                    updateData.data_provavel_parto = dataParto;
                } else if (status === 'VAZIA') {
                    updateData.data_provavel_parto = null;
                }

                const { error: statusError } = await supabase
                    .from('receptoras')
                    .update(updateData)
                    .in('id', ids);

                if (statusError) throw new Error(`Erro ao atualizar status das receptoras`);
            });

            await Promise.all(statusPromises);

            const todasComDiagnostico = receptoras.every(r => {
                const dados = formData[r.receptora_id];
                return dados && dados.resultado && dados.data_diagnostico;
            });

            toast({
                title: 'Lote salvo com sucesso',
                description: todasComDiagnostico
                    ? `${receptoras.length} diagnóstico(s) registrado(s). Lote fechado.`
                    : `${receptoras.length} diagnóstico(s) registrado(s)`,
            });

            limparRascunho();

            if (todasComDiagnostico) {
                setLoteSelecionado(null);
                setReceptoras([]);
                setFormData({});
            } else {
                setLoteSelecionado({
                    ...loteSelecionado,
                    veterinario_dg: loteFormData.veterinario_responsavel.trim(),
                    tecnico_dg: loteFormData.tecnico_responsavel.trim(),
                    status: 'ABERTO',
                });
            }

            const fazendaNome = fazendas.find(f => f.id === fazendaSelecionada)?.nome;
            loadFazendas();
            if (fazendaSelecionada) {
                loadLotesTE(fazendaSelecionada, fazendaNome);
            }

        } catch (error) {
            toast({
                title: 'Erro ao salvar lote',
                description: error instanceof Error ? error.message : 'Erro desconhecido',
                variant: 'destructive',
            });
        } finally {
            setSubmitting(false);
        }
    };

    return {
        fazendaSelecionada,
        setFazendaSelecionada,
        loteSelecionado,
        setLoteSelecionado,
        receptoras,
        loading,
        submitting,
        formData,
        loteFormData,
        setLoteFormData,
        fazendas,
        lotesTE,
        loadingLotes,
        handleSalvarLote,
        handleResultadoChange,
        handleFieldChange,
        showRestaurarDialog,
        setShowRestaurarDialog,
        restaurarRascunho,
        descartarRascunho,
        hoje
    };
}
