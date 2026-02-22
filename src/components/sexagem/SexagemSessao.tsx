import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import DatePickerBR from '@/components/shared/DatePickerBR';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    User,
    MapPin,
    Save,
    AlertTriangle,
    Camera,
    X,
    ChevronDown,
} from 'lucide-react';
import { DIAS_MINIMOS } from '@/lib/gestacao';
import { useSexagem } from '@/hooks/useSexagem';
import { useLastSelection } from '@/hooks/core/useLastSelection';
import { useToast } from '@/hooks/use-toast';
import type { ResultadoSexagem } from '@/lib/types/sexagem';
import EntryModeSwitch from '@/components/escritorio/EntryModeSwitch';
import ReportScanner from '@/components/escritorio/ReportScanner';
import OcrReviewGrid from '@/components/escritorio/OcrReviewGrid';
import { useCloudRunOcr } from '@/hooks/escritorio/useCloudRunOcr';
import { useReportImports } from '@/hooks/escritorio/useReportImports';
import type { EntryMode, OcrResult, OcrRow } from '@/lib/types/escritorio';

export function SexagemSessao() {
    const {
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
    } = useSexagem();
    const { toast } = useToast();
    const [lastVet, saveLastVet] = useLastSelection('ultimo-veterinario-sexagem');
    const [lastTec, saveLastTec] = useLastSelection('ultimo-tecnico-sexagem');
    const [lastFazenda, saveLastFazenda] = useLastSelection('ultima-fazenda');
    const didPrePopulate = useRef(false);
    const didPrePopulateFazenda = useRef(false);

    // Pre-populate from last selection (once)
    useEffect(() => {
        if (didPrePopulate.current) return;
        didPrePopulate.current = true;
        if (lastVet && !loteFormData.veterinario_responsavel) {
            setLoteFormData(prev => ({ ...prev, veterinario_responsavel: lastVet }));
        }
        if (lastTec && !loteFormData.tecnico_responsavel) {
            setLoteFormData(prev => ({ ...prev, tecnico_responsavel: lastTec }));
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Pre-populate fazenda from last selection (cross-module)
    useEffect(() => {
        if (didPrePopulateFazenda.current) return;
        if (!fazendas?.length) return;
        didPrePopulateFazenda.current = true;
        if (lastFazenda && !fazendaSelecionada) {
            const existe = fazendas.some(f => f.id === lastFazenda);
            if (existe) setFazendaSelecionada(lastFazenda);
        }
    }, [fazendas]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── OCR state ──
    const [entryMode, setEntryMode] = useState<EntryMode>('manual');
    const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
    const [ocrImageUrl, setOcrImageUrl] = useState<string | undefined>(undefined);
    const [shortcutsDismissed, setShortcutsDismissed] = useState(() =>
        typeof window !== 'undefined' && localStorage.getItem('sexagem-shortcuts-dismissed') === 'true'
    );
    const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

    const { processFile, step: ocrStep, reset: resetOcr } = useCloudRunOcr({
        reportType: 'sexagem',
        fazendaId: fazendaSelecionada,
    });
    const { createImport } = useReportImports(fazendaSelecionada);

    const handleOcrResult = useCallback((result: unknown) => {
        setOcrResult(result as OcrResult);
    }, []);

    const handleOcrImageUrl = useCallback((url: string) => {
        setOcrImageUrl(url);
    }, []);

    /** Map confirmed OCR rows into formData by matching registro/brinco */
    const handleOcrConfirm = useCallback((rows: OcrRow[]) => {
        if (!receptoras.length) {
            toast({ title: 'Nenhuma receptora carregada', description: 'Selecione um lote antes de aplicar os dados do OCR.', variant: 'destructive' });
            return;
        }

        const sexagemMap: Record<string, ResultadoSexagem> = {
            F: 'FEMEA', FEMEA: 'FEMEA', FÊMEA: 'FEMEA',
            M: 'MACHO', MACHO: 'MACHO',
            S: 'SEM_SEXO', SEM_SEXO: 'SEM_SEXO', 'SEM SEXO': 'SEM_SEXO',
            V: 'VAZIA', VAZIA: 'VAZIA',
            D: 'SEM_SEXO', '2_SEXOS': 'SEM_SEXO',
        };

        let matched = 0;
        rows.forEach(row => {
            const registro = (row.registro.matched_value || row.registro.value || '').trim().toUpperCase();
            if (!registro) return;

            const receptora = receptoras.find(r =>
                r.brinco.toUpperCase().trim() === registro ||
                (r.nome && r.nome.toUpperCase().trim() === registro)
            );
            if (!receptora) return;

            const resultado = (row.resultado?.value || '').toUpperCase().trim();
            const mappedSexagem = sexagemMap[resultado];

            if (mappedSexagem) {
                handleSexagemChange(receptora.receptora_id, 0, mappedSexagem);
                matched++;
            }

            const obs = row.obs?.value?.trim();
            if (obs) {
                handleFieldChange(receptora.receptora_id, 'observacoes', obs);
            }
        });

        toast({
            title: 'Dados OCR aplicados',
            description: `${matched} de ${rows.length} linha(s) mapeada(s) para receptoras do lote.`,
        });

        // Record import for audit trail
        createImport({
            report_type: 'sexagem',
            fazenda_id: fazendaSelecionada,
            extracted_data: ocrResult as unknown as Record<string, unknown>,
            status: 'completed',
            completed_at: new Date().toISOString(),
        }).catch(() => { /* non-critical */ });

        setOcrResult(null);
        setOcrImageUrl(undefined);
        resetOcr();
        setEntryMode('manual');
    }, [receptoras, handleSexagemChange, handleFieldChange, toast, resetOcr, createImport, fazendaSelecionada, ocrResult]);

    const handleOcrCancel = useCallback(() => {
        setOcrResult(null);
        setOcrImageUrl(undefined);
        resetOcr();
    }, [resetOcr]);

    // ── Keyboard shortcuts (desktop only) ──
    const sexTableRef = useRef<HTMLDivElement>(null);
    const handleSexKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (loteSelecionado?.status === 'FECHADO') return;

        // Tab navigation between sexagem cells (G1 → G2 → G3 → next row G1)
        if (e.key === 'Tab') {
            const active = document.activeElement as HTMLElement;
            if (!active?.hasAttribute('data-resultado-trigger')) return;
            const row = active.closest('[data-row-idx]');
            if (!row || !sexTableRef.current?.contains(row)) return;
            const rowIdx = parseInt(row.getAttribute('data-row-idx') || '-1');
            if (rowIdx < 0 || rowIdx >= receptoras.length) return;

            const triggers = Array.from(row.querySelectorAll('[data-resultado-trigger]')) as HTMLElement[];
            const currentTriggerIdx = triggers.indexOf(active);

            let nextTrigger: HTMLElement | null = null;
            if (!e.shiftKey) {
                // Forward: next trigger in same row, or first trigger in next row
                if (currentTriggerIdx < triggers.length - 1) {
                    nextTrigger = triggers[currentTriggerIdx + 1];
                } else if (rowIdx + 1 < receptoras.length) {
                    nextTrigger = sexTableRef.current?.querySelector(`[data-row-idx="${rowIdx + 1}"] [data-resultado-trigger]`) as HTMLElement;
                }
            } else {
                // Backward: previous trigger in same row, or last trigger in previous row
                if (currentTriggerIdx > 0) {
                    nextTrigger = triggers[currentTriggerIdx - 1];
                } else if (rowIdx > 0) {
                    const prevTriggers = sexTableRef.current?.querySelectorAll(`[data-row-idx="${rowIdx - 1}"] [data-resultado-trigger]`);
                    if (prevTriggers?.length) nextTrigger = prevTriggers[prevTriggers.length - 1] as HTMLElement;
                }
            }
            if (nextTrigger) {
                e.preventDefault();
                nextTrigger.focus();
            }
            return;
        }

        const key = e.key.toUpperCase();
        const shortcutMap: Record<string, ResultadoSexagem> = {
            F: 'FEMEA', M: 'MACHO', S: 'SEM_SEXO', V: 'VAZIA',
        };
        const resultado = shortcutMap[key];
        if (!resultado) return;

        const active = document.activeElement as HTMLElement;
        const row = active?.closest('[data-row-idx]');
        if (!row || !sexTableRef.current?.contains(row)) return;

        const idx = parseInt(row.getAttribute('data-row-idx') || '-1');
        if (idx < 0 || idx >= receptoras.length) return;

        // Determine which gestacao index this trigger belongs to
        const triggers = Array.from(row.querySelectorAll('[data-resultado-trigger]')) as HTMLElement[];
        const gestacaoIdx = triggers.indexOf(active);

        e.preventDefault();
        handleSexagemChange(receptoras[idx].receptora_id, gestacaoIdx >= 0 ? gestacaoIdx : 0, resultado);

        // Focus next trigger (same row next gestacao, or next row first)
        let nextTrigger: HTMLElement | null = null;
        if (gestacaoIdx < triggers.length - 1) {
            nextTrigger = triggers[gestacaoIdx + 1];
        } else {
            nextTrigger = sexTableRef.current?.querySelector(`[data-row-idx="${idx + 1}"] [data-resultado-trigger]`) as HTMLElement;
        }
        if (nextTrigger) {
            setTimeout(() => nextTrigger!.focus(), 50);
        }
    }, [receptoras, loteSelecionado, handleSexagemChange]);

    const todasReceptorasComSexagem = receptoras.every(r => {
        const dados = formData[r.receptora_id];
        return dados && dados.data_sexagem && dados.sexagens && dados.sexagens.some(s => s);
    });

    const preenchidas = receptoras.filter(r => {
        const dados = formData[r.receptora_id];
        return dados?.sexagens?.some(s => s);
    }).length;
    const progressoPct = receptoras.length > 0 ? Math.round((preenchidas / receptoras.length) * 100) : 0;

    const formatarData = (data: string) => {
        if (!data) return '-';
        const [ano, mes, dia] = data.split('-');
        return `${dia}/${mes}/${ano}`;
    };

    return (
        <div className="mt-4">
            {/* Barra de controles premium */}
            <div className="rounded-xl border border-border bg-gradient-to-r from-card via-card to-muted/30 p-4 mb-4">
                <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end md:gap-6">
                    {/* Grupo: Responsáveis */}
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="w-1 h-6 rounded-full bg-primary/40 self-center" />
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground self-center">
                            <User className="w-3.5 h-3.5" />
                            <span>Responsáveis</span>
                        </div>
                        <div className="w-[calc(50%-0.75rem)] md:w-auto md:flex-1 md:min-w-[160px]">
                            <label className="text-[10px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">
                                Veterinário *
                            </label>
                            <Input
                                placeholder="Nome do veterinário"
                                value={loteFormData.veterinario_responsavel}
                                onChange={(e) => setLoteFormData(prev => ({ ...prev, veterinario_responsavel: e.target.value }))}
                                className="h-11 md:h-9"
                            />
                        </div>
                        <div className="w-[calc(50%-0.75rem)] md:w-auto md:flex-1 md:min-w-[160px]">
                            <label className="text-[10px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">
                                Técnico
                            </label>
                            <Input
                                placeholder="Nome do técnico"
                                value={loteFormData.tecnico_responsavel}
                                onChange={(e) => setLoteFormData(prev => ({ ...prev, tecnico_responsavel: e.target.value }))}
                                className="h-11 md:h-9"
                            />
                        </div>
                    </div>

                    {/* Separador */}
                    <div className="h-10 w-px bg-border hidden md:block" />

                    {/* Grupo: Local */}
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="w-1 h-6 rounded-full bg-emerald-500/40 self-center" />
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground self-center">
                            <MapPin className="w-3.5 h-3.5" />
                            <span>Local</span>
                        </div>
                        <div className="w-full md:w-auto md:flex-1 md:min-w-[160px]">
                            <label className="text-[10px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">
                                Fazenda *
                            </label>
                            <Select
                                value={fazendaSelecionada}
                                onValueChange={(value) => {
                                    setFazendaSelecionada(value);
                                    saveLastFazenda(value);
                                }}
                                disabled={!loteFormData.veterinario_responsavel}
                            >
                                <SelectTrigger className="h-11 md:h-9">
                                    <SelectValue placeholder="Selecione a fazenda" />
                                </SelectTrigger>
                                <SelectContent>
                                    {fazendas.map((fazenda) => (
                                        <SelectItem key={fazenda.id} value={fazenda.id}>
                                            {fazenda.nome}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="w-full md:w-auto md:flex-1 md:min-w-[200px]">
                            <label className="text-[10px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">
                                Lote TE *
                            </label>
                            <Select
                                value={loteSelecionado?.id || ''}
                                onValueChange={(value) => {
                                    const lote = lotesTE.find(l => l.id === value);
                                    setLoteSelecionado(lote || null);
                                }}
                                disabled={!fazendaSelecionada || loadingLotes}
                            >
                                <SelectTrigger className="h-11 md:h-9">
                                    <SelectValue placeholder={loadingLotes ? 'Carregando...' : 'Selecione o lote'} />
                                </SelectTrigger>
                                <SelectContent>
                                    {lotesTE.map((lote) => {
                                        const diasInsuficientes = lote.dias_gestacao !== undefined && lote.dias_gestacao < DIAS_MINIMOS.SEXAGEM;
                                        return (
                                            <SelectItem key={lote.id} value={lote.id}>
                                                <span className={diasInsuficientes ? 'text-amber-600' : ''}>
                                                    {formatarData(lote.data_te)} • {lote.dias_gestacao ?? '?'}d • {lote.quantidade_receptoras} rec.
                                                    {diasInsuficientes && ' ⚠️'}
                                                </span>
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Separador */}
                    <div className="h-10 w-px bg-border hidden md:block" />

                    {/* Grupo: Ação */}
                    <div className="flex items-end gap-3 w-full md:w-auto md:ml-auto">
                        {/* OCR toggle — desktop */}
                        <div className="hidden md:block">
                            <label className="text-[10px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">
                                Entrada
                            </label>
                            <EntryModeSwitch mode={entryMode} onChange={setEntryMode} />
                        </div>

                        {/* OCR button — mobile */}
                        <Button
                            variant="outline"
                            onClick={() => setEntryMode(entryMode === 'ocr' ? 'manual' : 'ocr')}
                            className="md:hidden h-11"
                            disabled={!loteSelecionado}
                        >
                            <Camera className="w-4 h-4 mr-1" />
                            Escanear
                            <Badge variant="outline" className="ml-1 text-[9px] px-1 py-0">Beta</Badge>
                        </Button>

                        <Button
                            onClick={() => {
                                saveLastVet(loteFormData.veterinario_responsavel);
                                saveLastTec(loteFormData.tecnico_responsavel);
                                handleSalvarLote();
                            }}
                            disabled={
                                !loteSelecionado ||
                                !todasReceptorasComSexagem ||
                                submitting ||
                                loteSelecionado?.status === 'FECHADO' ||
                                (loteSelecionado?.dias_gestacao !== undefined && loteSelecionado.dias_gestacao < DIAS_MINIMOS.SEXAGEM)
                            }
                            className="h-11 md:h-9 px-6 bg-primary hover:bg-primary-dark shadow-sm w-full md:w-auto"
                        >
                            <Save className="w-4 h-4 mr-2" />
                            {submitting ? 'Salvando...' : 'Salvar Lote'}
                        </Button>
                    </div>
                </div>

                {/* Aviso de dias insuficientes */}
                {loteSelecionado && loteSelecionado.dias_gestacao !== undefined && loteSelecionado.dias_gestacao < DIAS_MINIMOS.SEXAGEM && (
                    <div className="flex items-center gap-2 mt-3 p-2 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                            Este lote está com {loteSelecionado.dias_gestacao} dias. Sexagem requer mínimo de {DIAS_MINIMOS.SEXAGEM} dias (faltam {DIAS_MINIMOS.SEXAGEM - loteSelecionado.dias_gestacao}).
                        </p>
                    </div>
                )}
            </div>

            {/* ── OCR Scanner Panel ── */}
            {entryMode === 'ocr' && loteSelecionado && !ocrResult && (
                <Card className="mb-4">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Camera className="w-4 h-4" />
                            Escanear Relatório Sexagem
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0">Beta</Badge>
                        </CardTitle>
                        <CardDescription>
                            Tire uma foto do relatório de campo para preencher automaticamente os resultados
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ReportScanner
                            uploadAndProcess={processFile}
                            onResult={handleOcrResult}
                            onImageUrl={handleOcrImageUrl}
                            disabled={ocrStep === 'compressing' || ocrStep === 'sending' || ocrStep === 'processing'}
                        />
                    </CardContent>
                </Card>
            )}

            {/* ── OCR Review Grid ── */}
            {ocrResult && ocrResult.rows.length > 0 && (
                <Card className="mb-4">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Revisar Dados Extraídos</CardTitle>
                        <CardDescription>
                            Confira e corrija os dados antes de aplicar ao lote
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <OcrReviewGrid
                            rows={ocrResult.rows}
                            imageUrl={ocrImageUrl}
                            onSave={handleOcrConfirm}
                            onCancel={handleOcrCancel}
                            columns={['registro', 'resultado', 'obs']}
                            resultadoLabel="Sexagem"
                        />
                    </CardContent>
                </Card>
            )}

            {/* Tabela de Receptoras */}
            {loading ? (
                <Card>
                    <CardContent className="py-8">
                        <LoadingSpinner />
                    </CardContent>
                </Card>
            ) : loteSelecionado && receptoras.length > 0 ? (
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div>
                                    <CardTitle className="text-base">
                                        Receptoras do Lote
                                    </CardTitle>
                                    <CardDescription>
                                        {receptoras.length} receptora(s) • TE em {formatarData(loteSelecionado.data_te)}
                                    </CardDescription>
                                </div>
                                {loteSelecionado.status === 'FECHADO' && (
                                    <Badge variant="secondary">Lote Fechado</Badge>
                                )}
                            </div>
                            {receptoras.length > 0 && (
                                <div className="flex items-center gap-2">
                                    <Badge variant={progressoPct === 100 ? 'default' : 'outline'} className="font-mono text-xs">
                                        {preenchidas}/{receptoras.length}
                                    </Badge>
                                </div>
                            )}
                        </div>
                        {receptoras.length > 0 && (
                            <div className="h-1.5 bg-primary/20 rounded-full mt-2">
                                <div
                                    className="h-full bg-primary rounded-full transition-all duration-300"
                                    style={{ width: `${progressoPct}%` }}
                                />
                            </div>
                        )}
                    </CardHeader>
                    <CardContent className="pt-0">
                        {/* Mobile cards */}
                        <div className="md:hidden space-y-3">
                            {receptoras.map((receptora) => {
                                const dados = formData[receptora.receptora_id] || {
                                    data_sexagem: hoje,
                                    sexagens: new Array(receptora.numero_gestacoes).fill('').map(() => ''),
                                    observacoes: '',
                                };
                                const isDisabled = loteSelecionado.status === 'FECHADO';

                                return (
                                    <div key={receptora.receptora_id} className="rounded-xl border border-border/60 glass-panel shadow-sm p-3.5">
                                        {/* Header: brinco + dias gestacao */}
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-base">{receptora.brinco}</span>
                                                {receptora.nome && <span className="text-muted-foreground text-xs">({receptora.nome})</span>}
                                            </div>
                                            <Badge variant="outline" className="font-mono">{receptora.dias_gestacao}d</Badge>
                                        </div>

                                        {/* Embriao info */}
                                        <div className="text-sm text-muted-foreground mb-3">
                                            {receptora.embrioes.map((embriao) => (
                                                <div key={embriao.te_id}>
                                                    {embriao.doadora_registro || '-'}
                                                    {embriao.touro_nome && ` × ${embriao.touro_nome}`}
                                                </div>
                                            ))}
                                            <span className="text-xs">{`N\u00BA Gesta\u00E7\u00F5es: ${receptora.numero_gestacoes}`}</span>
                                        </div>

                                        {/* Form fields */}
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-[10px] text-muted-foreground uppercase mb-1 block">Data Sexagem</label>
                                                <DatePickerBR
                                                    value={dados.data_sexagem}
                                                    onChange={(value) => handleFieldChange(receptora.receptora_id, 'data_sexagem', value || '')}
                                                    disabled={isDisabled}
                                                />
                                            </div>
                                            {(() => {
                                                const isMulti = receptora.numero_gestacoes > 1;
                                                const cardKey = receptora.receptora_id;
                                                const isExpanded = expandedCards.has(cardKey);
                                                // Auto-expand when G1 is filled
                                                const g1Filled = !!dados.sexagens[0];
                                                const showExtra = isMulti && (isExpanded || g1Filled);

                                                const renderSelect = (index: number, label: string) => (
                                                    <div key={index}>
                                                        <label className="text-[10px] text-muted-foreground uppercase mb-1 block">{label}</label>
                                                        <Select
                                                            value={dados.sexagens[index] || ''}
                                                            onValueChange={(value) => handleSexagemChange(receptora.receptora_id, index, value as ResultadoSexagem | '')}
                                                            disabled={isDisabled}
                                                        >
                                                            <SelectTrigger className="h-11"><SelectValue placeholder="--" /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="FEMEA">Fêmea</SelectItem>
                                                                <SelectItem value="MACHO">Macho</SelectItem>
                                                                <SelectItem value="SEM_SEXO">Sem sexo</SelectItem>
                                                                <SelectItem value="VAZIA">Vazia</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                );

                                                if (!isMulti) {
                                                    return <div>{renderSelect(0, 'Sexagem')}</div>;
                                                }

                                                return (
                                                    <div className="space-y-2">
                                                        {renderSelect(0, 'Gestação 1')}
                                                        {showExtra ? (
                                                            <div className="grid grid-cols-2 gap-2">
                                                                {Array.from({ length: receptora.numero_gestacoes - 1 }, (_, i) =>
                                                                    renderSelect(i + 1, `Gestação ${i + 2}`)
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => setExpandedCards(prev => new Set([...prev, cardKey]))}
                                                                className="flex items-center gap-1 text-xs text-primary hover:underline"
                                                            >
                                                                <ChevronDown className="w-3.5 h-3.5" />
                                                                Mostrar G2{receptora.numero_gestacoes > 2 ? '/G3' : ''}
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                            <div>
                                                <label className="text-[10px] text-muted-foreground uppercase mb-1 block">Obs.</label>
                                                <Input
                                                    value={dados.observacoes}
                                                    onChange={(e) => handleFieldChange(receptora.receptora_id, 'observacoes', e.target.value)}
                                                    placeholder="Obs."
                                                    className="h-11"
                                                    disabled={isDisabled}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Shortcut banner — desktop */}
                        {!shortcutsDismissed && (
                            <div className="hidden md:flex items-center justify-between gap-2 mb-3 px-3 py-2 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                                <span>
                                    Atalhos de teclado: <kbd className="px-1.5 py-0.5 rounded bg-background border text-[11px] font-mono">F</kbd> = Fêmea | <kbd className="px-1.5 py-0.5 rounded bg-background border text-[11px] font-mono">M</kbd> = Macho | <kbd className="px-1.5 py-0.5 rounded bg-background border text-[11px] font-mono">S</kbd> = Sem Sexo | <kbd className="px-1.5 py-0.5 rounded bg-background border text-[11px] font-mono">V</kbd> = Vazia
                                </span>
                                <button
                                    onClick={() => {
                                        setShortcutsDismissed(true);
                                        localStorage.setItem('sexagem-shortcuts-dismissed', 'true');
                                    }}
                                    className="p-0.5 rounded hover:bg-background"
                                    aria-label="Fechar"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}

                        {/* Desktop table */}
                        <div className="hidden md:block overflow-x-auto" ref={sexTableRef} onKeyDown={handleSexKeyDown}>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Receptora</TableHead>
                                        <TableHead>Dias Gest.</TableHead>
                                        <TableHead>Embrião</TableHead>
                                        <TableHead>Doadora × Touro</TableHead>
                                        <TableHead>Nº Gest.</TableHead>
                                        <TableHead>Data Sexagem</TableHead>
                                        <TableHead>
                                            <span title="Atalhos: F=Fêmea, M=Macho, S=Sem sexo, V=Vazia">Sexagem(ns) ⌨</span>
                                        </TableHead>
                                        <TableHead>Obs.</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {receptoras.map((receptora, rowIndex) => {
                                        const dados = formData[receptora.receptora_id] || {
                                            data_sexagem: hoje,
                                            sexagens: new Array(receptora.numero_gestacoes).fill('').map(() => ''),
                                            observacoes: '',
                                        };
                                        const isDisabled = loteSelecionado.status === 'FECHADO';

                                        return (
                                            <TableRow key={receptora.receptora_id} data-row-idx={rowIndex}>
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-2">
                                                        {receptora.brinco}
                                                        {receptora.nome && (
                                                            <span className="text-muted-foreground text-xs">({receptora.nome})</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="font-mono">
                                                        {receptora.dias_gestacao}d
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-0.5">
                                                        {receptora.embrioes.map((embriao, idx) => (
                                                            <div key={embriao.te_id} className="text-sm">
                                                                {embriao.embriao_identificacao || `#${idx + 1}`}
                                                                {embriao.embriao_classificacao && (
                                                                    <span className="text-muted-foreground text-xs ml-1">
                                                                        ({embriao.embriao_classificacao})
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-0.5 text-sm">
                                                        {receptora.embrioes.map((embriao) => (
                                                            <div key={embriao.te_id}>
                                                                {embriao.doadora_registro || '-'}
                                                                {embriao.touro_nome && ` × ${embriao.touro_nome}`}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center font-medium">
                                                    {receptora.numero_gestacoes}
                                                </TableCell>
                                                <TableCell>
                                                    <DatePickerBR
                                                        value={dados.data_sexagem}
                                                        onChange={(value) => handleFieldChange(receptora.receptora_id, 'data_sexagem', value || '')}
                                                        className="w-32"
                                                        disabled={isDisabled}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex gap-1">
                                                        {Array.from({ length: receptora.numero_gestacoes }, (_, index) => {
                                                            const valorAtual = dados.sexagens[index] || '';
                                                            const placeholder = receptora.numero_gestacoes > 1 ? `G${index + 1}` : '--';

                                                            return (
                                                                <Select
                                                                    key={index}
                                                                    value={valorAtual}
                                                                    onValueChange={(value) => handleSexagemChange(receptora.receptora_id, index, value as ResultadoSexagem | '')}
                                                                    disabled={isDisabled}
                                                                >
                                                                    <SelectTrigger className="w-24 h-9" data-resultado-trigger>
                                                                        <SelectValue placeholder={placeholder} />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="FEMEA">Fêmea</SelectItem>
                                                                        <SelectItem value="MACHO">Macho</SelectItem>
                                                                        <SelectItem value="SEM_SEXO">Sem sexo</SelectItem>
                                                                        <SelectItem value="VAZIA">Vazia</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            );
                                                        })}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        value={dados.observacoes}
                                                        onChange={(e) => handleFieldChange(receptora.receptora_id, 'observacoes', e.target.value)}
                                                        placeholder="Obs."
                                                        className="w-32 h-9"
                                                        disabled={isDisabled}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            ) : loteSelecionado && receptoras.length === 0 ? (
                <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                        Nenhuma receptora prenhe encontrada neste lote
                    </CardContent>
                </Card>
            ) : null}

            {/* Dialog Restaurar Sessão em Andamento */}
            <AlertDialog open={showRestaurarDialog} onOpenChange={setShowRestaurarDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-primary" />
                            Sexagem não finalizada
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Você tem uma sessão de sexagem em andamento que não foi finalizada. Deseja continuar de onde parou?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={descartarRascunho}>Descartar</AlertDialogCancel>
                        <AlertDialogAction onClick={restaurarRascunho}>Restaurar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
