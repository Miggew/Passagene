import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { todayISO } from '@/lib/dateUtils';
import { useFazendasComLotes, useLotesTE } from '@/hooks/loteTE';
import type { LoteTESexagem, LoteFormDataBase } from '@/lib/gestacao';
import type { ReceptoraPrenhe, SexagemFormData, ResultadoSexagem } from '@/lib/types/sexagem';
import type { DiagnosticoGestacaoInsert, DiagnosticoGestacaoUpdate } from '@/lib/types';
import { buscarDadosGenealogia, buscarLotesFIV, extrairAcasalamentoIds, extrairLoteIds, calcularDiasGestacao } from '@/lib/dataEnrichment';
import { validarResponsaveis } from '@/lib/gestacao';
import type { EmbriaoTransferido } from '@/lib/gestacao';

// Configuração de rascunho
const RASCUNHO_KEY = 'passagene_sexagem_rascunho';
const RASCUNHO_EXPIRACAO_HORAS = 24;

interface RascunhoSexagem {
    fazenda_id: string;
    lote_id: string;
    lote_data_te: string;
    formData: SexagemFormData;
    loteFormData: LoteFormDataBase;
    timestamp: number;
}

export function useSexagem() {
    const { toast } = useToast();
    const hoje = todayISO();

    // State
    const [fazendaSelecionada, setFazendaSelecionada] = useState<string>('');
    const [loteSelecionado, setLoteSelecionado] = useState<LoteTESexagem | null>(null);
    const [receptoras, setReceptoras] = useState<ReceptoraPrenhe[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState<SexagemFormData>({});
    const [loteFormData, setLoteFormData] = useState<LoteFormDataBase>({
        veterinario_responsavel: '',
        tecnico_responsavel: '',
    });
    const [showRestaurarDialog, setShowRestaurarDialog] = useState(false);

    // Hooks compartilhados
    const { fazendas, loadFazendas } = useFazendasComLotes({
        statusReceptoraFiltro: ['PRENHE', 'PRENHE_RETOQUE'],
    });

    const transformLote = useCallback((
        loteBase: { id: string; fazenda_id: string; fazenda_nome: string; data_te: string; quantidade_receptoras: number; status: 'ABERTO' | 'FECHADO' },
        diagnosticoLote: { veterinario_responsavel?: string; tecnico_responsavel?: string } | undefined
    ): LoteTESexagem => ({
        ...loteBase,
        veterinario_sexagem: diagnosticoLote?.veterinario_responsavel,
        tecnico_sexagem: diagnosticoLote?.tecnico_responsavel,
    }), []);

    const { lotesTE, loading: loadingLotes, loadLotesTE } = useLotesTE<LoteTESexagem>({
        statusReceptoraFiltro: ['PRENHE', 'PRENHE_RETOQUE'],
        transformLote,
    });

    // ========== RASCUNHO ==========
    const getRascunho = (): RascunhoSexagem | null => {
        try {
            const raw = localStorage.getItem(RASCUNHO_KEY);
            if (!raw) return null;
            const rascunho: RascunhoSexagem = JSON.parse(raw);
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
            dados => dados.sexagens.some(s => s !== '') || dados.observacoes
        );
        if (!temDadosPreenchidos) return;

        const rascunho: RascunhoSexagem = {
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
            sessionStorage.setItem('sexagem_formdata_restore', JSON.stringify(rascunho.formData));
            toast({
                title: 'Sessão restaurada',
                description: 'Continuando a sexagem de onde você parou.',
            });
        }
        setShowRestaurarDialog(false);
    };

    const descartarRascunho = () => {
        limparRascunho();
        sessionStorage.removeItem('sexagem_formdata_restore');
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
        const formDataRestore = sessionStorage.getItem('sexagem_formdata_restore');
        if (formDataRestore && receptoras.length > 0) {
            try {
                const savedFormData = JSON.parse(formDataRestore);
                const restoredFormData: SexagemFormData = {};
                receptoras.forEach(r => {
                    if (savedFormData[r.receptora_id]) {
                        restoredFormData[r.receptora_id] = savedFormData[r.receptora_id];
                    } else {
                        restoredFormData[r.receptora_id] = {
                            data_sexagem: hoje,
                            sexagens: Array(r.numero_gestacoes).fill(''),
                            observacoes: '',
                        };
                    }
                });
                setFormData(restoredFormData);
                sessionStorage.removeItem('sexagem_formdata_restore');
            } catch {
                sessionStorage.removeItem('sexagem_formdata_restore');
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
            if (loteSelecionado.veterinario_sexagem || loteSelecionado.tecnico_sexagem) {
                setLoteFormData({
                    veterinario_responsavel: loteSelecionado.veterinario_sexagem || loteFormData.veterinario_responsavel,
                    tecnico_responsavel: loteSelecionado.tecnico_sexagem || loteFormData.tecnico_responsavel,
                });
            }
            loadReceptorasLote(loteSelecionado);
        } else {
            setReceptoras([]);
            setFormData({});
        }
    }, [loteSelecionado]);

    // ========== LOAD LOGIC ==========
    const loadReceptorasLote = async (lote: LoteTESexagem) => {
        try {
            setLoading(true);

            const { data: viewData } = await supabase
                .from('receptoras')
                .select('id')
                .eq('fazenda_atual_id', lote.fazenda_id);

            const receptoraIds = viewData?.map(v => v.id) || [];

            const { data: receptorasData } = await supabase
                .from('receptoras')
                .select('id, identificacao, nome, status_reprodutivo')
                .in('id', receptoraIds)
                .in('status_reprodutivo', ['PRENHE', 'PRENHE_RETOQUE']);

            const prenhesIds = receptorasData?.map(r => r.id) || [];

            if (prenhesIds.length === 0) {
                setReceptoras([]);
                return;
            }

            const [teResult, diagnosticosResult, sexagensResult] = await Promise.all([
                supabase
                    .from('transferencias_embrioes')
                    .select('id, receptora_id, embriao_id, data_te')
                    .in('receptora_id', prenhesIds)
                    .eq('data_te', lote.data_te)
                    .eq('status_te', 'REALIZADA'),
                supabase
                    .from('diagnosticos_gestacao')
                    .select('*')
                    .in('receptora_id', prenhesIds)
                    .eq('tipo_diagnostico', 'DG')
                    .eq('data_te', lote.data_te)
                    .order('data_diagnostico', { ascending: false }),
                supabase
                    .from('diagnosticos_gestacao')
                    .select('*')
                    .in('receptora_id', prenhesIds)
                    .eq('tipo_diagnostico', 'SEXAGEM')
                    .eq('data_te', lote.data_te)
                    .order('data_diagnostico', { ascending: false }),
            ]);

            const teData = teResult.data;
            const diagnosticosData = diagnosticosResult.data;
            const sexagensData = sexagensResult.data;

            if (!teData || teData.length === 0) {
                setReceptoras([]);
                return;
            }

            const embriaoIds = teData.map(t => t.embriao_id).filter(Boolean);
            let embrioesMap = new Map();

            if (embriaoIds.length > 0) {
                const { data: embrioesData } = await supabase
                    .from('embrioes')
                    .select('id, identificacao, classificacao, lote_fiv_id, lote_fiv_acasalamento_id')
                    .in('id', embriaoIds);

                if (embrioesData) {
                    embrioesMap = new Map(embrioesData.map(e => [e.id, e]));
                }
            }

            const embrioesList = Array.from(embrioesMap.values());
            const loteIds = extrairLoteIds(embrioesList);
            const acasalamentoIds = extrairAcasalamentoIds(embrioesList);

            const [lotesMap, genealogiaResult] = await Promise.all([
                buscarLotesFIV(loteIds),
                buscarDadosGenealogia(acasalamentoIds),
            ]);

            const { doadorasMap, tourosMap } = genealogiaResult;

            const diagnosticosPorReceptora = new Map<string, typeof diagnosticosData[0]>();
            diagnosticosData?.forEach(dg => {
                if (!diagnosticosPorReceptora.has(dg.receptora_id)) {
                    diagnosticosPorReceptora.set(dg.receptora_id, dg);
                }
            });

            const sexagensPorReceptora = new Map<string, typeof sexagensData[0]>();
            sexagensData?.forEach(s => {
                if (!sexagensPorReceptora.has(s.receptora_id)) {
                    sexagensPorReceptora.set(s.receptora_id, s);
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

            const receptorasCompletas: ReceptoraPrenhe[] = [];

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

                const diagnostico = diagnosticosPorReceptora.get(primeiraTE.receptora_id);
                if (!diagnostico || diagnostico.resultado === 'VAZIA') return;

                receptorasCompletas.push({
                    receptora_id: primeiraTE.receptora_id,
                    brinco: receptora.identificacao,
                    nome: receptora.nome,
                    data_te: primeiraTE.data_te,
                    embrioes: embrioesDoGrupo,
                    data_abertura_lote: dataAberturalote,
                    dias_gestacao: diasGestacao,
                    numero_gestacoes: diagnostico.numero_gestacoes || 1,
                    diagnostico_existente: sexagensPorReceptora.get(primeiraTE.receptora_id) ? {
                        id: sexagensPorReceptora.get(primeiraTE.receptora_id)!.id,
                        data_diagnostico: sexagensPorReceptora.get(primeiraTE.receptora_id)!.data_diagnostico,
                        resultado: sexagensPorReceptora.get(primeiraTE.receptora_id)!.resultado,
                        numero_gestacoes: sexagensPorReceptora.get(primeiraTE.receptora_id)!.numero_gestacoes,
                        observacoes: sexagensPorReceptora.get(primeiraTE.receptora_id)!.observacoes,
                    } : undefined,
                });
            });

            receptorasCompletas.sort((a, b) => a.brinco.localeCompare(b.brinco));
            setReceptoras(receptorasCompletas);

            const initialFormData: SexagemFormData = {};
            receptorasCompletas.forEach(r => {
                if (r.diagnostico_existente) {
                    const sexagemCompleta = sexagensPorReceptora.get(r.receptora_id);
                    let sexagensParsed: string[] = new Array(r.numero_gestacoes).fill('').map(() => '');
                    let observacoesLimpa = r.diagnostico_existente.observacoes || '';

                    if (sexagemCompleta?.observacoes) {
                        const matchSexagens = sexagemCompleta.observacoes.match(/SEXAGENS:([^|]+)/);
                        if (matchSexagens) {
                            const sexagensArray = matchSexagens[1].split(',').map(s => s.trim());
                            sexagensParsed = sexagensArray;
                            while (sexagensParsed.length < r.numero_gestacoes) {
                                sexagensParsed.push('');
                            }
                            sexagensParsed = sexagensParsed.slice(0, r.numero_gestacoes);
                            observacoesLimpa = sexagemCompleta.observacoes.replace(/SEXAGENS:[^|]+\|?/, '').trim();
                        }
                    }

                    if (sexagensParsed.every(s => !s) && sexagemCompleta?.sexagem) {
                        sexagensParsed[0] = sexagemCompleta.sexagem;
                    }

                    initialFormData[r.receptora_id] = {
                        data_sexagem: r.diagnostico_existente.data_diagnostico,
                        sexagens: sexagensParsed,
                        observacoes: observacoesLimpa,
                    };
                } else {
                    initialFormData[r.receptora_id] = {
                        data_sexagem: hoje,
                        sexagens: new Array(r.numero_gestacoes).fill('').map(() => ''),
                        observacoes: '',
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
    const handleSexagemChange = (receptoraId: string, index: number, value: ResultadoSexagem | '') => {
        setFormData(prev => {
            const dados = prev[receptoraId] || { data_sexagem: hoje, sexagens: [], observacoes: '' };
            const novasSexagens = [...dados.sexagens];
            novasSexagens[index] = value;
            return {
                ...prev,
                [receptoraId]: { ...dados, sexagens: novasSexagens },
            };
        });
    };

    const handleFieldChange = (receptoraId: string, field: 'data_sexagem' | 'observacoes', value: string) => {
        setFormData(prev => ({
            ...prev,
            [receptoraId]: { ...prev[receptoraId], [field]: value },
        }));
    };

    const calcularStatusFinal = (sexagens: string[]): 'PRENHE_FEMEA' | 'PRENHE_MACHO' | 'PRENHE_SEM_SEXO' | 'PRENHE_2_SEXOS' | 'VAZIA' => {
        const sexagensValidas = sexagens.filter(s => s && s !== 'VAZIA');

        if (sexagensValidas.length === 0) return 'VAZIA';

        const temFemea = sexagensValidas.includes('FEMEA');
        const temMacho = sexagensValidas.includes('MACHO');
        const temSemSexo = sexagensValidas.includes('SEM_SEXO');

        if (temFemea && !temMacho && !temSemSexo) return 'PRENHE_FEMEA';
        if (temMacho && !temFemea && !temSemSexo) return 'PRENHE_MACHO';
        if (temFemea && temMacho) return 'PRENHE_2_SEXOS';
        return 'PRENHE_SEM_SEXO';
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
            return !dados || !dados.data_sexagem || !dados.sexagens || dados.sexagens.every(s => !s);
        });

        if (receptorasSemResultado.length > 0) {
            toast({
                title: 'Erro de validação',
                description: `Há ${receptorasSemResultado.length} receptora(s) sem sexagem definida`,
                variant: 'destructive',
            });
            return;
        }

        try {
            setSubmitting(true);

            const diagnosticosParaInserir: DiagnosticoGestacaoInsert[] = [];
            const diagnosticosParaAtualizar: DiagnosticoGestacaoUpdate[] = [];
            const atualizacoesStatus: Array<{ receptora_id: string; status: string }> = [];

            receptoras.forEach(receptora => {
                const dados = formData[receptora.receptora_id];
                if (!dados || !dados.data_sexagem) return;

                const sexagensValidas = dados.sexagens.filter(s => s && s !== 'VAZIA');
                const statusFinal = calcularStatusFinal(dados.sexagens);
                const resultadoFinal = statusFinal === 'VAZIA' ? 'VAZIA' : 'PRENHE';

                let sexagemValue: string | null = null;
                if (resultadoFinal === 'PRENHE') {
                    const temApenasFemeas = sexagensValidas.every(s => s === 'FEMEA') && sexagensValidas.length > 0;
                    const temApenasMachos = sexagensValidas.every(s => s === 'MACHO') && sexagensValidas.length > 0;

                    if (temApenasFemeas) {
                        sexagemValue = 'FEMEA';
                    } else if (temApenasMachos) {
                        sexagemValue = 'MACHO';
                    } else {
                        sexagemValue = sexagensValidas.find(s => s === 'FEMEA' || s === 'MACHO') || null;
                    }
                }

                if (sexagemValue === 'PRENHE' || sexagemValue === 'SEM_SEXO') {
                    const primeiraFemeaOuMacho = sexagensValidas.find(s => s === 'FEMEA' || s === 'MACHO');
                    sexagemValue = primeiraFemeaOuMacho || null;
                }

                const numeroGestacoes = resultadoFinal === 'VAZIA' ? 0 : sexagensValidas.length;

                let observacoesComSexagens = dados.observacoes?.trim() || '';
                const todasSexagens = dados.sexagens.filter(s => s);
                const sexagensDetalhadas = todasSexagens.length > 0 ? todasSexagens.join(',') : '';

                if (sexagensDetalhadas) {
                    if (!observacoesComSexagens.includes('SEXAGENS:')) {
                        observacoesComSexagens = observacoesComSexagens
                            ? `SEXAGENS:${sexagensDetalhadas}|${observacoesComSexagens}`
                            : `SEXAGENS:${sexagensDetalhadas}`;
                    } else {
                        observacoesComSexagens = observacoesComSexagens.replace(
                            /SEXAGENS:[^|]+/,
                            `SEXAGENS:${sexagensDetalhadas}`
                        );
                    }
                }

                const insertData: DiagnosticoGestacaoInsert = {
                    receptora_id: receptora.receptora_id,
                    data_te: receptora.data_te,
                    tipo_diagnostico: 'SEXAGEM',
                    data_diagnostico: dados.data_sexagem,
                    resultado: resultadoFinal,
                    sexagem: sexagemValue,
                    numero_gestacoes: numeroGestacoes,
                    observacoes: observacoesComSexagens || undefined,
                    veterinario_responsavel: loteFormData.veterinario_responsavel?.trim() || undefined,
                    tecnico_responsavel: loteFormData.tecnico_responsavel?.trim() || undefined,
                };

                if (receptora.diagnostico_existente) {
                    diagnosticosParaAtualizar.push({ id: receptora.diagnostico_existente.id, ...insertData });
                } else {
                    diagnosticosParaInserir.push(insertData);
                }

                atualizacoesStatus.push({
                    receptora_id: receptora.receptora_id,
                    status: statusFinal,
                });
            });

            const operacoes: Promise<void>[] = [];

            if (diagnosticosParaInserir.length > 0) {
                operacoes.push(
                    (async () => {
                        const { error } = await supabase
                            .from('diagnosticos_gestacao')
                            .insert(diagnosticosParaInserir);
                        if (error) throw new Error(`Erro ao inserir sexagens: ${error.message}`);
                    })()
                );
            }

            diagnosticosParaAtualizar.forEach(dg => {
                const { id, ...updateData } = dg;
                operacoes.push(
                    (async () => {
                        const { error } = await supabase
                            .from('diagnosticos_gestacao')
                            .update(updateData)
                            .eq('id', id);
                        if (error) throw new Error(`Erro ao atualizar sexagem: ${error.message}`);
                    })()
                );
            });

            await Promise.all(operacoes);

            const statusGroups = new Map<string, string[]>();
            atualizacoesStatus.forEach(({ receptora_id, status }) => {
                if (!statusGroups.has(status)) {
                    statusGroups.set(status, []);
                }
                statusGroups.get(status)!.push(receptora_id);
            });

            for (const [status, receptoraIds] of statusGroups.entries()) {
                const updateData: { status_reprodutivo: string; data_provavel_parto?: null } = {
                    status_reprodutivo: status
                };
                if (status === 'VAZIA') {
                    updateData.data_provavel_parto = null;
                }

                const { error } = await supabase
                    .from('receptoras')
                    .update(updateData)
                    .in('id', receptoraIds);

                if (error) {
                    throw new Error(`Erro ao atualizar status das receptoras: ${error.message}`);
                }
            }

            const todasComSexagem = receptoras.every(r => {
                const dados = formData[r.receptora_id];
                return dados && dados.data_sexagem && dados.sexagens && dados.sexagens.some(s => s);
            });

            toast({
                title: 'Lote salvo com sucesso',
                description: todasComSexagem
                    ? `${receptoras.length} sexagem(ns) registrada(s). Lote fechado.`
                    : `${receptoras.length} sexagem(ns) registrada(s)`,
            });

            limparRascunho();

            if (todasComSexagem) {
                setLoteSelecionado(null);
                setReceptoras([]);
                setFormData({});
            } else {
                setLoteSelecionado({
                    ...loteSelecionado,
                    veterinario_sexagem: loteFormData.veterinario_responsavel.trim(),
                    tecnico_sexagem: loteFormData.tecnico_responsavel.trim(),
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
        handleSexagemChange,
        handleFieldChange,
        showRestaurarDialog,
        setShowRestaurarDialog,
        restaurarRascunho,
        descartarRascunho,
        hoje
    };
}
