import { supabase } from '@/lib/supabase';
import { subMonths, format } from 'date-fns';
import { carregarHistoricoReceptora } from '@/lib/receptoraHistoricoUtils';
import { PASSO2, TE, DG, SEXAGEM } from '@/lib/fivFlowRules';
import { todayISO, addDays as addDaysISO, diffDays } from '@/lib/dateUtils';

const chunkArray = <T>(array: T[], size: number): T[][] => {
    return Array.from({ length: Math.ceil(array.length / size) }, (v, i) =>
        array.slice(i * size, i * size + size)
    );
};

async function fetchInChunks(table: string, selectFields: string, inColumn: string, inValues: string[], buildQuery?: (q: any) => any) {
    if (!inValues || inValues.length === 0) return [];
    const chunks = chunkArray(inValues, 40);
    const allData: any[] = [];
    for (const c of chunks) {
        let q = supabase.from(table).select(selectFields).in(inColumn, c);
        if (buildQuery) q = buildQuery(q);
        const { data, error } = await q;
        if (error) throw error;
        if (data) allData.push(...data);
    }
    return allData;
}
export interface AIIntent {
    intent: 'relatorio_te' | 'relatorio_dg' | 'relatorio_aspiracao' | 'relatorio_sexagem'
    | 'relatorio_receptoras' | 'relatorio_rebanho' | 'relatorio_animal_especifico'
    | 'resumo_geral' | 'desempenho_veterinario'
    | 'proximos_partos' | 'proximos_servicos' | 'relatorio_protocolos'
    | 'lista_receptoras' | 'lista_doadoras' | 'analise_repetidoras'
    | 'nascimentos' | 'estoque_semen' | 'estoque_embrioes'
    | 'desempenho_touro' | 'comparacao_fazendas'
    | 'desconhecido';
    meses_retroativos: number;
    nome_veterinario: string | null;
    nome_fazenda: string | null;
    termo_busca: string | null;
    resposta_amigavel: string;
    audioBase64?: string;
    precisa_buscar_dados: boolean;
    filtros?: {
        status_reprodutivo?: string[];
        etapa_proxima?: string;
        horizonte_dias?: number;
        dias_gestacao_min?: number;
        dias_gestacao_max?: number;
        apta_para_protocolo?: boolean;
        protocolos_sem_prenhez_min?: number;
        media_oocitos_max?: number;
        media_oocitos_min?: number;
    };
}

export async function fetchReportDataFromIntent(intent: AIIntent, farmIds: string[], receptoraIds: string[], clienteId?: string | null) {
    if (!intent.precisa_buscar_dados || farmIds.length === 0) return null;

    const meses = intent.meses_retroativos || 3;
    // Limitar histórico a 24 meses máximo via chat para performance
    const limitMeses = Math.min(meses, 24);
    const dataInicio = format(subMonths(new Date(), limitMeses), 'yyyy-MM-dd');

    try {
        switch (intent.intent) {
            case 'relatorio_te': {
                if (receptoraIds.length === 0) return { error: 'Nenhuma receptora vinculada às suas fazendas.' };

                // Buscar TEs
                let query = supabase
                    .from('transferencias_embrioes')
                    .select('id, data_te, status_te, veterinario_responsavel')
                    .in('receptora_id', receptoraIds)
                    .gte('data_te', dataInicio);

                if (intent.nome_veterinario) {
                    query = query.ilike('veterinario_responsavel', `%${intent.nome_veterinario}%`);
                }

                const { data: tes, error } = await query;
                if (error) throw error;

                const realizadas = tes.filter(te => te.status_te === 'REALIZADA').length;
                const perdas = tes.filter(te => te.status_te !== 'REALIZADA').length;

                return {
                    tipo: 'TE',
                    periodo: `${limitMeses} meses`,
                    total: tes.length,
                    realizadas,
                    perdas,
                    raw: tes
                };
            }

            case 'relatorio_dg': {
                if (receptoraIds.length === 0) return { error: 'Nenhuma receptora vinculada.' };

                let query = supabase
                    .from('diagnosticos_gestacao')
                    .select('id, data_diagnostico, resultado, veterinario_responsavel')
                    .in('receptora_id', receptoraIds)
                    .eq('tipo_diagnostico', 'DG')
                    .gte('data_diagnostico', dataInicio);

                if (intent.nome_veterinario) {
                    query = query.ilike('veterinario_responsavel', `%${intent.nome_veterinario}%`);
                }

                const { data: dgs, error } = await query;
                if (error) throw error;

                const positivos = dgs.filter(dg => dg.resultado?.startsWith('PRENHE')).length;
                const negativos = dgs.filter(dg => dg.resultado === 'VAZIA').length;
                const taxaPrenhez = dgs.length > 0 ? ((positivos / dgs.length) * 100).toFixed(1) : '0.0';

                return {
                    tipo: 'DG',
                    periodo: `${limitMeses} meses`,
                    total: dgs.length,
                    positivos,
                    negativos,
                    taxaPrenhez: `${taxaPrenhez}%`,
                    raw: dgs
                };
            }

            case 'relatorio_sexagem': {
                if (receptoraIds.length === 0) return { error: 'Nenhuma receptora vinculada.' };

                let query = supabase
                    .from('diagnosticos_gestacao')
                    .select('id, data_diagnostico, sexagem')
                    .in('receptora_id', receptoraIds)
                    .eq('tipo_diagnostico', 'SEXAGEM')
                    .gte('data_diagnostico', dataInicio)
                    .not('sexagem', 'is', null);

                const { data: sexagens, error } = await query;
                if (error) throw error;

                const machos = sexagens.filter(s => s.sexagem === 'MACHO').length;
                const femeas = sexagens.filter(s => s.sexagem === 'FEMEA').length;

                return {
                    tipo: 'SEXAGEM',
                    periodo: `${limitMeses} meses`,
                    total: sexagens.length,
                    machos,
                    femeas,
                    raw: sexagens
                };
            }

            case 'relatorio_aspiracao': {
                let query = supabase
                    .from('pacotes_aspiracao')
                    .select('id, data_aspiracao, veterinario_responsavel')
                    .in('fazenda_id', farmIds)
                    .gte('data_aspiracao', dataInicio);

                if (intent.nome_veterinario) {
                    query = query.ilike('veterinario_responsavel', `%${intent.nome_veterinario}%`);
                }

                const { data: aspiracoes, error } = await query;
                if (error) throw error;

                return {
                    tipo: 'ASPIRACAO',
                    periodo: `${limitMeses} meses`,
                    totalSessoes: aspiracoes.length,
                    raw: aspiracoes
                };
            }

            case 'relatorio_receptoras': {
                if (farmIds.length === 0) return { error: 'Nenhuma fazenda vinculada.' };

                const { data: recs, error } = await supabase
                    .from('receptoras')
                    .select('id, identificacao, status_reprodutivo, is_cio_livre')
                    .in('fazenda_atual_id', farmIds);
                if (error) throw error;

                const vazias = recs.filter(r => r.status_reprodutivo === 'VAZIA').length;
                const prenhes = recs.filter(r => r.status_reprodutivo === 'PRENHE').length;
                const cioLivre = recs.filter(r => r.is_cio_livre).length;

                return {
                    tipo: 'RECEPTORAS',
                    periodo: 'Atual',
                    total: recs.length,
                    vazias,
                    prenhes,
                    cioLivre,
                    raw: recs
                };
            }

            case 'relatorio_rebanho': {
                if (farmIds.length === 0) return { error: 'Nenhuma fazenda vinculada.' };

                // Fetch doadoras
                const { data: doadoras, error: errD } = await supabase
                    .from('doadoras')
                    .select('id, raca, prenhe')
                    .in('fazenda_id', farmIds);
                if (errD) throw errD;

                // Fetch animais normais (bezerros/novilhas/touros)
                const { data: animais, error: errA } = await supabase
                    .from('animais')
                    .select('id, sexo, raca')
                    .in('fazenda_id', farmIds);
                if (errA) throw errA;

                const machos = animais.filter(a => a.sexo === 'MACHO').length;
                const fêmeas = animais.filter(a => a.sexo === 'FÊMEA').length;

                return {
                    tipo: 'REBANHO',
                    periodo: 'Atual',
                    totalDoadoras: doadoras.length,
                    totalAnimais: animais.length,
                    machos,
                    fêmeas,
                    rawDoadoras: doadoras,
                    rawAnimais: animais
                };
            }

            case 'relatorio_animal_especifico': {
                if (farmIds.length === 0) return { error: 'Nenhuma fazenda vinculada.' };
                if (!intent.termo_busca) return { error: 'Você não forneceu o nome ou brinco do animal que quer procurar.' };

                const searchTag = intent.termo_busca.trim();

                // 1. Tentar buscar em Receptoras (pela identificação)
                const { data: recs, error: errR } = await supabase
                    .from('receptoras')
                    .select('id, identificacao, status_reprodutivo, is_cio_livre, nome')
                    .in('fazenda_atual_id', farmIds)
                    .ilike('identificacao', `%${searchTag}%`)
                    .limit(1);

                if (errR) throw errR;

                if (recs && recs.length > 0) {
                    const r = recs[0];

                    // Fetch comprehensive reproductive history using the shared utility
                    const { items: fullHistory, cruzamento, receptoraData } = await carregarHistoricoReceptora(r.id, supabase);

                    // Take the 5 most recent items
                    const recentHistory = fullHistory.slice(0, 5);

                    return {
                        tipo: 'BUSCA_ANIMAL',
                        nomeEncontrado: r.identificacao,
                        categoria: 'Receptora',
                        status: r.status_reprodutivo || 'Desconhecido',
                        cruzamento: cruzamento,
                        dataPartoPrevista: receptoraData?.data_provavel_parto || null,
                        cioLivre: r.is_cio_livre ? 'Sim' : 'Não',
                        historico: recentHistory,
                        raw: r
                    };
                }

                // 2. Tentar em Doadoras (pelo nome ou registro)
                const { data: doas, error: errD } = await supabase
                    .from('doadoras')
                    .select('id, nome, registro, prenhe, raca')
                    .in('fazenda_id', farmIds)
                    .or(`nome.ilike.%${searchTag.replace(/[%,.*()]/g, '')}%,registro.ilike.%${searchTag.replace(/[%,.*()]/g, '')}%`)
                    .limit(1);

                if (doas && doas.length > 0) {
                    const d = doas[0];
                    return {
                        tipo: 'BUSCA_ANIMAL',
                        nomeEncontrado: d.nome || d.registro,
                        categoria: 'Doadora',
                        raca: d.raca || 'N/A',
                        status: d.prenhe ? 'Prenhe' : 'Vazia / Aberta',
                        raw: d
                    };
                }

                return {
                    tipo: 'BUSCA_ANIMAL',
                    nomeEncontrado: searchTag,
                    categoria: 'Não Encontrado na Base Principal',
                    mensagem: `O animal '${searchTag}' não foi localizado ativo nas suas listas críticas gerenciais.`
                };
            }

            case 'desempenho_veterinario': {
                if (receptoraIds.length === 0) return { error: 'Nenhuma receptora vinculada.' };

                let vetQuery = supabase
                    .from('diagnosticos_gestacao')
                    .select('id, resultado, veterinario_responsavel')
                    .in('receptora_id', receptoraIds)
                    .eq('tipo_diagnostico', 'DG')
                    .gte('data_diagnostico', dataInicio);

                if (intent.nome_veterinario) {
                    vetQuery = vetQuery.ilike('veterinario_responsavel', `%${intent.nome_veterinario}%`);
                }

                const { data: vetDGs, error: vetErr } = await vetQuery;
                if (vetErr) throw vetErr;

                const vetMap = new Map<string, { total: number; prenhes: number }>();
                (vetDGs || []).forEach(dg => {
                    const vet = dg.veterinario_responsavel || 'Não informado';
                    const entry = vetMap.get(vet) || { total: 0, prenhes: 0 };
                    entry.total++;
                    if (dg.resultado?.startsWith('PRENHE')) entry.prenhes++;
                    vetMap.set(vet, entry);
                });

                const veterinarios = Array.from(vetMap.entries())
                    .map(([nome, stats]) => ({
                        nome,
                        total: stats.total,
                        prenhes: stats.prenhes,
                        taxa: stats.total > 0 ? `${((stats.prenhes / stats.total) * 100).toFixed(1)}%` : '0.0%',
                    }))
                    .sort((a, b) => b.prenhes / (b.total || 1) - a.prenhes / (a.total || 1));

                return {
                    tipo: 'DESEMPENHO_VET',
                    periodo: `${limitMeses} meses`,
                    veterinarios,
                };
            }

            case 'lista_receptoras': {
                const filtros = intent.filtros || {};
                const today = todayISO();

                // 1. Query base: receptoras das fazendas do cliente
                let recQuery = supabase
                    .from('receptoras')
                    .select('id, identificacao, status_reprodutivo, data_provavel_parto, fazenda_atual_id, is_cio_livre')
                    .in('fazenda_atual_id', farmIds);

                if (filtros.status_reprodutivo?.length) {
                    recQuery = recQuery.in('status_reprodutivo', filtros.status_reprodutivo);
                }

                const { data: recs, error: recErr } = await recQuery;
                if (recErr) throw recErr;

                let resultado = (recs || []).map(r => ({
                    id: r.id,
                    identificacao: r.identificacao || r.id.substring(0, 8),
                    status: r.status_reprodutivo as string | null,
                    dataPartoPrevista: r.data_provavel_parto as string | null,
                    cioLivre: r.is_cio_livre as boolean | null,
                    fazenda_id: r.fazenda_atual_id,
                    diasGestacao: null as number | null,
                    etapaProxima: null as string | null,
                    dataEtapa: null as string | null,
                    diasParaEtapa: null as number | null,
                }));

                // 2. Buscar data_te para computar dias de gestação e etapas
                const needTEIds = resultado
                    .filter(r => r.status?.includes('PRENHE') || r.status === 'SERVIDA')
                    .map(r => r.id);

                const teDateMap = new Map<string, string>();
                if (needTEIds.length > 0) {
                    const { data: tes } = await supabase
                        .from('transferencias_embrioes')
                        .select('receptora_id, data_te')
                        .in('receptora_id', needTEIds)
                        .eq('status_te', 'REALIZADA')
                        .order('data_te', { ascending: false });
                    tes?.forEach(te => {
                        if (!teDateMap.has(te.receptora_id)) teDateMap.set(te.receptora_id, te.data_te);
                    });
                }

                // Enriquecer com dias de gestação (D0 ≈ data_te - DIA_EMBRIAO)
                resultado.forEach(r => {
                    if (r.status?.includes('PRENHE') || r.status === 'SERVIDA') {
                        const dataTE = teDateMap.get(r.id);
                        if (dataTE) {
                            const d0Aprox = addDaysISO(dataTE, -TE.DIA_EMBRIAO);
                            r.diasGestacao = diffDays(d0Aprox, today);
                        }
                    }
                });

                // Filtrar por dias de gestação
                if (filtros.dias_gestacao_min != null) {
                    resultado = resultado.filter(r => r.diasGestacao != null && r.diasGestacao >= filtros.dias_gestacao_min!);
                }
                if (filtros.dias_gestacao_max != null) {
                    resultado = resultado.filter(r => r.diasGestacao != null && r.diasGestacao <= filtros.dias_gestacao_max!);
                }

                // 3. Computar etapa próxima
                resultado.forEach(r => {
                    const dataTE = teDateMap.get(r.id);
                    if (r.status === 'SERVIDA' && dataTE) {
                        r.etapaProxima = 'DG';
                        r.dataEtapa = addDaysISO(dataTE, DG.MIN_DIAS - TE.DIA_EMBRIAO);
                        r.diasParaEtapa = diffDays(today, r.dataEtapa);
                    } else if ((r.status === 'PRENHE' || r.status === 'PRENHE_RETOQUE') && dataTE) {
                        r.etapaProxima = 'Sexagem';
                        r.dataEtapa = addDaysISO(dataTE, SEXAGEM.MIN_DIAS - TE.DIA_EMBRIAO);
                        r.diasParaEtapa = diffDays(today, r.dataEtapa);
                    } else if (r.status?.includes('PRENHE') && r.dataPartoPrevista) {
                        r.etapaProxima = 'Parto';
                        r.dataEtapa = r.dataPartoPrevista;
                        r.diasParaEtapa = diffDays(today, r.dataPartoPrevista);
                    }
                });

                // Filtrar por etapa_proxima
                if (filtros.etapa_proxima) {
                    const etapaMap: Record<string, string> = {
                        dg: 'DG', sexagem: 'Sexagem', parto: 'Parto', te: 'TE', passo2: '2º Passo'
                    };
                    const etapaAlvo = etapaMap[filtros.etapa_proxima.toLowerCase()] || filtros.etapa_proxima;
                    resultado = resultado.filter(r => r.etapaProxima === etapaAlvo);
                }

                // Filtrar por horizonte temporal
                if (filtros.horizonte_dias != null && filtros.etapa_proxima) {
                    resultado = resultado.filter(r =>
                        r.diasParaEtapa != null && r.diasParaEtapa >= 0 && r.diasParaEtapa <= filtros.horizonte_dias!
                    );
                }

                // 4. Filtro: apta para protocolo
                if (filtros.apta_para_protocolo) {
                    const totalAntes = resultado.length;
                    const vazias = resultado.filter(r => r.status === 'VAZIA');
                    const totalVazias = vazias.length;

                    resultado = vazias;
                    let emProtocoloCount = 0;

                    const vaziaIds = resultado.map(r => r.id);
                    if (vaziaIds.length > 0) {
                        const ativas = await fetchInChunks('vw_receptoras_protocolo_ativo', 'receptora_id', 'receptora_id', vaziaIds);
                        emProtocoloCount = ativas?.length || 0;
                        const emProtocoloSet = new Set((ativas || []).map((a: any) => a.receptora_id));
                        resultado = resultado.filter(r => !emProtocoloSet.has(r.id));
                    }

                    // Se 0 aptas, retornar explicação detalhada
                    if (resultado.length === 0) {
                        const motivos: string[] = [];
                        if (totalVazias === 0) {
                            motivos.push(`Nenhuma das ${totalAntes} receptoras está com status VAZIA`);
                        } else {
                            motivos.push(`${totalVazias} receptora(s) VAZIA encontrada(s), mas ${emProtocoloCount === totalVazias ? 'todas' : emProtocoloCount.toString()} já estão em protocolo ativo`);
                        }
                        return {
                            tipo: 'LISTA_RECEPTORAS',
                            total: 0,
                            mostrando: 0,
                            totalGeral: totalAntes,
                            totalVazias,
                            emProtocolo: emProtocoloCount,
                            motivo: motivos.join('. ') + '.',
                            animais: [],
                        };
                    }
                }

                // Ordenar: mais urgente primeiro
                resultado.sort((a, b) => (a.diasParaEtapa ?? 999) - (b.diasParaEtapa ?? 999));

                const limitado = resultado.slice(0, 50);

                return {
                    tipo: 'LISTA_RECEPTORAS',
                    total: resultado.length,
                    mostrando: limitado.length,
                    animais: limitado.map(r => ({
                        identificacao: r.identificacao,
                        status: r.status,
                        diasGestacao: r.diasGestacao,
                        etapaProxima: r.etapaProxima,
                        dataEtapa: r.dataEtapa,
                        diasParaEtapa: r.diasParaEtapa,
                        dataPartoPrevista: r.dataPartoPrevista,
                        cioLivre: r.cioLivre,
                    })),
                };
            }

            case 'lista_doadoras': {
                const filtros = intent.filtros || {};

                const { data: doadoras, error: doaErr } = await supabase
                    .from('doadoras')
                    .select('id, nome, registro, raca')
                    .in('fazenda_id', farmIds);
                if (doaErr) throw doaErr;

                if (!doadoras || doadoras.length === 0) return { tipo: 'LISTA_DOADORAS', total: 0, animais: [] };

                const doadoraIds = doadoras.map(d => d.id);

                const aspiracoes = await fetchInChunks('aspiracoes_doadoras', 'doadora_id, viaveis', 'doadora_id', doadoraIds);

                const statsMap = new Map<string, { total: number; soma: number }>();
                aspiracoes?.forEach((a: any) => {
                    const s = statsMap.get(a.doadora_id) || { total: 0, soma: 0 };
                    s.total++;
                    s.soma += a.viaveis || 0;
                    statsMap.set(a.doadora_id, s);
                });

                let resultado = doadoras.map(d => {
                    const s = statsMap.get(d.id) || { total: 0, soma: 0 };
                    return {
                        nome: d.nome || d.registro || d.id.substring(0, 8),
                        registro: d.registro,
                        raca: d.raca,
                        totalAspiracoes: s.total,
                        mediaOocitos: s.total > 0 ? Math.round((s.soma / s.total) * 10) / 10 : 0,
                    };
                });

                if (filtros.media_oocitos_max != null) {
                    resultado = resultado.filter(d => d.totalAspiracoes > 0 && d.mediaOocitos <= filtros.media_oocitos_max!);
                }
                if (filtros.media_oocitos_min != null) {
                    resultado = resultado.filter(d => d.totalAspiracoes > 0 && d.mediaOocitos >= filtros.media_oocitos_min!);
                }

                resultado.sort((a, b) => a.mediaOocitos - b.mediaOocitos);

                return {
                    tipo: 'LISTA_DOADORAS',
                    total: resultado.length,
                    animais: resultado.slice(0, 50),
                };
            }

            case 'analise_repetidoras': {
                const filtros = intent.filtros || {};
                const minProtocolos = filtros.protocolos_sem_prenhez_min ?? 3;

                if (receptoraIds.length === 0) return { error: 'Nenhuma receptora vinculada.' };

                // Buscar todos os protocolos de receptoras
                const protocoloRecs = await fetchInChunks('protocolo_receptoras', 'receptora_id, created_at', 'receptora_id', receptoraIds);

                // Buscar última gestação de cada receptora
                const gestacoes = await fetchInChunks(
                    'diagnosticos_gestacao',
                    'receptora_id, data_diagnostico',
                    'receptora_id',
                    receptoraIds,
                    q => q.in('resultado', ['PRENHE', 'PRENHE_RETOQUE', 'PRENHE_FEMEA', 'PRENHE_MACHO']).order('data_diagnostico', { ascending: false })
                );

                // Última gestação por receptora
                const ultimaGestacaoMap = new Map<string, string>();
                gestacoes?.forEach((g: any) => {
                    if (!ultimaGestacaoMap.has(g.receptora_id)) {
                        ultimaGestacaoMap.set(g.receptora_id, g.data_diagnostico);
                    }
                });

                // Contar protocolos por receptora
                const protocoloCountMap = new Map<string, number>();
                const protocoloDesdeUltimaMap = new Map<string, number>();

                protocoloRecs?.forEach((p: any) => {
                    const count = protocoloCountMap.get(p.receptora_id) || 0;
                    protocoloCountMap.set(p.receptora_id, count + 1);

                    const ultimaGest = ultimaGestacaoMap.get(p.receptora_id);
                    if (!ultimaGest || p.created_at > ultimaGest) {
                        const countDesde = protocoloDesdeUltimaMap.get(p.receptora_id) || 0;
                        protocoloDesdeUltimaMap.set(p.receptora_id, countDesde + 1);
                    }
                });

                // Filtrar repetidoras
                const repetidoraIds = Array.from(protocoloDesdeUltimaMap.entries())
                    .filter(([, count]) => count >= minProtocolos)
                    .map(([id]) => id);

                if (repetidoraIds.length === 0) {
                    return { tipo: 'ANALISE_REPETIDORAS', total: 0, animais: [] };
                }

                // Buscar identificação
                const recsInfo = await fetchInChunks('receptoras', 'id, identificacao', 'id', repetidoraIds);

                const nomeMap = new Map((recsInfo || []).map((r: any) => [r.id, r.identificacao || r.id.substring(0, 8)]));

                const animais = repetidoraIds
                    .map(id => ({
                        identificacao: nomeMap.get(id) || id.substring(0, 8),
                        totalProtocolos: protocoloCountMap.get(id) || 0,
                        protocolosSemPrenhez: protocoloDesdeUltimaMap.get(id) || 0,
                        ultimaGestacao: ultimaGestacaoMap.get(id) || null,
                    }))
                    .sort((a, b) => b.protocolosSemPrenhez - a.protocolosSemPrenhez);

                return {
                    tipo: 'ANALISE_REPETIDORAS',
                    total: animais.length,
                    minProtocolos,
                    animais: animais.slice(0, 50),
                };
            }

            case 'proximos_partos': {
                const filtros = intent.filtros || {};
                // Partos: sem horizonte — mostra todos os previstos, ordenados pelo mais próximo
                const today = todayISO();

                // Buscar TODAS as prenhes primeiro (com e sem data de parto)
                const { data: todasPrenhes, error: partosErr } = await supabase
                    .from('receptoras')
                    .select('id, identificacao, status_reprodutivo, data_provavel_parto')
                    .in('fazenda_atual_id', farmIds)
                    .like('status_reprodutivo', 'PRENHE%');

                if (partosErr) throw partosErr;

                const totalPrenhes = (todasPrenhes || []).length;
                const comDataParto = (todasPrenhes || []).filter(r => r.data_provavel_parto);
                const semDataParto = totalPrenhes - comDataParto.length;
                let animais = comDataParto.map(r => {
                    const diasRestantes = diffDays(today, r.data_provavel_parto!);
                    return {
                        identificacao: r.identificacao || r.id.substring(0, 8),
                        status: r.status_reprodutivo,
                        dataPartoPrevista: r.data_provavel_parto,
                        diasRestantes,
                        urgencia: diasRestantes <= 0 ? 'atrasado' : diasRestantes <= 7 ? 'urgente' : diasRestantes <= 30 ? 'proximo' : 'normal',
                    };
                });

                // Ordenar por data
                animais.sort((a, b) => a.diasRestantes - b.diasRestantes);

                const urgentes = animais.filter(a => a.urgencia === 'urgente' || a.urgencia === 'atrasado').length;

                // Se 0 com data de parto, explicar
                if (animais.length === 0 && totalPrenhes > 0) {
                    return {
                        tipo: 'PROXIMOS_PARTOS',
                        total: 0,
                        totalGeral: totalPrenhes,
                        motivo: `${totalPrenhes} receptora(s) prenhe(s) encontrada(s), mas nenhuma tem data de parto prevista cadastrada.`,
                        animais: [],
                    };
                }

                return {
                    tipo: 'PROXIMOS_PARTOS',
                    total: animais.length,
                    urgentes,
                    animais: animais.slice(0, 50),
                };
            }

            case 'proximos_servicos': {
                const filtros = intent.filtros || {};
                const horizonte = filtros.horizonte_dias ?? 30;
                const today = todayISO();

                // Buscar receptoras por status relevante
                const { data: recs, error: servErr } = await supabase
                    .from('receptoras')
                    .select('id, identificacao, status_reprodutivo, fazenda_atual_id')
                    .in('fazenda_atual_id', farmIds)
                    .in('status_reprodutivo', ['EM_SINCRONIZACAO', 'SINCRONIZADA', 'SERVIDA', 'PRENHE', 'PRENHE_RETOQUE']);

                if (servErr) throw servErr;
                if (!recs || recs.length === 0) return { tipo: 'PROXIMOS_SERVICOS', total: 0, itens: [] };

                const recIds = recs.map(r => r.id);

                // Buscar protocolos ativos (para 2ºPasso e TE)
                const { data: protRecs } = await supabase
                    .from('protocolo_receptoras')
                    .select('receptora_id, protocolo_id, status')
                    .in('receptora_id', recIds)
                    .in('status', ['INICIADA', 'APTA', 'UTILIZADA']);

                const protocoloIds = [...new Set((protRecs || []).map(p => p.protocolo_id))];

                let protocoloDataMap = new Map<string, string>();
                if (protocoloIds.length > 0) {
                    const { data: prots } = await supabase
                        .from('protocolos_sincronizacao')
                        .select('id, data_inicio')
                        .in('id', protocoloIds);
                    prots?.forEach(p => protocoloDataMap.set(p.id, p.data_inicio));
                }

                // Map receptora → protocolo data_inicio
                const recProtDataMap = new Map<string, string>();
                protRecs?.forEach(p => {
                    const dataInicio = protocoloDataMap.get(p.protocolo_id);
                    if (dataInicio) recProtDataMap.set(p.receptora_id, dataInicio);
                });

                // Buscar data_te para DG e Sexagem
                const servidasPrenhesIds = recs
                    .filter(r => ['SERVIDA', 'PRENHE', 'PRENHE_RETOQUE'].includes(r.status_reprodutivo))
                    .map(r => r.id);

                const teDateMap = new Map<string, string>();
                if (servidasPrenhesIds.length > 0) {
                    const { data: tes } = await supabase
                        .from('transferencias_embrioes')
                        .select('receptora_id, data_te')
                        .in('receptora_id', servidasPrenhesIds)
                        .eq('status_te', 'REALIZADA')
                        .order('data_te', { ascending: false });
                    tes?.forEach(te => {
                        if (!teDateMap.has(te.receptora_id)) teDateMap.set(te.receptora_id, te.data_te);
                    });
                }

                // Computar próxima etapa
                type ServicoItem = {
                    identificacao: string;
                    etapa: string;
                    dataEsperada: string;
                    diasRestantes: number;
                    urgencia: string;
                };

                const itens: ServicoItem[] = [];

                recs.forEach(r => {
                    const id = r.identificacao || r.id.substring(0, 8);
                    const status = r.status_reprodutivo;

                    if (status === 'EM_SINCRONIZACAO') {
                        const dataInicio = recProtDataMap.get(r.id);
                        if (dataInicio) {
                            const dataPasso2 = addDaysISO(dataInicio, PASSO2.IDEAL_MIN);
                            const dias = diffDays(today, dataPasso2);
                            itens.push({ identificacao: id, etapa: '2º Passo', dataEsperada: dataPasso2, diasRestantes: dias, urgencia: dias <= 0 ? 'atrasado' : dias <= 2 ? 'urgente' : 'normal' });
                        }
                    } else if (status === 'SINCRONIZADA') {
                        const dataInicio = recProtDataMap.get(r.id);
                        if (dataInicio) {
                            const dataTE = addDaysISO(dataInicio, PASSO2.IDEAL_MIN + TE.DIAS_APOS_PASSO2);
                            const dias = diffDays(today, dataTE);
                            itens.push({ identificacao: id, etapa: 'TE', dataEsperada: dataTE, diasRestantes: dias, urgencia: dias <= 0 ? 'atrasado' : dias <= 2 ? 'urgente' : 'normal' });
                        }
                    } else if (status === 'SERVIDA') {
                        const dataTE = teDateMap.get(r.id);
                        if (dataTE) {
                            const dataDG = addDaysISO(dataTE, DG.MIN_DIAS - TE.DIA_EMBRIAO);
                            const dias = diffDays(today, dataDG);
                            itens.push({ identificacao: id, etapa: 'DG', dataEsperada: dataDG, diasRestantes: dias, urgencia: dias <= 0 ? 'atrasado' : dias <= 3 ? 'urgente' : 'normal' });
                        }
                    } else if (status === 'PRENHE' || status === 'PRENHE_RETOQUE') {
                        const dataTE = teDateMap.get(r.id);
                        if (dataTE) {
                            const dataSex = addDaysISO(dataTE, SEXAGEM.MIN_DIAS - TE.DIA_EMBRIAO);
                            const dias = diffDays(today, dataSex);
                            itens.push({ identificacao: id, etapa: 'Sexagem', dataEsperada: dataSex, diasRestantes: dias, urgencia: dias <= 0 ? 'atrasado' : dias <= 3 ? 'urgente' : 'normal' });
                        }
                    }
                });

                // Filtrar por etapa se especificado
                let filtrado = itens;
                if (filtros.etapa_proxima) {
                    const etapaMap: Record<string, string> = {
                        dg: 'DG', sexagem: 'Sexagem', te: 'TE', passo2: '2º Passo'
                    };
                    const alvo = etapaMap[filtros.etapa_proxima.toLowerCase()] || filtros.etapa_proxima;
                    filtrado = filtrado.filter(i => i.etapa === alvo);
                }

                // Filtrar por horizonte
                filtrado = filtrado.filter(i => i.diasRestantes <= horizonte);

                // Ordenar por data
                filtrado.sort((a, b) => a.diasRestantes - b.diasRestantes);

                const urgentes = filtrado.filter(i => i.urgencia === 'urgente' || i.urgencia === 'atrasado').length;
                const passados = filtrado.filter(i => i.diasRestantes < 0).length;

                return {
                    tipo: 'PROXIMOS_SERVICOS',
                    total: filtrado.length,
                    urgentes,
                    passados,
                    itens: filtrado.slice(0, 30),
                };
            }

            case 'relatorio_protocolos': {
                const { data: prots, error: protErr } = await supabase
                    .from('protocolos_sincronizacao')
                    .select('id, data_inicio, status')
                    .in('fazenda_id', farmIds)
                    .gte('data_inicio', dataInicio);

                if (protErr) throw protErr;

                if (!prots || prots.length === 0) {
                    return { tipo: 'PROTOCOLOS', totalProtocolos: 0, totalReceptoras: 0, aptas: 0, inaptas: 0 };
                }

                const protIds = prots.map(p => p.id);

                const { data: protRecs } = await supabase
                    .from('protocolo_receptoras')
                    .select('id, status')
                    .in('protocolo_id', protIds);

                const totalReceptoras = protRecs?.length || 0;
                const aptas = protRecs?.filter(r => r.status === 'APTA' || r.status === 'UTILIZADA').length || 0;
                const inaptas = protRecs?.filter(r => r.status === 'INAPTA').length || 0;

                return {
                    tipo: 'PROTOCOLOS',
                    periodo: `${limitMeses} meses`,
                    totalProtocolos: prots.length,
                    totalReceptoras,
                    aptas,
                    inaptas,
                };
            }

            case 'nascimentos': {
                if (farmIds.length === 0) return { error: 'Nenhuma fazenda vinculada.' };

                const { data: animaisNasc, error: nascErr } = await supabase
                    .from('animais')
                    .select('id, sexo, created_at')
                    .in('fazenda_id', farmIds)
                    .gte('created_at', dataInicio);
                if (nascErr) throw nascErr;

                const machos = (animaisNasc || []).filter(a => a.sexo === 'MACHO').length;
                const femeas = (animaisNasc || []).filter(a => a.sexo === 'FÊMEA' || a.sexo === 'FEMEA').length;

                return {
                    tipo: 'NASCIMENTOS',
                    periodo: `${limitMeses} meses`,
                    total: (animaisNasc || []).length,
                    machos,
                    femeas,
                };
            }

            case 'estoque_semen': {
                if (farmIds.length === 0) return { error: 'Nenhuma fazenda vinculada.' };

                const { data: doses, error: dosesErr } = await supabase
                    .from('doses_semen')
                    .select('id, touro_id, quantidade')
                    .in('fazenda_id', farmIds)
                    .gt('quantidade', 0);
                if (dosesErr) throw dosesErr;

                if (!doses || doses.length === 0) return { tipo: 'ESTOQUE_SEMEN', total: 0, itens: [] };

                // Buscar nomes dos touros
                const touroIds = [...new Set(doses.map(d => d.touro_id))];
                const { data: touros } = await supabase
                    .from('touros')
                    .select('id, nome, raca')
                    .in('id', touroIds);
                const touroMap = new Map((touros || []).map(t => [t.id, { nome: t.nome, raca: t.raca }]));

                // Agrupar por touro
                const estoqueMap = new Map<string, { touro: string; raca: string | null; doses: number }>();
                doses.forEach(d => {
                    const info = touroMap.get(d.touro_id) || { nome: d.touro_id.substring(0, 8), raca: null };
                    const key = d.touro_id;
                    const entry = estoqueMap.get(key) || { touro: info.nome, raca: info.raca, doses: 0 };
                    entry.doses += d.quantidade || 0;
                    estoqueMap.set(key, entry);
                });

                const itens = Array.from(estoqueMap.values()).sort((a, b) => b.doses - a.doses);
                const totalDoses = itens.reduce((sum, i) => sum + i.doses, 0);

                return {
                    tipo: 'ESTOQUE_SEMEN',
                    total: totalDoses,
                    tourosComEstoque: itens.length,
                    itens: itens.slice(0, 30),
                };
            }

            case 'estoque_embrioes': {
                if (farmIds.length === 0) return { error: 'Nenhuma fazenda vinculada.' };

                const { data: embrioes, error: embErr } = await supabase
                    .from('embrioes')
                    .select('id, classificacao, status_embriao')
                    .in('fazenda_id', farmIds)
                    .eq('status_embriao', 'CONGELADO');
                if (embErr) throw embErr;

                if (!embrioes || embrioes.length === 0) return { tipo: 'ESTOQUE_EMBRIOES', total: 0, itens: [] };

                // Agrupar por classificação
                const classMap = new Map<string, number>();
                embrioes.forEach(e => {
                    const cls = e.classificacao || 'N/C';
                    classMap.set(cls, (classMap.get(cls) || 0) + 1);
                });

                const itens = Array.from(classMap.entries())
                    .map(([classificacao, quantidade]) => ({ classificacao, quantidade }))
                    .sort((a, b) => b.quantidade - a.quantidade);

                return {
                    tipo: 'ESTOQUE_EMBRIOES',
                    total: embrioes.length,
                    itens,
                };
            }

            case 'desempenho_touro': {
                if (receptoraIds.length === 0) return { error: 'Nenhuma receptora vinculada.' };

                // Buscar DGs com resultado
                const dgs = await fetchInChunks(
                    'diagnosticos_gestacao',
                    'id, receptora_id, resultado',
                    'receptora_id',
                    receptoraIds,
                    q => q.eq('tipo_diagnostico', 'DG').gte('data_diagnostico', dataInicio)
                );

                if (!dgs || dgs.length === 0) return { tipo: 'DESEMPENHO_TOURO', veterinarios: [] };

                // Buscar TEs para ligar receptora → embrião → dose → touro
                const dgRecIds = [...new Set(dgs.map((d: any) => d.receptora_id))];
                const tes = await fetchInChunks(
                    'transferencias_embrioes',
                    'receptora_id, embriao_id',
                    'receptora_id',
                    dgRecIds,
                    q => q.eq('status_te', 'REALIZADA')
                );

                if (!tes || tes.length === 0) return { tipo: 'DESEMPENHO_TOURO', veterinarios: [] };

                const embriaoIds = [...new Set(tes.map((t: any) => t.embriao_id).filter(Boolean))];
                const recEmbriaoMap = new Map<string, string>();
                tes.forEach((t: any) => { if (t.embriao_id) recEmbriaoMap.set(t.receptora_id, t.embriao_id); });

                // Buscar embriões → acasalamento → dose → touro
                const embrioesData = await fetchInChunks('embrioes', 'id, lote_fiv_acasalamento_id', 'id', embriaoIds);

                const acasalamentoIds = [...new Set((embrioesData || []).map((e: any) => e.lote_fiv_acasalamento_id).filter(Boolean))];
                const embriaoAcMap = new Map((embrioesData || []).map((e: any) => [e.id, e.lote_fiv_acasalamento_id]));

                let acDoseMap = new Map<string, string>();
                if (acasalamentoIds.length > 0) {
                    const acasData = await fetchInChunks('lote_fiv_acasalamentos', 'id, dose_semen_id', 'id', acasalamentoIds);
                    acasData?.forEach((a: any) => { if (a.dose_semen_id) acDoseMap.set(a.id, a.dose_semen_id); });
                }

                const doseIds = [...new Set(Array.from(acDoseMap.values()))];
                let doseTouroMap = new Map<string, string>();
                if (doseIds.length > 0) {
                    const dosesData = await fetchInChunks('doses_semen', 'id, touro_id', 'id', doseIds);
                    dosesData?.forEach((d: any) => doseTouroMap.set(d.id, d.touro_id));
                }

                const touroIds = [...new Set(Array.from(doseTouroMap.values()))];
                let touroNomeMap = new Map<string, string>();
                if (touroIds.length > 0) {
                    const tourosData = await fetchInChunks('touros', 'id, nome', 'id', touroIds);
                    tourosData?.forEach((t: any) => touroNomeMap.set(t.id, t.nome));
                }

                // Mapear receptora → touro
                const recTouroMap = new Map<string, string>();
                dgRecIds.forEach(recId => {
                    const embId = recEmbriaoMap.get(recId);
                    if (!embId) return;
                    const acId = embriaoAcMap.get(embId);
                    if (!acId) return;
                    const doseId = acDoseMap.get(acId);
                    if (!doseId) return;
                    const touroId = doseTouroMap.get(doseId);
                    if (touroId) recTouroMap.set(recId, touroId);
                });

                // Agrupar DGs por touro
                const touroStatsMap = new Map<string, { total: number; prenhes: number }>();
                dgs.forEach(dg => {
                    const touroId = recTouroMap.get(dg.receptora_id);
                    if (!touroId) return;
                    const entry = touroStatsMap.get(touroId) || { total: 0, prenhes: 0 };
                    entry.total++;
                    if (dg.resultado?.startsWith('PRENHE')) entry.prenhes++;
                    touroStatsMap.set(touroId, entry);
                });

                const veterinarios = Array.from(touroStatsMap.entries())
                    .map(([touroId, stats]) => ({
                        nome: touroNomeMap.get(touroId) || touroId.substring(0, 8),
                        total: stats.total,
                        prenhes: stats.prenhes,
                        taxa: stats.total > 0 ? `${((stats.prenhes / stats.total) * 100).toFixed(1)}%` : '0.0%',
                    }))
                    .sort((a, b) => parseFloat(b.taxa) - parseFloat(a.taxa));

                return {
                    tipo: 'DESEMPENHO_TOURO',
                    periodo: `${limitMeses} meses`,
                    veterinarios,
                };
            }

            case 'comparacao_fazendas': {
                if (farmIds.length === 0) return { error: 'Nenhuma fazenda vinculada.' };

                // Buscar fazendas
                const { data: fazendas } = await supabase
                    .from('fazendas')
                    .select('id, nome')
                    .in('id', farmIds);
                const fazNomeMap = new Map((fazendas || []).map(f => [f.id, f.nome]));

                // Buscar receptoras por fazenda
                const { data: recs, error: recErr } = await supabase
                    .from('receptoras')
                    .select('id, fazenda_atual_id, status_reprodutivo')
                    .in('fazenda_atual_id', farmIds);
                if (recErr) throw recErr;

                // Buscar DGs no período
                const recIds = (recs || []).map((r: any) => r.id);
                let dgData: { receptora_id: string; resultado: string }[] = [];
                if (recIds.length > 0) {
                    const dgs = await fetchInChunks(
                        'diagnosticos_gestacao',
                        'receptora_id, resultado',
                        'receptora_id',
                        recIds,
                        q => q.eq('tipo_diagnostico', 'DG').gte('data_diagnostico', dataInicio)
                    );
                    dgData = dgs || [];
                }

                // Mapear receptora → fazenda
                const recFazMap = new Map((recs || []).map(r => [r.id, r.fazenda_atual_id]));

                // Agrupar por fazenda
                const fazStatsMap = new Map<string, { total: number; prenhes: number }>();
                dgData.forEach(dg => {
                    const fazId = recFazMap.get(dg.receptora_id);
                    if (!fazId) return;
                    const entry = fazStatsMap.get(fazId) || { total: 0, prenhes: 0 };
                    entry.total++;
                    if (dg.resultado?.startsWith('PRENHE')) entry.prenhes++;
                    fazStatsMap.set(fazId, entry);
                });

                const veterinarios = Array.from(fazStatsMap.entries())
                    .map(([fazId, stats]) => ({
                        nome: fazNomeMap.get(fazId) || fazId.substring(0, 8),
                        total: stats.total,
                        prenhes: stats.prenhes,
                        taxa: stats.total > 0 ? `${((stats.prenhes / stats.total) * 100).toFixed(1)}%` : '0.0%',
                    }))
                    .sort((a, b) => parseFloat(b.taxa) - parseFloat(a.taxa));

                return {
                    tipo: 'COMPARACAO_FAZENDAS',
                    periodo: `${limitMeses} meses`,
                    veterinarios,
                };
            }

            case 'resumo_geral':
            default: {
                if (farmIds.length === 0) return { tipo: 'RESUMO', mensagem: 'Nenhuma fazenda vinculada.' };

                const today = todayISO();

                // 3 queries em paralelo com farmIds (seguro pra url)
                const [recResult, doaResult, aniResult] = await Promise.all([
                    supabase.from('receptoras')
                        .select('id, status_reprodutivo, data_provavel_parto')
                        .in('fazenda_atual_id', farmIds),
                    supabase.from('doadoras')
                        .select('id')
                        .in('fazenda_id', farmIds),
                    supabase.from('animais')
                        .select('id')
                        .in('fazenda_id', farmIds),
                ]);

                // Query perigosa pra limite de URL extraída para chunk
                const dgs = await fetchInChunks(
                    'diagnosticos_gestacao',
                    'id, resultado',
                    'receptora_id',
                    receptoraIds.length > 0 ? receptoraIds : ['__none__'],
                    q => q.eq('tipo_diagnostico', 'DG').gte('data_diagnostico', dataInicio)
                );

                const recs = recResult.data || [];
                const totalReceptoras = recs.length;
                const prenhes = recs.filter((r: any) => r.status_reprodutivo?.includes('PRENHE')).length;
                const vazias = recs.filter((r: any) => r.status_reprodutivo === 'VAZIA').length;
                const partosProximos = recs.filter((r: any) => {
                    if (!r.data_provavel_parto) return false;
                    return diffDays(today, r.data_provavel_parto) >= 0 && diffDays(today, r.data_provavel_parto) <= 30;
                }).length;

                const totalDoadoras = (doaResult.data || []).length;
                const totalAnimais = (aniResult.data || []).length;

                const totalDGs = dgs.length;
                const dgPositivos = dgs.filter((d: any) => d.resultado?.startsWith('PRENHE')).length;
                const taxaPrenhez = totalDGs > 0 ? `${((dgPositivos / totalDGs) * 100).toFixed(1)}%` : 'N/A';

                return {
                    tipo: 'RESUMO',
                    periodo: `${limitMeses} meses`,
                    total: totalReceptoras,
                    prenhes,
                    vazias,
                    totalDoadoras,
                    totalAnimais,
                    taxaPrenhez,
                    partosProximos,
                };
            }
        }
    } catch (err) {
        console.error("Erro ao buscar dados do relatório:", err);
        throw new Error('Falha ao processar dados no banco.');
    }
}
