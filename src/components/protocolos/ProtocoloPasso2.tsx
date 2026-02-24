import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
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
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Lock, Camera } from 'lucide-react';
import ReportScanner from '@/components/escritorio/ReportScanner';
import OcrReviewGrid from '@/components/escritorio/OcrReviewGrid';
import { useCloudRunOcr } from '@/hooks/escritorio/useCloudRunOcr';
import { useReportImports } from '@/hooks/escritorio/useReportImports';
import type { OcrResult, OcrRow } from '@/lib/types/escritorio';
import DatePickerBR from '@/components/shared/DatePickerBR';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { ProtocoloInfoCard } from '@/components/protocolos/ProtocoloInfoCard';
import { ReceptorasPasso2Table } from '@/components/protocolos/ReceptorasPasso2Table';
import { useProtocoloPasso2Data, useProtocoloPasso2Actions } from '@/hooks/protocoloPasso2';
import { useProtocoloDraft } from '@/hooks/useProtocoloDraft';
import { RascunhoPasso2 } from '@/hooks/useProtocoloDraft';
import { useToast } from '@/hooks/use-toast';

interface ProtocoloPasso2Props {
    onSuccess: () => void;
    protocolosPasso2Lista: Array<{
        id: string;
        fazenda_id: string;
        fazenda_nome: string;
        data_inicio: string;
        receptoras_count: number;
    }>;
    loadingProtocolosPasso2: boolean;
}

export function ProtocoloPasso2({ onSuccess, protocolosPasso2Lista, loadingProtocolosPasso2 }: ProtocoloPasso2Props) {
    const [protocoloSelecionadoId, setProtocoloSelecionadoId] = useState<string>('');
    const [fazendaFilterPasso2, setFazendaFilterPasso2] = useState<string>('');
    const [passo2Form, setPasso2Form] = useState({
        data: new Date().toISOString().split('T')[0],
        tecnico: '',
    });
    const [motivosInapta, setMotivosInapta] = useState<Record<string, string>>({});
    const { toast } = useToast();

    // ── OCR state ──
    const [showOcrScanner, setShowOcrScanner] = useState(false);
    const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
    const [ocrImageUrl, setOcrImageUrl] = useState<string | undefined>(undefined);

    // Rascunho Hook
    const {
        showRestaurarPasso2Dialog,
        setShowRestaurarPasso2Dialog,
        rascunhoPasso2Pendente,
        setRascunhoPasso2Pendente,
        getRascunhoPasso2,
        salvarRascunhoPasso2,
        limparRascunhoPasso2,
        descartarRascunhoPasso2
    } = useProtocoloDraft();

    const rascunhoPasso2VerificadoRef = useRef<string | null>(null);

    const {
        loading: loadingPasso2,
        protocolo: protocoloPasso2,
        setProtocolo: setProtocoloPasso2,
        fazendaNome: fazendaNomePasso2,
        receptoras: receptorasPasso2,
        setReceptoras: setReceptorasPasso2,
        loadData: loadDataPasso2,
    } = useProtocoloPasso2Data();

    const {
        submitting: submittingPasso2,
        handleStatusChange,
        handleMotivoChange,
        handleFinalizarPasso2,
    } = useProtocoloPasso2Actions({
        protocoloId: protocoloSelecionadoId,
        protocolo: protocoloPasso2,
        receptoras: receptorasPasso2,
        setReceptoras: setReceptorasPasso2,
        setProtocolo: setProtocoloPasso2,
        passo2Form,
        motivosInapta,
        onSuccess: () => {
            handleResetPasso2();
            onSuccess();
        },
    });

    // ── OCR hooks ──
    const { processFile, step: ocrStep, reset: resetOcr } = useCloudRunOcr({
        reportType: 'p2',
        fazendaId: fazendaFilterPasso2,
    });
    const { createImport } = useReportImports(fazendaFilterPasso2);

    const handleOcrResult = useCallback((result: unknown) => {
        setOcrResult(result as OcrResult);
    }, []);

    const handleOcrImageUrl = useCallback((url: string) => {
        setOcrImageUrl(url);
    }, []);

    /** Map confirmed OCR rows into receptora status changes */
    const handleOcrConfirm = useCallback((rows: OcrRow[]) => {
        if (!receptorasPasso2.length) {
            toast({ title: 'Nenhuma receptora carregada', description: 'Selecione um protocolo primeiro.', variant: 'destructive' });
            return;
        }

        const statusMap: Record<string, 'APTA' | 'INAPTA'> = {
            APTA: 'APTA', A: 'APTA', OK: 'APTA', SIM: 'APTA', '✓': 'APTA',
            PERDA: 'INAPTA', INAPTA: 'INAPTA', X: 'INAPTA', 'NÃO': 'INAPTA', N: 'INAPTA', P: 'INAPTA',
        };

        let matched = 0;
        rows.forEach(row => {
            const registro = (row.registro.matched_value || row.registro.value || '').trim().toUpperCase();
            if (!registro) return;

            const receptora = receptorasPasso2.find(r =>
                r.identificacao.toUpperCase().trim() === registro ||
                (r.nome && r.nome.toUpperCase().trim() === registro)
            );
            if (!receptora) return;

            const resultado = (row.resultado?.value || '').toUpperCase().trim();
            const status = statusMap[resultado];

            if (status) {
                handleStatusChange(receptora.id, status);
                if (status === 'APTA') {
                    setMotivosInapta(prev => {
                        const updated = { ...prev };
                        delete updated[receptora.id];
                        return updated;
                    });
                }
                matched++;
            }
        });

        toast({
            title: 'Dados OCR aplicados',
            description: `${matched} de ${rows.length} receptora(s) avaliada(s).`,
        });

        createImport({
            report_type: 'p2',
            fazenda_id: fazendaFilterPasso2,
            extracted_data: ocrResult as unknown as Record<string, unknown>,
            status: 'completed',
            completed_at: new Date().toISOString(),
        }).catch(() => { /* non-critical */ });

        setOcrResult(null);
        setOcrImageUrl(undefined);
        setShowOcrScanner(false);
        resetOcr();
    }, [receptorasPasso2, handleStatusChange, toast, resetOcr, createImport, fazendaFilterPasso2, ocrResult]);

    const handleOcrCancel = useCallback(() => {
        setOcrResult(null);
        setOcrImageUrl(undefined);
        resetOcr();
    }, [resetOcr]);

    // Computed

    // Protocolos aguardando 2º passo (filtrado por fazenda se selecionada)
    const protocolosAguardando2Passo = useMemo(() => {
        if (!fazendaFilterPasso2) return protocolosPasso2Lista;
        return protocolosPasso2Lista.filter(p => p.fazenda_id === fazendaFilterPasso2);
    }, [protocolosPasso2Lista, fazendaFilterPasso2]);

    // Lista de fazendas únicas para o filtro do passo 2
    const fazendasPasso2 = useMemo(() => {
        const fazendasMap = new Map<string, string>();
        protocolosPasso2Lista.forEach(p => {
            if (!fazendasMap.has(p.fazenda_id)) {
                fazendasMap.set(p.fazenda_id, p.fazenda_nome);
            }
        });
        return Array.from(fazendasMap.entries()).map(([id, nome]) => ({ id, nome }));
    }, [protocolosPasso2Lista]);

    // Stats do Passo 2
    const statsPasso2 = useMemo(() => ({
        pendentes: receptorasPasso2.filter((r) => r.pr_status === 'INICIADA').length,
        confirmadas: receptorasPasso2.filter((r) => r.pr_status === 'APTA').length,
        descartadas: receptorasPasso2.filter((r) => r.pr_status === 'INAPTA').length,
    }), [receptorasPasso2]);

    const isProtocoloFinalizado = protocoloPasso2?.status === 'SINCRONIZADO';
    const canFinalizePasso2 = statsPasso2.pendentes === 0 && passo2Form.data && passo2Form.tecnico.trim();

    // Effects

    useEffect(() => {
        if (protocoloSelecionadoId) {
            loadDataPasso2(protocoloSelecionadoId);
        }
    }, [protocoloSelecionadoId, loadDataPasso2]);

    // Configurar formulário quando protocolo carrega
    useEffect(() => {
        if (protocoloPasso2) {
            if (protocoloPasso2.passo2_data || protocoloPasso2.passo2_tecnico_responsavel) {
                setPasso2Form({
                    data: protocoloPasso2.passo2_data || new Date().toISOString().split('T')[0],
                    tecnico: protocoloPasso2.passo2_tecnico_responsavel || '',
                });
            }
        }
    }, [protocoloPasso2]);

    // Configurar motivos de inapta quando receptoras carregam
    useEffect(() => {
        if (receptorasPasso2.length > 0) {
            const motivosInaptaLocal: Record<string, string> = {};
            receptorasPasso2
                .filter((r) => r.pr_status === 'INAPTA' && r.pr_motivo_inapta)
                .forEach((r) => {
                    motivosInaptaLocal[r.id] = r.pr_motivo_inapta || '';
                });
            setMotivosInapta(motivosInaptaLocal);
        }
    }, [receptorasPasso2]);

    // Verificar rascunho do passo 2 APÓS receptoras carregarem
    useEffect(() => {
        if (
            protocoloPasso2 &&
            receptorasPasso2.length > 0 &&
            rascunhoPasso2VerificadoRef.current !== protocoloPasso2.id
        ) {
            rascunhoPasso2VerificadoRef.current = protocoloPasso2.id;
            const rascunho = getRascunhoPasso2();
            if (rascunho && rascunho.protocoloSelecionadoId === protocoloPasso2.id) {
                setRascunhoPasso2Pendente(rascunho);
                setShowRestaurarPasso2Dialog(true);
            }
        }
    }, [protocoloPasso2, receptorasPasso2.length, getRascunhoPasso2, setRascunhoPasso2Pendente, setShowRestaurarPasso2Dialog]);

    // Auto-save rascunho passo 2
    useEffect(() => {
        if (protocoloSelecionadoId && receptorasPasso2.length > 0) {
            const timer = setTimeout(() => {
                // Capturar status alterados
                const statusAlterados: Record<string, 'APTA' | 'INAPTA' | 'INICIADA'> = {};
                receptorasPasso2.forEach((r) => {
                    if (r.pr_status) {
                        statusAlterados[r.id] = r.pr_status as 'APTA' | 'INAPTA' | 'INICIADA';
                    }
                });
                salvarRascunhoPasso2({
                    protocoloSelecionadoId,
                    passo2Form,
                    motivosInapta,
                    statusAlterados
                });
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [protocoloSelecionadoId, passo2Form, motivosInapta, receptorasPasso2, salvarRascunhoPasso2]);


    // Handlers
    const handleLocalStatusChange = (receptoraId: string, status: 'APTA' | 'INAPTA' | 'INICIADA') => {
        handleStatusChange(receptoraId, status);
        if (status === 'APTA' || status === 'INICIADA') {
            setMotivosInapta((prev) => {
                const updated = { ...prev };
                delete updated[receptoraId];
                return updated;
            });
        }
    };

    const handleLocalMotivoChange = (receptoraId: string, motivo: string) => {
        handleMotivoChange(receptoraId, motivo);
        setMotivosInapta((prev) => ({
            ...prev,
            [receptoraId]: motivo.trim(),
        }));
    };

    const handleResetPasso2 = () => {
        setProtocoloSelecionadoId('');
        setProtocoloPasso2(null);
        setReceptorasPasso2([]);
        setPasso2Form({
            data: new Date().toISOString().split('T')[0],
            tecnico: '',
        });
        setMotivosInapta({});
        setFazendaFilterPasso2('');
        limparRascunhoPasso2();
    };

    const aplicarRascunhoPasso2 = (rascunho: RascunhoPasso2) => {
        setPasso2Form(rascunho.passo2Form);
        setMotivosInapta(rascunho.motivosInapta);
        // Aplicar status alterados nas receptoras
        if (Object.keys(rascunho.statusAlterados).length > 0) {
            setReceptorasPasso2((prev) =>
                prev.map((r) => ({
                    ...r,
                    pr_status: rascunho.statusAlterados[r.id] || r.pr_status,
                }))
            );
        }
        // Limpar rascunho após aplicar para evitar loop
        limparRascunhoPasso2();
        setRascunhoPasso2Pendente(null);
        setShowRestaurarPasso2Dialog(false);
    };

    const formatarData = (data: string) => {
        if (!data) return '-';
        const [ano, mes, dia] = data.split('-');
        return `${dia}/${mes}/${ano}`;
    };

    return (
        <>
            {!protocoloSelecionadoId ? (
                /* Etapa 1: Seleção do protocolo - Barra Premium */
                <div className="rounded-xl border border-border glass-panel overflow-hidden mb-4">
                    <div className="flex flex-col md:flex-row md:flex-wrap md:items-stretch">
                        {/* Grupo: Responsável */}
                        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b md:border-b-0 md:border-r border-border bg-gradient-to-b from-primary/5 to-transparent">
                            <div className="flex items-center gap-2 w-full md:w-auto">
                                <div className="w-1 h-6 rounded-full bg-primary/40" />
                                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Responsável</span>
                            </div>
                            <Input
                                placeholder="Nome do responsável *"
                                value={passo2Form.tecnico}
                                onChange={(e) => setPasso2Form(prev => ({ ...prev, tecnico: e.target.value }))}
                                className="h-11 md:h-9 w-full md:w-[180px] bg-background/80 border-primary/20 focus:border-primary/40"
                            />
                        </div>

                        {/* Grupo: Fazenda */}
                        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b md:border-b-0 md:border-r border-border">
                            <div className="flex items-center gap-2 w-full md:w-auto">
                                <div className="w-1 h-6 rounded-full bg-primary/40" />
                                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Fazenda</span>
                            </div>
                            <Select
                                value={fazendaFilterPasso2}
                                onValueChange={setFazendaFilterPasso2}
                            >
                                <SelectTrigger className="h-11 md:h-9 w-full md:w-[180px] bg-background">
                                    <SelectValue placeholder="Selecione a fazenda" />
                                </SelectTrigger>
                                <SelectContent>
                                    {fazendasPasso2.map((f) => (
                                        <SelectItem key={f.id} value={f.id}>
                                            {f.nome}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Grupo: Seleção */}
                        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b md:border-b-0 md:border-r border-border md:flex-1">
                            <div className="flex items-center gap-2 w-full md:w-auto">
                                <div className="w-1 h-6 rounded-full bg-primary/40" />
                                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Protocolo</span>
                            </div>
                            <Select
                                value={protocoloSelecionadoId}
                                onValueChange={(value) => {
                                    setProtocoloSelecionadoId(value);
                                }}
                                disabled={!passo2Form.tecnico.trim() || !fazendaFilterPasso2}
                            >
                                <SelectTrigger className="h-11 md:h-9 w-full md:min-w-[280px] bg-background">
                                    <SelectValue placeholder={!fazendaFilterPasso2 ? "Selecione a fazenda primeiro" : "Selecione um protocolo *"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {loadingProtocolosPasso2 ? (
                                        <div className="p-2 text-sm text-muted-foreground text-center">
                                            Carregando...
                                        </div>
                                    ) : protocolosAguardando2Passo.length === 0 ? (
                                        <div className="p-2 text-sm text-muted-foreground text-center">
                                            Nenhum protocolo nesta fazenda
                                        </div>
                                    ) : (
                                        protocolosAguardando2Passo.map((p) => (
                                            <SelectItem key={p.id} value={p.id}>
                                                {p.fazenda_nome} • {formatarData(p.data_inicio)} • {p.receptoras_count} rec.
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                            <DatePickerBR
                                value={passo2Form.data}
                                onChange={(value) => setPasso2Form(prev => ({ ...prev, data: value || '' }))}
                                className="h-11 md:h-9 w-full md:w-[130px] bg-background"
                            />
                        </div>
                    </div>
                </div>
            ) : loadingPasso2 ? (
                /* Loading */
                <Card>
                    <CardContent className="py-8">
                        <LoadingSpinner />
                    </CardContent>
                </Card>
            ) : protocoloPasso2 ? (
                <>
                    {/* Info Card */}
                    <ProtocoloInfoCard
                        fazendaNome={fazendaNomePasso2}
                        dataInicio={protocoloPasso2.data_inicio}
                        veterinario={protocoloPasso2.responsavel_inicio || '-'}
                        tecnico={protocoloPasso2.tecnico_responsavel || '-'}
                        passo2Data={passo2Form.data}
                        passo2Tecnico={passo2Form.tecnico}
                        showPasso2={true}
                    />

                    {/* ── OCR Scanner Panel ── */}
                    {showOcrScanner && !ocrResult && !isProtocoloFinalizado && (
                        <Card className="mt-4">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Camera className="w-4 h-4" />
                                    Escanear Relatório P2
                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">Beta</Badge>
                                </CardTitle>
                                <CardDescription>
                                    Tire uma foto do relatório de campo para avaliar receptoras automaticamente
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
                        <Card className="mt-4">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">Revisar Dados Extraídos</CardTitle>
                                <CardDescription>
                                    Confira os dados antes de aplicar ao protocolo
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <OcrReviewGrid
                                    rows={ocrResult.rows}
                                    imageUrl={ocrImageUrl}
                                    onSave={handleOcrConfirm}
                                    onCancel={handleOcrCancel}
                                    columns={['registro', 'resultado']}
                                    resultadoLabel="Avaliação P2"
                                />
                            </CardContent>
                        </Card>
                    )}

                    {/* Card com tabela */}
                    <Card className="mt-4">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-base">
                                        Receptoras para Avaliação ({receptorasPasso2.length})
                                    </CardTitle>
                                    <CardDescription>
                                        {isProtocoloFinalizado
                                            ? 'Protocolo já finalizado'
                                            : statsPasso2.pendentes > 0
                                                ? `${statsPasso2.pendentes} receptora(s) aguardando avaliação`
                                                : 'Todas as receptoras foram avaliadas'}
                                    </CardDescription>
                                </div>
                                {/* Stats badges + OCR button */}
                                <div className="flex items-center gap-2">
                                    {!isProtocoloFinalizado && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setShowOcrScanner(!showOcrScanner)}
                                            disabled={submittingPasso2}
                                        >
                                            <Camera className="w-4 h-4 mr-1" />
                                            Escanear
                                            <Badge variant="outline" className="ml-1 text-[9px] px-1 py-0">Beta</Badge>
                                        </Button>
                                    )}
                                    <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30">
                                        <CheckCircle className="w-3 h-3 mr-1" />
                                        {statsPasso2.confirmadas} aptas
                                    </Badge>
                                    {statsPasso2.descartadas > 0 && (
                                        <Badge variant="outline" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30">
                                            {statsPasso2.descartadas} inaptas
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <ReceptorasPasso2Table
                                receptoras={receptorasPasso2}
                                motivosInapta={motivosInapta}
                                isFinalized={isProtocoloFinalizado}
                                onStatusChange={handleLocalStatusChange}
                                onMotivoChange={handleLocalMotivoChange}
                                hideCard={true}
                            />
                        </CardContent>
                    </Card>

                    {/* Botões de Ação */}
                    {!isProtocoloFinalizado && (
                        <div className="flex items-center justify-between mt-4">
                            <Button variant="outline" onClick={handleResetPasso2} disabled={submittingPasso2}>
                                Voltar
                            </Button>
                            <Button
                                onClick={handleFinalizarPasso2}
                                disabled={!canFinalizePasso2 || submittingPasso2}
                                className="bg-primary hover:bg-primary-dark"
                            >
                                <Lock className="w-4 h-4 mr-2" />
                                {submittingPasso2 ? 'Finalizando...' : 'Finalizar 2º Passo'}
                            </Button>
                        </div>
                    )}
                </>
            ) : null}

            {/* Dialog para restaurar rascunho do Passo 2 */}
            <AlertDialog open={showRestaurarPasso2Dialog} onOpenChange={setShowRestaurarPasso2Dialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Retomar avaliação anterior?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Foi encontrada uma avaliação do 2º Passo não finalizada para este protocolo. Deseja continuar de onde parou?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={descartarRascunhoPasso2}>
                            Descartar
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => rascunhoPasso2Pendente && aplicarRascunhoPasso2(rascunhoPasso2Pendente)}
                            className="bg-primary hover:bg-primary-dark"
                        >
                            Continuar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
