import { useState, useCallback, useRef } from 'react';
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
} from 'lucide-react';
import { DIAS_MINIMOS } from '@/lib/gestacao';
import { useDiagnosticoGestacao } from '@/hooks/useDiagnosticoGestacao';
import { useToast } from '@/hooks/use-toast';
import EntryModeSwitch from '@/components/escritorio/EntryModeSwitch';
import ReportScanner from '@/components/escritorio/ReportScanner';
import OcrReviewGrid from '@/components/escritorio/OcrReviewGrid';
import { useCloudRunOcr } from '@/hooks/escritorio/useCloudRunOcr';
import { useReportImports } from '@/hooks/escritorio/useReportImports';
import type { EntryMode, OcrResult, OcrRow } from '@/lib/types/escritorio';

export function DiagnosticoSessao() {
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
        handleResultadoChange,
        handleFieldChange,
        showRestaurarDialog,
        setShowRestaurarDialog,
        restaurarRascunho,
        descartarRascunho,
        hoje
    } = useDiagnosticoGestacao();
    const { toast } = useToast();

    // ── OCR state ──
    const [entryMode, setEntryMode] = useState<EntryMode>('manual');
    const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
    const [ocrImageUrl, setOcrImageUrl] = useState<string | undefined>(undefined);
    const [shortcutsDismissed, setShortcutsDismissed] = useState(() =>
        typeof window !== 'undefined' && localStorage.getItem('dg-shortcuts-dismissed') === 'true'
    );

    const { processFile, step: ocrStep, reset: resetOcr } = useCloudRunOcr({
        reportType: 'dg',
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
            let mappedResultado: 'PRENHE' | 'VAZIA' | 'RETOQUE' | '' = '';
            if (['PRENHE', 'P', 'PR'].includes(resultado)) mappedResultado = 'PRENHE';
            else if (['VAZIA', 'V', 'VA'].includes(resultado)) mappedResultado = 'VAZIA';
            else if (['RETOQUE', 'R', 'RET'].includes(resultado)) mappedResultado = 'RETOQUE';

            if (mappedResultado) {
                handleResultadoChange(receptora.receptora_id, mappedResultado);
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
            report_type: 'dg',
            fazenda_id: fazendaSelecionada,
            extracted_data: ocrResult as unknown as Record<string, unknown>,
            status: 'completed',
            completed_at: new Date().toISOString(),
        }).catch(() => { /* non-critical */ });

        setOcrResult(null);
        setOcrImageUrl(undefined);
        resetOcr();
        setEntryMode('manual');
    }, [receptoras, handleResultadoChange, handleFieldChange, toast, resetOcr, createImport, fazendaSelecionada, ocrResult]);

    const handleOcrCancel = useCallback(() => {
        setOcrResult(null);
        setOcrImageUrl(undefined);
        resetOcr();
    }, [resetOcr]);

    // ── Keyboard shortcuts (desktop only) ──
    const dgTableRef = useRef<HTMLDivElement>(null);
    const handleDgKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (loteSelecionado?.status === 'FECHADO') return;

        // Tab navigation between resultado cells
        if (e.key === 'Tab') {
            const active = document.activeElement as HTMLElement;
            if (!active?.hasAttribute('data-resultado-trigger')) return;
            const row = active.closest('[data-row-idx]');
            if (!row || !dgTableRef.current?.contains(row)) return;
            const idx = parseInt(row.getAttribute('data-row-idx') || '-1');
            const nextIdx = e.shiftKey ? idx - 1 : idx + 1;
            if (nextIdx < 0 || nextIdx >= receptoras.length) return;
            e.preventDefault();
            const nextTrigger = dgTableRef.current?.querySelector(`[data-row-idx="${nextIdx}"] [data-resultado-trigger]`) as HTMLElement;
            if (nextTrigger) nextTrigger.focus();
            return;
        }

        const key = e.key.toUpperCase();
        const shortcutMap: Record<string, 'PRENHE' | 'VAZIA' | 'RETOQUE'> = { P: 'PRENHE', V: 'VAZIA', R: 'RETOQUE' };
        const resultado = shortcutMap[key];
        if (!resultado) return;

        // Find which row is focused by checking the closest [data-row-idx]
        const active = document.activeElement as HTMLElement;
        const row = active?.closest('[data-row-idx]');
        if (!row || !dgTableRef.current?.contains(row)) return;

        const idx = parseInt(row.getAttribute('data-row-idx') || '-1');
        if (idx < 0 || idx >= receptoras.length) return;

        e.preventDefault();
        handleResultadoChange(receptoras[idx].receptora_id, resultado);

        // Focus next row's select trigger
        const nextRow = dgTableRef.current?.querySelector(`[data-row-idx="${idx + 1}"] [data-resultado-trigger]`) as HTMLElement;
        if (nextRow) {
            setTimeout(() => nextRow.focus(), 50);
        }
    }, [receptoras, loteSelecionado, handleResultadoChange]);

    const todasReceptorasComResultado = receptoras.every(r => {
        const dados = formData[r.receptora_id];
        return dados && dados.resultado && dados.data_diagnostico;
    });

    const preenchidas = receptoras.filter(r => formData[r.receptora_id]?.resultado).length;
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
                    {/* Grupo: ResponsÃ¡veis */}
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="w-1 h-6 rounded-full bg-primary/40 self-center" />
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground self-center">
                            <User className="w-3.5 h-3.5" />
                            <span>ResponsÃ¡veis</span>
                        </div>
                        <div className="w-[calc(50%-0.75rem)] md:w-auto md:flex-1 md:min-w-[160px]">
                            <label className="text-[10px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">
                                VeterinÃ¡rio *
                            </label>
                            <Input
                                placeholder="Nome do veterinÃ¡rio"
                                value={loteFormData.veterinario_responsavel}
                                onChange={(e) => setLoteFormData(prev => ({ ...prev, veterinario_responsavel: e.target.value }))}
                                className="h-11 md:h-9"
                            />
                        </div>
                        <div className="w-[calc(50%-0.75rem)] md:w-auto md:flex-1 md:min-w-[160px]">
                            <label className="text-[10px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">
                                TÃ©cnico
                            </label>
                            <Input
                                placeholder="Nome do tÃ©cnico"
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
                                onValueChange={setFazendaSelecionada}
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
                                        const diasInsuficientes = lote.dias_gestacao !== undefined && lote.dias_gestacao < DIAS_MINIMOS.DG;
                                        return (
                                            <SelectItem key={lote.id} value={lote.id}>
                                                <span className={diasInsuficientes ? 'text-amber-600' : ''}>
                                                    {formatarData(lote.data_te)} â€¢ {lote.dias_gestacao ?? '?'}d â€¢ {lote.quantidade_receptoras} rec.
                                                    {diasInsuficientes && ' âš ï¸'}
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

                    {/* Grupo: AÃ§Ã£o */}
                    <div className="flex items-end gap-3 w-full md:w-auto md:ml-auto">
                        {/* OCR toggle — desktop */}
                        <div className="hidden md:block">
                            <label className="text-[10px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">
                                Entrada
                            </label>
                            <EntryModeSwitch mode={entryMode} onChange={setEntryMode} />
                        </div>

                        <Button
                            onClick={handleSalvarLote}
                            disabled={
                                !loteSelecionado ||
                                !todasReceptorasComResultado ||
                                submitting ||
                                loteSelecionado?.status === 'FECHADO' ||
                                (loteSelecionado?.dias_gestacao !== undefined && loteSelecionado.dias_gestacao < DIAS_MINIMOS.DG)
                            }
                            className="h-11 md:h-9 px-6 bg-primary hover:bg-primary-dark shadow-sm w-full md:w-auto"
                        >
                            <Save className="w-4 h-4 mr-2" />
                            {submitting ? 'Salvando...' : 'Salvar Lote'}
                        </Button>
                    </div>
                </div>

                {/* Aviso de dias insuficientes */}
                {loteSelecionado && loteSelecionado.dias_gestacao !== undefined && loteSelecionado.dias_gestacao < DIAS_MINIMOS.DG && (
                    <div className="flex items-center gap-2 mt-3 p-2 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                            Este lote estÃ¡ com {loteSelecionado.dias_gestacao} dias. DG requer mÃ­nimo de {DIAS_MINIMOS.DG} dias (faltam {DIAS_MINIMOS.DG - loteSelecionado.dias_gestacao}).
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
                            Escanear Relatório DG
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
                            resultadoLabel="Resultado DG"
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
                                        {receptoras.length} receptora(s) â€¢ TE em {formatarData(loteSelecionado.data_te)}
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
                                    resultado: '',
                                    numero_gestacoes: '',
                                    observacoes: '',
                                    data_diagnostico: hoje,
                                };
                                const isDisabled = loteSelecionado.status === 'FECHADO';

                                return (
                                    <div key={receptora.receptora_id} className="rounded-xl border border-border/60 bg-card shadow-sm p-3.5">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-base">{receptora.brinco}</span>
                                                {receptora.nome && (
                                                    <span className="text-muted-foreground text-xs">({receptora.nome})</span>
                                                )}
                                            </div>
                                            <Badge variant="outline" className="font-mono">
                                                {receptora.dias_gestacao}d
                                            </Badge>
                                        </div>

                                        <div className="text-sm text-muted-foreground mb-3">
                                            {receptora.embrioes.map((embriao) => (
                                                <div key={embriao.te_id}>
                                                    {embriao.doadora_registro || '-'}
                                                    {embriao.touro_nome && ` Ã— ${embriao.touro_nome}`}
                                                    {embriao.embriao_classificacao && (
                                                        <span className="text-xs ml-1">({embriao.embriao_classificacao})</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[10px] text-muted-foreground uppercase mb-1 block">Data DG</label>
                                                <DatePickerBR
                                                    value={dados.data_diagnostico}
                                                    onChange={(value) => handleFieldChange(receptora.receptora_id, 'data_diagnostico', value || '')}
                                                    disabled={isDisabled}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-muted-foreground uppercase mb-1 block">Resultado</label>
                                                <Select
                                                    value={dados.resultado}
                                                    onValueChange={(value) => handleResultadoChange(receptora.receptora_id, value as 'PRENHE' | 'VAZIA' | 'RETOQUE' | '')}
                                                    disabled={isDisabled}
                                                >
                                                    <SelectTrigger className="h-11">
                                                        <SelectValue placeholder="--" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="PRENHE">PRENHE</SelectItem>
                                                        <SelectItem value="VAZIA">VAZIA</SelectItem>
                                                        <SelectItem value="RETOQUE">RETOQUE</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            {(dados.resultado === 'PRENHE' || dados.resultado === 'RETOQUE') && (
                                                <div>
                                                    <label className="text-[10px] text-muted-foreground uppercase mb-1 block">NÂº Gest.</label>
                                                    <Input
                                                        type="number"
                                                        min="1"
                                                        max="3"
                                                        value={dados.numero_gestacoes}
                                                        onChange={(e) => handleFieldChange(receptora.receptora_id, 'numero_gestacoes', e.target.value)}
                                                        className="h-11"
                                                        disabled={isDisabled}
                                                    />
                                                </div>
                                            )}
                                            <div className={(dados.resultado === 'PRENHE' || dados.resultado === 'RETOQUE') ? '' : 'col-span-2'}>
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
                                    Atalhos de teclado: <kbd className="px-1.5 py-0.5 rounded bg-background border text-[11px] font-mono">P</kbd> = Prenhe | <kbd className="px-1.5 py-0.5 rounded bg-background border text-[11px] font-mono">V</kbd> = Vazia | <kbd className="px-1.5 py-0.5 rounded bg-background border text-[11px] font-mono">R</kbd> = Retoque — Foque uma célula de Resultado e pressione a tecla
                                </span>
                                <button
                                    onClick={() => {
                                        setShortcutsDismissed(true);
                                        localStorage.setItem('dg-shortcuts-dismissed', 'true');
                                    }}
                                    className="p-0.5 rounded hover:bg-background"
                                    aria-label="Fechar"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}

                        {/* Desktop table */}
                        <div className="hidden md:block overflow-x-auto" ref={dgTableRef} onKeyDown={handleDgKeyDown}>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Receptora</TableHead>
                                        <TableHead>Dias Gest.</TableHead>
                                        <TableHead>EmbriÃ£o</TableHead>
                                        <TableHead>Doadora Ã— Touro</TableHead>
                                        <TableHead>Data DG</TableHead>
                                        <TableHead>
                                            <span title="Atalhos: P=Prenhe, V=Vazia, R=Retoque">Resultado ⌨</span>
                                        </TableHead>
                                        <TableHead>NÂº Gest.</TableHead>
                                        <TableHead>Obs.</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {receptoras.map((receptora, rowIndex) => {
                                        const dados = formData[receptora.receptora_id] || {
                                            resultado: '',
                                            numero_gestacoes: '',
                                            observacoes: '',
                                            data_diagnostico: hoje,
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
                                                                {embriao.touro_nome && ` Ã— ${embriao.touro_nome}`}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <DatePickerBR
                                                        value={dados.data_diagnostico}
                                                        onChange={(value) => handleFieldChange(receptora.receptora_id, 'data_diagnostico', value || '')}
                                                        className="w-32"
                                                        disabled={isDisabled}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Select
                                                        value={dados.resultado}
                                                        onValueChange={(value) => handleResultadoChange(receptora.receptora_id, value as 'PRENHE' | 'VAZIA' | 'RETOQUE' | '')}
                                                        disabled={isDisabled}
                                                    >
                                                        <SelectTrigger className="w-28 h-9" data-resultado-trigger>
                                                            <SelectValue placeholder="--" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="PRENHE">PRENHE</SelectItem>
                                                            <SelectItem value="VAZIA">VAZIA</SelectItem>
                                                            <SelectItem value="RETOQUE">RETOQUE</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>
                                                <TableCell>
                                                    {dados.resultado === 'PRENHE' || dados.resultado === 'RETOQUE' ? (
                                                        <Input
                                                            type="number"
                                                            min="1"
                                                            max="3"
                                                            value={dados.numero_gestacoes}
                                                            onChange={(e) => handleFieldChange(receptora.receptora_id, 'numero_gestacoes', e.target.value)}
                                                            className="w-16 h-9"
                                                            disabled={isDisabled}
                                                        />
                                                    ) : (
                                                        <span className="text-muted-foreground">-</span>
                                                    )}
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
                        Nenhuma receptora encontrada neste lote
                    </CardContent>
                </Card>
            ) : null}

            {/* OCR FAB — mobile */}
            {loteSelecionado && loteSelecionado.status !== 'FECHADO' && (
                <button
                    onClick={() => setEntryMode(entryMode === 'ocr' ? 'manual' : 'ocr')}
                    className="md:hidden fixed bottom-28 right-4 z-40 h-14 w-14 rounded-full shadow-lg bg-primary text-primary-foreground flex items-center justify-center active:scale-95 transition-transform"
                    aria-label="Escanear Relatório"
                >
                    <Camera className="w-6 h-6" />
                </button>
            )}

            {/* Dialog Restaurar SessÃ£o em Andamento */}
            <AlertDialog open={showRestaurarDialog} onOpenChange={setShowRestaurarDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-primary" />
                            DiagnÃ³stico de gestaÃ§Ã£o nÃ£o finalizado
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            VocÃª tem um diagnÃ³stico de gestaÃ§Ã£o em andamento que nÃ£o foi finalizado. Deseja continuar de onde parou?
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

