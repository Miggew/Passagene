import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { DoadoraLocal, RascunhoAspiracao } from '@/lib/types/aspiracoes';
import { Fazenda, Doadora } from '@/lib/types';
import { todayISO as getTodayDateString } from '@/lib/dateUtils';

const RASCUNHO_KEY = 'passagene_aspiracao_rascunho';
const RASCUNHO_EXPIRACAO_HORAS = 24;

export function useAspiracaoSessao() {
    const { toast } = useToast();

    // State
    const [currentStep, setCurrentStep] = useState<'form' | 'doadoras'>('form');
    const [submitting, setSubmitting] = useState(false);
    const [showRestaurarDialog, setShowRestaurarDialog] = useState(false);

    // Ref-based lock to prevent double-submission (synchronous, not batched like useState)
    const submittingRef = useRef(false);

    // Form Data
    const [formData, setFormData] = useState({
        fazenda_id: '',
        data_aspiracao: getTodayDateString(),
        horario_inicio: '',
        veterinario_responsavel: '',
        tecnico_responsavel: '',
    });

    const [fazendasDestinoIds, setFazendasDestinoIds] = useState<string[]>([]);
    const [doadoras, setDoadoras] = useState<DoadoraLocal[]>([]);

    // Computed
    const temDadosNaoSalvos = useMemo(() => {
        return currentStep === 'doadoras' || doadoras.length > 0;
    }, [currentStep, doadoras.length]);

    const totalOocitos = useMemo(() => {
        return doadoras.reduce((sum, d) => sum + (d.total_oocitos || 0), 0);
    }, [doadoras]);

    // Rascunho Logic
    const getRascunho = useCallback((): RascunhoAspiracao | null => {
        try {
            const raw = localStorage.getItem(RASCUNHO_KEY);
            if (!raw) return null;

            const rascunho: RascunhoAspiracao = JSON.parse(raw);
            const horasPassadas = (Date.now() - rascunho.timestamp) / (1000 * 60 * 60);

            if (horasPassadas > RASCUNHO_EXPIRACAO_HORAS) {
                localStorage.removeItem(RASCUNHO_KEY);
                return null;
            }
            return rascunho;
        } catch {
            return null;
        }
    }, []);

    const salvarRascunho = useCallback(() => {
        const rascunho: RascunhoAspiracao = {
            formData,
            fazendas_destino_ids: fazendasDestinoIds,
            doadoras,
            timestamp: Date.now(),
        };
        localStorage.setItem(RASCUNHO_KEY, JSON.stringify(rascunho));
    }, [formData, fazendasDestinoIds, doadoras]);

    const limparRascunho = useCallback(() => {
        localStorage.removeItem(RASCUNHO_KEY);
    }, []);

    const restaurarRascunho = useCallback(() => {
        const rascunho = getRascunho();
        if (rascunho) {
            setFormData(rascunho.formData);
            setFazendasDestinoIds(rascunho.fazendas_destino_ids);
            setDoadoras(rascunho.doadoras);
            setCurrentStep('doadoras');
            setShowRestaurarDialog(false);
            toast({ title: 'Rascunho restaurado com sucesso!' });
        }
    }, [getRascunho, toast]);

    const descartarRascunho = useCallback(() => {
        limparRascunho();
        setShowRestaurarDialog(false);
        toast({ title: 'Rascunho descartado.' });
    }, [limparRascunho, toast]);

    // Effects
    useEffect(() => {
        const rascunho = getRascunho();
        if (rascunho) {
            setShowRestaurarDialog(true);
        }
    }, [getRascunho]);

    useEffect(() => {
        if (temDadosNaoSalvos) {
            const timer = setTimeout(salvarRascunho, 1000);
            return () => clearTimeout(timer);
        }
    }, [temDadosNaoSalvos, salvarRascunho]);


    // Actions
    const handleContinuar = () => {
        if (!formData.veterinario_responsavel.trim()) {
            toast({ title: 'Veterinário é obrigatório', variant: 'destructive' });
            return;
        }
        if (!formData.tecnico_responsavel.trim()) {
            toast({ title: 'Técnico é obrigatório', variant: 'destructive' });
            return;
        }
        if (!formData.fazenda_id) {
            toast({ title: 'Fazenda é obrigatória', variant: 'destructive' });
            return;
        }
        // if (!formData.data_aspiracao) ... (already handled by date picker default?)

        setCurrentStep('doadoras');
    };

    const handleFinalizar = async () => {
        // Synchronous lock — prevents double-click (React state is async/batched)
        if (submittingRef.current) return;
        submittingRef.current = true;

        try {
            setSubmitting(true);

            // 1. Criar doadoras novas (se houver)
            const doadorasParaCriar = doadoras.filter(d => d.isNew);
            const doadoraIdMap = new Map<string, string>();

            for (const doadora of doadorasParaCriar) {
                const { data: novaDoadora, error } = await supabase
                    .from('doadoras')
                    .insert({
                        fazenda_id: formData.fazenda_id,
                        registro: doadora.registro,
                        nome: doadora.nome || null,
                        raca: doadora.raca || null,
                    })
                    .select()
                    .single();

                if (error) throw error;
                doadoraIdMap.set(doadora.doadora_id, novaDoadora.id);
            }

            // 2. Criar pacote de aspiração
            const { data: pacote, error: pacoteError } = await supabase
                .from('pacotes_aspiracao')
                .insert({
                    fazenda_id: formData.fazenda_id,
                    fazenda_destino_id: fazendasDestinoIds[0] || null, // Legacy support if needed, or null
                    data_aspiracao: formData.data_aspiracao,
                    horario_inicio: formData.horario_inicio || null,
                    veterinario_responsavel: formData.veterinario_responsavel.trim(),
                    tecnico_responsavel: formData.tecnico_responsavel.trim(),
                    total_oocitos: totalOocitos,
                    status: 'FINALIZADO',
                })
                .select()
                .single();

            if (pacoteError) throw pacoteError;

            // 3. Criar fazendas destino (Many-to-Many)
            if (fazendasDestinoIds.length > 0) {
                const fazendasDestinoData = fazendasDestinoIds.map(fazendaId => ({
                    pacote_aspiracao_id: pacote.id,
                    fazenda_destino_id: fazendaId,
                }));
                const { error: fazendasDestinoError } = await supabase
                    .from('pacotes_aspiracao_fazendas_destino')
                    .insert(fazendasDestinoData);

                if (fazendasDestinoError) throw fazendasDestinoError;
            }

            // 4. Criar aspirações (doadoras)
            const aspiracoesData = doadoras.map(doadora => {
                const realDoadoraId = doadora.isNew
                    ? doadoraIdMap.get(doadora.doadora_id)
                    : doadora.doadora_id;

                return {
                    pacote_aspiracao_id: pacote.id,
                    doadora_id: realDoadoraId,
                    fazenda_id: formData.fazenda_id,
                    data_aspiracao: formData.data_aspiracao,
                    horario_aspiracao: doadora.horario_aspiracao || null,
                    hora_final: doadora.hora_final || null,
                    atresicos: doadora.atresicos || 0,
                    degenerados: doadora.degenerados || 0,
                    expandidos: doadora.expandidos || 0,
                    desnudos: doadora.desnudos || 0,
                    viaveis: doadora.viaveis || 0,
                    total_oocitos: doadora.total_oocitos || 0,
                    veterinario_responsavel: formData.veterinario_responsavel.trim(),
                    tecnico_responsavel: formData.tecnico_responsavel.trim(),
                    recomendacao_touro: doadora.recomendacao_touro || null,
                    observacoes: doadora.observacoes || null,
                };
            });

            const { error: aspiracoesError } = await supabase
                .from('aspiracoes_doadoras')
                .insert(aspiracoesData);

            if (aspiracoesError) throw aspiracoesError;

            limparRascunho();
            resetForm();
            toast({
                title: 'Aspiração finalizada com sucesso!',
                description: `${doadoras.length} doadoras processadas.`,
            });

        } catch (error) {
            console.error(error);
            toast({
                title: 'Erro ao finalizar',
                description: error instanceof Error ? error.message : 'Erro desconhecido',
                variant: 'destructive',
            });
        } finally {
            setSubmitting(false);
            submittingRef.current = false;
        }
    };

    const resetForm = () => {
        setFormData({
            fazenda_id: '',
            data_aspiracao: new Date().toISOString().split('T')[0],
            horario_inicio: '',
            veterinario_responsavel: '',
            tecnico_responsavel: '',
        });
        setFazendasDestinoIds([]);
        setDoadoras([]);
        setCurrentStep('form');
    };

    return {
        currentStep,
        setCurrentStep,
        submitting,
        formData,
        setFormData,
        fazendasDestinoIds,
        setFazendasDestinoIds,
        doadoras,
        setDoadoras,
        handleContinuar,
        handleFinalizar,
        showRestaurarDialog,
        setShowRestaurarDialog,
        restaurarRascunho,
        descartarRascunho,
        temDadosNaoSalvos
    };
}
