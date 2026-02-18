import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, AlertTriangle, Microscope, Save, CheckCircle, Activity, Info, Snowflake } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useEmbryoAnalysis, EnrichedEmbryoScore } from '@/hooks/useEmbryoAnalysis';
import { useEmbryoscoreUrl } from '@/hooks/useStorageUrl';

export default function EmbryoWorkbench() {
    const { data: pendingReviews, loading, refresh, updateLocalItem } = useEmbryoAnalysis();
    const [selectedEmbryo, setSelectedEmbryo] = useState<EnrichedEmbryoScore | null>(null);
    const [manualGrade, setManualGrade] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Generate signed URLs for selected embryo
    const { data: plateFrameUrl } = useEmbryoscoreUrl(selectedEmbryo?.plate_frame_path);
    const { data: cropImageUrl } = useEmbryoscoreUrl(selectedEmbryo?.crop_image_path);

    // Auto-select first if available and none selected
    React.useEffect(() => {
        if (pendingReviews.length > 0 && !selectedEmbryo) {
            setSelectedEmbryo(pendingReviews[0]);
        } else if (selectedEmbryo) {
            // Update selected if list updates (e.g. after save)
            const updated = pendingReviews.find(p => p.id === selectedEmbryo.id);
            if (updated) setSelectedEmbryo(updated);
        }
    }, [pendingReviews]);

    // Action handlers
    async function handleDecision(action: 'APPROVE' | 'CORRECT' | 'FREEZE' | 'DISCARD', grade?: string) {
        if (!selectedEmbryo) return;
        setIsSaving(true);
        const finalGrade = grade || manualGrade || selectedEmbryo.classification;

        try {
            // 1. Update Embryo Score (Feedback Loop)
            const dbUpdates: any = {
                biologo_concorda: action === 'APPROVE' || (action === 'FREEZE' && finalGrade === selectedEmbryo.classification),
                biologo_nota: finalGrade,
                is_current: true
            };

            const { error: scoreErr } = await supabase
                .from('embryo_scores')
                .update(dbUpdates)
                .eq('id', selectedEmbryo.id);
            if (scoreErr) throw scoreErr;

            // 2. Update Embryo Status (The real action)
            const embryoUpdates: any = {};

            if (action === 'FREEZE') {
                embryoUpdates.status_atual = 'CONGELADO';
                embryoUpdates.destino = 'CONGELAMENTO';
                embryoUpdates.data_congelamento = new Date().toISOString();
            } else if (action === 'DISCARD') {
                embryoUpdates.status_atual = 'DESCARTADO';
                embryoUpdates.destino = 'DESCARTE';
            } else if (action === 'APPROVE' || action === 'CORRECT') {
                // Just verifying, maybe mark as evaluated?
                // If it was FRESH, it stays FRESH but we might want to mark as 'reviewed'
                // The prompt says "Aprovar (Manter)" which implies just validating the grade.
            }

            if (Object.keys(embryoUpdates).length > 0) {
                const { error: embErr } = await supabase
                    .from('embrioes')
                    .update(embryoUpdates)
                    .eq('id', selectedEmbryo.embriao_id);
                if (embErr) throw embErr;
            }

            toast.success(`Ação ${action} realizada com sucesso!`);

            // Remove from local list (since it's done)
            // Actually, usually we remove from "Pending" list. 
            // The hook 'useEmbryoAnalysis' filters? It fetches 'is_current: true'.
            // If we just updated it, it matches. 
            // We might want to filter out 'reviewed' ones locally or rely on a 'reviewed_at' column?
            // For now, let's keep it visible but marked.

            updateLocalItem(selectedEmbryo.id, {
                ...selectedEmbryo,
                ...dbUpdates,
                // ui specific flag if needed
            });

            // Auto-advance
            const currentIndex = pendingReviews.findIndex(p => p.id === selectedEmbryo.id);
            if (currentIndex < pendingReviews.length - 1) {
                setSelectedEmbryo(pendingReviews[currentIndex + 1]);
                setManualGrade(null);
            }

        } catch (e: any) {
            toast.error(`Erro: ${e.message}`);
        } finally {
            setIsSaving(false);
        }
    }

    const renderQualityBadge = (grade: string) => {
        const map: Record<string, string> = {
            'Excelente': 'bg-emerald-100 text-emerald-700 border-emerald-200',
            'Bom': 'bg-green-100 text-green-700 border-green-200',
            'Regular': 'bg-yellow-100 text-yellow-700 border-yellow-200',
            'Ruim': 'bg-orange-100 text-orange-700 border-orange-200',
            'Inviável': 'bg-red-100 text-red-700 border-red-200',
        };
        const style = map[grade] || 'bg-slate-100 text-slate-700';
        return <Badge className={`${style} border shadow-sm`}>{grade || 'N/A'}</Badge>;
    };

    const currentGrade = manualGrade || selectedEmbryo?.classification;

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden text-slate-900">
            {/* LEFT SIDEBAR: Queue */}
            <div className="w-72 border-r bg-white flex flex-col pt-16 shadow-sm z-10">
                <div className="p-4 border-b bg-slate-50/50">
                    <h2 className="font-heading font-semibold text-slate-700 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-emerald-600" />
                        Fila de Análise
                    </h2>
                    <div className="flex gap-2 mt-2">
                        <Badge variant="outline" className="bg-white">Total: {pendingReviews.length}</Badge>
                    </div>
                </div>
                <ScrollArea className="flex-1">
                    <div className="divide-y divide-slate-100">
                        {loading && <div className="p-8 text-center text-slate-400 text-sm">Carregando...</div>}
                        {pendingReviews.map((item) => (
                            <div
                                key={item.id}
                                onClick={() => { setSelectedEmbryo(item); setManualGrade(null); }}
                                className={`p-3 cursor-pointer transition-all border-l-4 hover:bg-slate-50
                                    ${selectedEmbryo?.id === item.id
                                        ? 'bg-emerald-50/50 border-emerald-500 shadow-inner'
                                        : 'border-transparent text-slate-600 hover:text-slate-900'}`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-semibold text-sm">
                                        {item.embriao_identificacao}
                                    </span>
                                    {item.biologo_nota && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-400 font-mono">Lote {item.lote_codigo}</span>
                                    {renderQualityBadge(item.classification)}
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </div>

            {/* MAIN CONTENT: Workbench */}
            <div className="flex-1 flex flex-col pt-16 relative overflow-hidden">
                {selectedEmbryo ? (
                    <div className="h-full flex flex-col overflow-y-auto">

                        {/* 1. Header & Actions Toolbar */}
                        <div className="px-6 py-4 bg-white border-b flex justify-between items-center sticky top-0 z-20 shadow-sm">
                            <div>
                                <h1 className="text-2xl font-bold font-heading text-slate-800 flex items-center gap-2">
                                    {selectedEmbryo.embriao_identificacao}
                                    <Badge variant="secondary" className="font-mono font-normal bg-slate-100 text-slate-500">
                                        #{selectedEmbryo.embriao_id.slice(0, 6)}
                                    </Badge>
                                </h1>
                            </div>

                            <div className="flex items-center gap-3">
                                {/* Freeze / Discard Actions */}
                                <div className="h-8 w-px bg-slate-200 mx-1" />

                                <Button
                                    variant="outline"
                                    className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                                    onClick={() => handleDecision('DISCARD')}
                                    disabled={isSaving}
                                >
                                    <AlertTriangle className="w-4 h-4 mr-2" />
                                    Descartar
                                </Button>

                                <Button
                                    className="bg-blue-600 hover:bg-blue-700 text-white"
                                    onClick={() => handleDecision('FREEZE')}
                                    disabled={isSaving}
                                >
                                    <Snowflake className="w-4 h-4 mr-2" />
                                    Congelar ({currentGrade})
                                </Button>

                                <div className="h-8 w-px bg-slate-200 mx-1" />

                                <Button
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200"
                                    onClick={() => handleDecision('APPROVE', currentGrade)}
                                    disabled={isSaving}
                                >
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Aprovar Nota
                                </Button>
                            </div>
                        </div>

                        <div className="flex-1 p-6 grid grid-cols-12 gap-6 max-w-[1600px] mx-auto w-full">

                            {/* 2. Visual Analysis (Left/Center) - Col Span 7 */}
                            <div className="col-span-12 xl:col-span-7 flex flex-col gap-6">
                                {/* Main Visual: Composite or Plate */}
                                <Card className="border-0 shadow-lg bg-black text-white overflow-hidden relative group rounded-xl">
                                    <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/80 to-transparent z-10 flex justify-between">
                                        <Badge variant="outline" className="text-white border-white/20 bg-black/40 backdrop-blur">
                                            Visão Composta (Morfologia + Cinética)
                                        </Badge>
                                        <div className="flex gap-2 text-xs text-white/70">
                                            <span>Mapeamento de Movimento 40 frames</span>
                                        </div>
                                    </div>

                                    <div className="aspect-[16/9] bg-slate-900 relative flex items-center justify-center">
                                        {/* Use Composite Base64 if available for instant load, else secure URL */}
                                        {selectedEmbryo.composite_base64 ? (
                                            <img
                                                src={`data:image/jpeg;base64,${selectedEmbryo.composite_base64}`}
                                                className="h-full object-contain"
                                                alt="Análise Composta"
                                            />
                                        ) : (cropImageUrl ? (
                                            <img src={cropImageUrl} className="h-full object-contain" alt="Crop" />
                                        ) : (
                                            <div className="text-slate-500 flex flex-col items-center">
                                                <Microscope className="w-12 h-12 mb-3 opacity-20" />
                                                <p>Imagem processada não disponível</p>
                                            </div>
                                        ))}
                                    </div>
                                </Card>

                                {/* Context thumbnails */}
                                <div className="grid grid-cols-2 gap-4 h-48">
                                    <Card className="bg-slate-100 border-dashed border-2 flex items-center justify-center relative overflow-hidden">
                                        {plateFrameUrl && (
                                            <>
                                                <img src={plateFrameUrl} className="absolute inset-0 w-full h-full object-cover opacity-50" />
                                                {/* Highlight Box */}
                                                {selectedEmbryo.bbox_x_percent != null && (
                                                    <div
                                                        className="absolute border-2 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)] z-20 rounded-full"
                                                        style={{
                                                            left: `${selectedEmbryo.bbox_x_percent}%`,
                                                            top: `${selectedEmbryo.bbox_y_percent}%`,
                                                            width: `${selectedEmbryo.bbox_width_percent || 10}%`,
                                                            height: `${selectedEmbryo.bbox_height_percent || 10}%`,
                                                            transform: 'translate(-50%, -50%)'
                                                        }}
                                                    />
                                                )}
                                            </>
                                        )}
                                        <span className="relative z-10 bg-white/80 px-2 py-1 rounded text-xs font-semibold">Contexto da Placa</span>
                                    </Card>
                                    <Card className="bg-white p-4 flex flex-col justify-center space-y-2">
                                        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-widest">Métricas Cinéticas</h3>
                                        <div className="space-y-3">
                                            <div>
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span>Intensidade (Movimento)</span>
                                                    <span className="font-mono font-bold">{selectedEmbryo.kinetic_intensity?.toFixed(3)}</span>
                                                </div>
                                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, (selectedEmbryo.kinetic_intensity || 0) * 10)}%` }} />
                                                </div>
                                            </div>
                                            <div>
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span>Estabilidade</span>
                                                    <span className="font-mono font-bold">{selectedEmbryo.kinetic_stability?.toFixed(2)}</span>
                                                </div>
                                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-purple-500" style={{ width: `${((selectedEmbryo.kinetic_stability || 0) * 100)}%` }} />
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                </div>
                            </div>

                            {/* 3. Decision Panel (Right) - Col Span 5 */}
                            <div className="col-span-12 xl:col-span-5 space-y-6">
                                {/* AI Opinion Battle */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 rounded-xl border bg-white shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-2 h-2 rounded-full bg-indigo-500" />
                                            <span className="text-xs font-bold text-slate-500 uppercase">KNN (Memória)</span>
                                        </div>
                                        <div className="text-3xl font-bold text-slate-800">
                                            {selectedEmbryo.knn_classification || '--'}
                                        </div>
                                        <div className="text-xs text-slate-400 mt-1">
                                            Confiança: {selectedEmbryo.knn_confidence || 0}%
                                        </div>
                                    </div>

                                    <div className="p-4 rounded-xl border bg-white shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-2 h-2 rounded-full bg-rose-500" />
                                            <span className="text-xs font-bold text-slate-500 uppercase">Gemini (Visão)</span>
                                        </div>
                                        <div className="text-3xl font-bold text-slate-800">
                                            {selectedEmbryo.gemini_classification || '--'}
                                        </div>
                                        <div className="text-xs text-slate-400 mt-1">
                                            2ª Opinião
                                        </div>
                                    </div>
                                </div>

                                {/* Detailed Reasoning */}
                                <Card className="bg-slate-50 border-slate-200">
                                    <CardHeader className="py-3 border-b border-slate-100">
                                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                            <Info className="w-4 h-4 text-slate-400" />
                                            Análise Detalhada (Gemini)
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="py-4">
                                        <p className="text-sm text-slate-600 leading-relaxed">
                                            {selectedEmbryo.gemini_reasoning || selectedEmbryo.reasoning || "Análise textual não disponível."}
                                        </p>
                                    </CardContent>
                                </Card>

                                {/* Manual Override Panel */}
                                <Card className="border-2 border-emerald-100 bg-emerald-50/30">
                                    <CardHeader className="py-3">
                                        <CardTitle className="text-sm font-semibold text-emerald-900">
                                            Confirme a Classificação Final
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="py-4">
                                        <div className="grid grid-cols-3 gap-2">
                                            {['BE', 'BN', 'BX', 'BL', 'BI', 'Mo', 'Dg'].map((grade) => (
                                                <Button
                                                    key={grade}
                                                    variant={currentGrade === grade ? 'default' : 'outline'}
                                                    className={currentGrade === grade
                                                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white font-bold'
                                                        : 'bg-white hover:bg-emerald-50 text-slate-600 border-slate-200'}
                                                    onClick={() => setManualGrade(grade)}
                                                >
                                                    {grade}
                                                </Button>
                                            ))}
                                            <Button
                                                variant={currentGrade === 'Inviável' ? 'destructive' : 'outline'}
                                                className="col-span-1 border-red-200 text-red-600 hover:bg-red-50"
                                                onClick={() => setManualGrade('Inviável')}
                                            >
                                                Inviável
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>

                            </div>

                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-300 bg-slate-50/50">
                        <Microscope className="w-20 h-20 mb-4 opacity-10" />
                        <h3 className="text-lg font-semibold text-slate-400">Nenhum embrião selecionado</h3>
                        <p className="text-sm text-slate-400/80">Selecione um item na fila à esquerda para iniciar</p>
                    </div>
                )}
            </div>
        </div>
    );
}
