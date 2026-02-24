import { useState, useRef, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { useGlobalFarmData } from '@/hooks/useGlobalFarmData';
import { useClienteHubData } from '@/hooks/cliente';
import { Sparkles, User, BarChart3, CheckCircle2, Activity, AlertCircle, Calendar, ListChecks, ChevronDown, Award, Baby, Clock, Repeat2, Snowflake, Download, Dna, ShoppingBag, Maximize2 } from 'lucide-react';
import { UnifiedInputBar } from '@/components/ui/UnifiedInputBar';
import { cn } from '@/lib/utils';
import { LoadingInline } from '@/components/shared/LoadingScreen';
import { GeniaLogo } from '@/components/ui/GeniaLogo';
import { fetchReportDataFromIntent, type AIIntent } from '@/services/aiReportService';
import { tipoIconConfig, tipoBadgeConfig } from '@/lib/receptoraHistoricoUtils';
import { formatDateBR } from '@/lib/dateUtils';
import { exportToPdf, type PdfColumn } from '@/lib/exportPdf';
import ReportFullscreenViewer from '@/components/genia/ReportFullscreenViewer';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    isSearching?: boolean;
    intentData?: any;
}

// === PDF Export Helper ===

function exportGenIAPdf(intentData: any) {
    const tipo = intentData.tipo;
    let title = '';
    let columns: PdfColumn[] = [];
    let data: Record<string, unknown>[] = [];

    switch (tipo) {
        case 'LISTA_RECEPTORAS':
            title = 'Receptoras';
            columns = [
                { header: 'Identificação', key: 'identificacao', width: 25 },
                { header: 'Status', key: 'status', width: 18 },
                { header: 'Dias Gest.', key: 'diasGestacao', width: 12, align: 'center' },
                { header: 'Próxima Etapa', key: 'etapaProxima', width: 18 },
                { header: 'Data', key: 'dataEtapa', width: 15, align: 'center' },
            ];
            data = intentData.animais || [];
            break;

        case 'LISTA_DOADORAS':
            title = 'Doadoras';
            columns = [
                { header: 'Nome', key: 'nome', width: 25 },
                { header: 'Raça', key: 'raca', width: 20 },
                { header: 'Aspirações', key: 'totalAspiracoes', width: 15, align: 'center' },
                { header: 'Média Oócitos', key: 'mediaOocitos', width: 15, align: 'center' },
            ];
            data = intentData.animais || [];
            break;

        case 'PROXIMOS_PARTOS':
            title = 'Próximos Partos';
            columns = [
                { header: 'Identificação', key: 'identificacao', width: 25 },
                { header: 'Status', key: 'status', width: 18 },
                { header: 'Data Parto', key: 'dataPartoPrevista', width: 18, align: 'center' },
                { header: 'Dias Restantes', key: 'diasRestantes', width: 15, align: 'center' },
            ];
            data = intentData.animais || [];
            break;

        case 'PROXIMOS_SERVICOS':
            title = 'Próximos Serviços';
            columns = [
                { header: 'Identificação', key: 'identificacao', width: 25 },
                { header: 'Etapa', key: 'etapa', width: 18 },
                { header: 'Data Esperada', key: 'dataEsperada', width: 18, align: 'center' },
                { header: 'Dias', key: 'diasRestantes', width: 12, align: 'center' },
            ];
            data = intentData.itens || [];
            break;

        case 'ANALISE_REPETIDORAS':
            title = 'Repetidoras';
            columns = [
                { header: 'Identificação', key: 'identificacao', width: 30 },
                { header: 'Sem Prenhez', key: 'protocolosSemPrenhez', width: 18, align: 'center' },
                { header: 'Total Prot.', key: 'totalProtocolos', width: 18, align: 'center' },
            ];
            data = intentData.animais || [];
            break;

        case 'DESEMPENHO_VET':
        case 'DESEMPENHO_TOURO':
        case 'COMPARACAO_FAZENDAS': {
            const labels: Record<string, string> = {
                DESEMPENHO_VET: 'Desempenho Veterinário',
                DESEMPENHO_TOURO: 'Desempenho por Touro',
                COMPARACAO_FAZENDAS: 'Comparação de Fazendas',
            };
            title = labels[tipo] || tipo;
            columns = [
                { header: 'Nome', key: 'nome', width: 30 },
                { header: 'Total DGs', key: 'total', width: 15, align: 'center' },
                { header: 'Prenhes', key: 'prenhes', width: 15, align: 'center' },
                { header: 'Taxa', key: 'taxa', width: 15, align: 'center' },
            ];
            data = intentData.veterinarios || [];
            break;
        }

        case 'ESTOQUE_SEMEN':
            title = 'Estoque de Sêmen';
            columns = [
                { header: 'Touro', key: 'touro', width: 35 },
                { header: 'Raça', key: 'raca', width: 25 },
                { header: 'Doses', key: 'doses', width: 15, align: 'center' },
            ];
            data = intentData.itens || [];
            break;

        case 'ESTOQUE_EMBRIOES':
            title = 'Embriões Congelados';
            columns = [
                { header: 'Classificação', key: 'classificacao', width: 40 },
                { header: 'Quantidade', key: 'quantidade', width: 20, align: 'center' },
            ];
            data = intentData.itens || [];
            break;

        case 'CATALOGO_GENETICA':
            title = 'Catálogo de Genética';
            columns = [
                { header: 'Nome', key: 'nome', width: 25 },
                { header: 'Tipo', key: 'tipo', width: 12, align: 'center' },
                { header: 'Raça', key: 'raca', width: 18 },
                { header: 'Preço', key: 'preco', width: 15, align: 'center' },
                { header: 'Estoque', key: 'estoque', width: 12, align: 'center' },
            ];
            data = intentData.itens || [];
            break;

        case 'MINHAS_RESERVAS':
            title = 'Minhas Reservas';
            columns = [
                { header: 'Animal', key: 'animal_nome', width: 25 },
                { header: 'Tipo', key: 'tipo', width: 12, align: 'center' },
                { header: 'Status', key: 'status', width: 15, align: 'center' },
                { header: 'Data Desejada', key: 'data_desejada', width: 15, align: 'center' },
            ];
            data = intentData.itens || [];
            break;

        case 'RECOMENDACAO_GENETICA':
            title = 'Cruzamentos Sugeridos';
            columns = [
                { header: 'Doadora', key: 'doadora_nome', width: 22 },
                { header: 'Raça Doa.', key: 'doadora_raca', width: 14 },
                { header: 'Touro', key: 'touro_nome', width: 22 },
                { header: 'Raça Touro', key: 'touro_raca', width: 14 },
                { header: 'Motivo', key: 'motivo', width: 22 },
            ];
            data = (intentData.cruzamentos || []).map((c: any) => ({
                doadora_nome: c.doadora?.nome, doadora_raca: c.doadora?.raca,
                touro_nome: c.touro?.nome, touro_raca: c.touro?.raca,
                motivo: c.motivo,
            }));
            break;

        default: {
            // Fallback: transpor campos numéricos como Chave → Valor
            const tipoLabels: Record<string, string> = {
                DG: 'Diagnóstico de Gestação', TE: 'Transferência de Embriões',
                RESUMO: 'Resumo Geral', ASPIRACAO: 'Aspiração', SEXAGEM: 'Sexagem',
                REBANHO: 'Rebanho', PROTOCOLOS: 'Protocolos', NASCIMENTOS: 'Nascimentos',
            };
            title = tipoLabels[tipo] || tipo;
            columns = [
                { header: 'Indicador', key: 'chave', width: 50 },
                { header: 'Valor', key: 'valor', width: 25, align: 'center' },
            ];
            const labelMap: Record<string, string> = {
                total: 'Total', totalAnimais: 'Animais', totalDoadoras: 'Doadoras',
                realizadas: 'Realizadas', taxaPrenhez: 'Taxa Prenhez', positivos: 'Positivos',
                vazias: 'Vazias', prenhes: 'Prenhes', machos: 'Machos', femeas: 'Fêmeas',
                totalSessoes: 'Sessões', tourosComEstoque: 'Touros c/ Estoque',
                partosProximos: 'Partos Próx. 30d', cioLivre: 'Cio Livre',
                totalProtocolos: 'Protocolos', totalReceptoras: 'Receptoras',
                aptas: 'Aptas', inaptas: 'Inaptas', urgentes: 'Urgentes',
            };
            data = Object.entries(intentData)
                .filter(([k, v]) => labelMap[k] && v !== undefined && v !== null)
                .map(([k, v]) => ({ chave: labelMap[k], valor: v }));
            break;
        }
    }

    if (data.length === 0) return;

    const fileName = `genia-${title.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`;
    exportToPdf({
        title: `Gen.IA — ${title}`,
        subtitle: intentData.periodo || undefined,
        columns,
        data: data as Record<string, unknown>[],
        fileName,
        orientation: data.length > 20 ? 'landscape' : 'portrait',
    });
}

function hasExportableData(intentData: any): boolean {
    if (!intentData?.tipo) return false;
    const { tipo } = intentData;
    if (['LISTA_RECEPTORAS', 'LISTA_DOADORAS', 'ANALISE_REPETIDORAS', 'PROXIMOS_PARTOS'].includes(tipo))
        return (intentData.animais?.length ?? 0) > 0;
    if (['PROXIMOS_SERVICOS', 'ESTOQUE_SEMEN', 'ESTOQUE_EMBRIOES', 'CATALOGO_GENETICA', 'MINHAS_RESERVAS'].includes(tipo))
        return (intentData.itens?.length ?? 0) > 0;
    if (tipo === 'RECOMENDACAO_GENETICA') return (intentData.cruzamentos?.length ?? 0) > 0;
    if (['DESEMPENHO_VET', 'DESEMPENHO_TOURO', 'COMPARACAO_FAZENDAS'].includes(tipo))
        return (intentData.veterinarios?.length ?? 0) > 0;
    if (tipo === 'BUSCA_ANIMAL') return false;
    // Fallback: has numeric fields
    const numericKeys = ['total', 'totalAnimais', 'realizadas', 'prenhes', 'vazias', 'positivos', 'totalProtocolos', 'totalReceptoras', 'aptas', 'inaptas'];
    return numericKeys.some(k => intentData[k] !== undefined && intentData[k] !== null);
}

function ExportPdfButton({ intentData }: { intentData: any }) {
    if (!hasExportableData(intentData)) return null;
    return (
        <button
            onClick={() => exportGenIAPdf(intentData)}
            title="Exportar PDF"
            className="text-muted-foreground hover:text-primary transition-colors p-0.5"
        >
            <Download className="w-4 h-4" />
        </button>
    );
}

// === Helper Components for Animal Lists ===

function UrgencyDot({ dias }: { dias: number | null | undefined }) {
    if (dias == null) return null;
    const color = dias <= 0 ? 'bg-red-500' : dias <= 3 ? 'bg-amber-500' : dias <= 7 ? 'bg-emerald-500' : 'bg-gray-300';
    return <div className={cn("w-2 h-2 rounded-full shrink-0", color)} />;
}

function StatusBadge({ status, humanize }: { status: string | null; humanize: (s?: string | null) => string }) {
    if (!status) return null;
    const isPrenhe = status.includes('PRENHE');
    const isVazia = status === 'VAZIA';
    return (
        <span className={cn(
            "text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide",
            isPrenhe ? "bg-emerald-500/10 text-emerald-700" :
                isVazia ? "bg-red-500/10 text-red-700" :
                    "bg-muted text-muted-foreground"
        )}>
            {humanize(status)}
        </span>
    );
}

function EtapaBadge({ etapa }: { etapa: string }) {
    const colors: Record<string, string> = {
        '2º Passo': 'bg-blue-500/10 text-blue-700',
        'TE': 'bg-emerald-500/10 text-emerald-700',
        'DG': 'bg-violet-500/10 text-violet-700',
        'Sexagem': 'bg-pink-500/10 text-pink-700',
        'Parto': 'bg-amber-500/10 text-amber-700',
    };
    return (
        <span className={cn("text-[10px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wide", colors[etapa] || "bg-muted text-muted-foreground")}>
            {etapa}
        </span>
    );
}

function ExpandButton({ onClick }: { onClick: () => void }) {
    return (
        <button onClick={(e) => { e.stopPropagation(); onClick(); }} title="Expandir relatório" className="text-muted-foreground hover:text-primary transition-colors p-0.5">
            <Maximize2 className="w-4 h-4" />
        </button>
    );
}

function AnimalListCard({ icon, title, total, mostrando, accentColor, summary, items, renderItem, onExport, onExpand }: {
    icon: React.ReactNode;
    title: string;
    total: number;
    mostrando?: number;
    accentColor?: 'red' | 'amber' | string;
    summary?: string;
    items: any[];
    renderItem: (item: any) => React.ReactNode;
    onExport?: () => void;
    onExpand?: () => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const displayItems = expanded ? items : items.slice(0, 15);
    const remaining = items.length - 15;

    const borderColor = accentColor === 'red' ? 'border-red-500/20' : accentColor === 'amber' ? 'border-amber-500/20' : 'border-primary/20';
    const headerColor = accentColor === 'red' ? 'text-red-700' : accentColor === 'amber' ? 'text-amber-700' : 'text-primary-dark';

    return (
        <div className={cn("mt-2 bg-background/50 border rounded-xl p-4 shadow-sm", borderColor)}>
            <div className="flex items-center justify-between mb-2 border-b border-border/30 pb-2">
                <div className={cn("flex items-center gap-2 font-semibold", headerColor)}>
                    {icon}
                    {title}
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-bold">{total}</span>
                </div>
                <div className="flex items-center gap-2">
                    {mostrando != null && mostrando < total && (
                        <span className="text-[10px] text-muted-foreground">mostrando {mostrando} de {total}</span>
                    )}
                    {onExport && (
                        <button onClick={onExport} title="Exportar PDF" className="text-muted-foreground hover:text-primary transition-colors p-0.5">
                            <Download className="w-4 h-4" />
                        </button>
                    )}
                    {onExpand && <ExpandButton onClick={onExpand} />}
                </div>
            </div>
            {summary && (
                <div className="text-[11px] text-muted-foreground mb-2">{summary}</div>
            )}
            <div className="flex flex-col divide-y divide-border/30">
                {displayItems.map((item, i) => (
                    <div key={i}>{renderItem(item)}</div>
                ))}
            </div>
            {remaining > 0 && !expanded && (
                <button onClick={() => setExpanded(true)} className="mt-2 text-xs text-primary hover:text-primary/80 flex items-center gap-1 mx-auto">
                    <ChevronDown className="w-3 h-3" /> + {remaining} mais...
                </button>
            )}
        </div>
    );
}

// === Genetics Card Components ===

function GeneticaItemRow({ item, onNavigate }: { item: any; onNavigate: (path: string) => void }) {
    const formatPrice = (p: number | null) => p ? `R$ ${p.toLocaleString('pt-BR')}` : 'Consultar';
    return (
        <div className="flex items-center gap-3 py-2">
            {item.foto_url ? (
                <img src={item.foto_url} alt={item.nome} className="w-10 h-10 rounded-lg object-cover shrink-0 bg-muted" />
            ) : (
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Dna className="w-5 h-5 text-primary/60" />
                </div>
            )}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                    <span className="font-bold text-[13px] text-foreground truncate">{item.nome}</span>
                    <span className={cn("text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase",
                        item.tipo === 'doadora' ? "bg-pink-500/10 text-pink-700" : "bg-blue-500/10 text-blue-700"
                    )}>{item.tipo === 'doadora' ? 'Doadora' : 'Touro'}</span>
                    {item.destaque && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700">Destaque</span>}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                    {item.raca && <span className="text-[11px] text-muted-foreground">{item.raca}</span>}
                    <span className="text-[11px] font-bold text-primary-dark">{formatPrice(item.preco)}</span>
                    {item.estoque != null && <span className="text-[10px] text-muted-foreground">{item.estoque} disp.</span>}
                </div>
            </div>
            <button
                onClick={() => onNavigate(`/genetica/${item.tipo}s/${item.catalogo_id}`)}
                className="text-[10px] font-bold text-primary hover:text-primary/80 px-2 py-1 rounded-md border border-primary/20 shrink-0"
            >
                Ver
            </button>
        </div>
    );
}

function CatalogoGeneticaCard({ intentData, onExpand }: { intentData: any; onExpand?: () => void }) {
    const navigate = useNavigate();
    return (
        <div className="mt-2 bg-background/50 border border-primary/20 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2 border-b border-border/30 pb-2">
                <div className="flex items-center gap-2 font-semibold text-primary-dark">
                    <Dna className="w-4 h-4" />
                    Catálogo de Genética
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-bold">{intentData.total}</span>
                </div>
                <div className="flex items-center gap-2">
                    <ExportPdfButton intentData={intentData} />
                    {onExpand && <ExpandButton onClick={onExpand} />}
                </div>
            </div>
            <div className="flex flex-col divide-y divide-border/30">
                {intentData.itens.slice(0, 12).map((item: any, i: number) => (
                    <GeneticaItemRow key={i} item={item} onNavigate={navigate} />
                ))}
            </div>
            <button
                onClick={() => navigate('/cliente/mercado')}
                className="mt-3 w-full text-center text-[12px] font-bold text-primary hover:text-primary/80 py-1.5 rounded-lg border border-primary/20 transition-colors"
            >
                Ver catálogo completo
            </button>
        </div>
    );
}

function MeuBotijaoCard({ intentData, onExpand }: { intentData: any; onExpand?: () => void }) {
    const navigate = useNavigate();
    return (
        <div className="mt-2 flex flex-col gap-3">
            {/* Doses de Sêmen */}
            <div className="bg-background/50 border border-blue-500/20 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 text-blue-700 font-semibold mb-2 border-b border-blue-500/10 pb-2">
                    <BarChart3 className="w-4 h-4" />
                    Doses de Sêmen
                    <span className="text-xs bg-blue-500/10 text-blue-700 px-2 py-0.5 rounded-full font-bold ml-auto">{intentData.totalDoses}</span>
                    {onExpand && <ExpandButton onClick={onExpand} />}
                </div>
                {intentData.dosesPorTouro?.length > 0 ? (
                    <div className="flex flex-col divide-y divide-border/30">
                        {intentData.dosesPorTouro.slice(0, 10).map((item: any, i: number) => (
                            <div key={i} className="flex items-center justify-between gap-2 py-1.5">
                                <span className="font-bold text-[13px] text-foreground truncate">{item.touro}</span>
                                <div className="flex items-center gap-2 shrink-0">
                                    {item.raca && <span className="text-[11px] text-muted-foreground">({item.raca})</span>}
                                    <span className="text-[12px] font-black px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700">{item.doses} doses</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-[12px] text-muted-foreground">Nenhuma dose de sêmen no seu estoque.</p>
                )}
            </div>

            {/* Embriões Congelados */}
            <div className="bg-background/50 border border-cyan-500/20 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 text-cyan-700 font-semibold mb-2 border-b border-cyan-500/10 pb-2">
                    <Snowflake className="w-4 h-4" />
                    Embriões Congelados
                    <span className="text-xs bg-cyan-500/10 text-cyan-700 px-2 py-0.5 rounded-full font-bold ml-auto">{intentData.totalEmbrioes}</span>
                </div>
                {intentData.embrioesPorClassificacao?.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {intentData.embrioesPorClassificacao.map((item: any, i: number) => (
                            <div key={i} className="flex items-center justify-between gap-1 px-2 py-1.5 rounded-lg bg-muted/30">
                                <span className="text-[12px] font-bold text-foreground truncate">{item.classificacao}</span>
                                <span className="text-[12px] font-black text-cyan-700">{item.quantidade}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-[12px] text-muted-foreground">Nenhum embrião congelado no seu estoque.</p>
                )}
            </div>

            <button
                onClick={() => navigate('/cliente/mercado')}
                className="w-full text-center text-[12px] font-bold text-primary hover:text-primary/80 py-1.5 rounded-lg border border-primary/20 transition-colors"
            >
                Ver detalhes no Meu Botijão
            </button>
        </div>
    );
}

function ReservaStatusBadge({ status }: { status: string }) {
    const config: Record<string, string> = {
        PENDENTE: 'bg-amber-500/10 text-amber-700',
        CONFIRMADA: 'bg-emerald-500/10 text-emerald-700',
        RECUSADA: 'bg-red-500/10 text-red-700',
        CANCELADA: 'bg-gray-500/10 text-gray-600',
        CONCLUIDA: 'bg-blue-500/10 text-blue-700',
    };
    return (
        <span className={cn("text-[10px] font-black px-1.5 py-0.5 rounded-full uppercase", config[status] || 'bg-muted text-muted-foreground')}>
            {status}
        </span>
    );
}

function MinhasReservasCard({ intentData, onExpand }: { intentData: any; onExpand?: () => void }) {
    const navigate = useNavigate();
    return (
        <div className="mt-2 bg-background/50 border border-amber-500/20 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2 border-b border-border/30 pb-2">
                <div className="flex items-center gap-2 font-semibold text-amber-700">
                    <ShoppingBag className="w-4 h-4" />
                    Minhas Reservas
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-bold">{intentData.total}</span>
                </div>
                <div className="flex items-center gap-2">
                    {onExpand && <ExpandButton onClick={onExpand} />}
                </div>
            </div>
            <div className="flex flex-col divide-y divide-border/30">
                {intentData.itens.slice(0, 10).map((item: any, i: number) => (
                    <div key={i} className="py-2 flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="font-bold text-[13px] text-foreground truncate">{item.animal_nome}</span>
                                <span className={cn("text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase",
                                    item.tipo === 'doadora' ? "bg-pink-500/10 text-pink-700" : "bg-blue-500/10 text-blue-700"
                                )}>{item.tipo === 'doadora' ? 'Doadora' : 'Touro'}</span>
                            </div>
                            <ReservaStatusBadge status={item.status} />
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                            {item.data_desejada && <span>Data: {formatDateBR(item.data_desejada)}</span>}
                            {item.quantidade && <span>Qtd: {item.quantidade}</span>}
                            <span>{formatDateBR(item.created_at?.substring(0, 10))}</span>
                        </div>
                        {item.resposta_admin && (
                            <div className="text-[11px] bg-primary/5 border border-primary/10 rounded-md px-2 py-1 mt-1 text-foreground/80">
                                <span className="font-bold text-primary-dark">Resposta: </span>{item.resposta_admin}
                            </div>
                        )}
                    </div>
                ))}
            </div>
            <button
                onClick={() => navigate('/cliente/mercado')}
                className="mt-3 w-full text-center text-[12px] font-bold text-primary hover:text-primary/80 py-1.5 rounded-lg border border-primary/20 transition-colors"
            >
                Gerenciar reservas
            </button>
        </div>
    );
}

function CruzamentoRow({ cruzamento }: { cruzamento: any }) {
    const navigate = useNavigate();
    const doa = cruzamento.doadora;
    const tou = cruzamento.touro;
    const formatPrice = (p: number | null) => p ? `R$ ${p.toLocaleString('pt-BR')}` : null;

    return (
        <div className="py-2.5 flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
                {/* Doadora */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    {doa.foto_url ? (
                        <img src={doa.foto_url} alt={doa.nome} className="w-8 h-8 rounded-lg object-cover shrink-0 bg-muted" />
                    ) : (
                        <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-black text-pink-700">D</span>
                        </div>
                    )}
                    <div className="min-w-0">
                        <span className="font-bold text-[12px] text-foreground truncate block">{doa.nome}</span>
                        {doa.raca && <span className="text-[10px] text-muted-foreground">{doa.raca}</span>}
                    </div>
                </div>

                {/* × separator */}
                <span className="text-[14px] font-black text-primary shrink-0">×</span>

                {/* Touro */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    {tou.foto_url ? (
                        <img src={tou.foto_url} alt={tou.nome} className="w-8 h-8 rounded-lg object-cover shrink-0 bg-muted" />
                    ) : (
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                            <span className="text-[10px] font-black text-blue-700">T</span>
                        </div>
                    )}
                    <div className="min-w-0">
                        <span className="font-bold text-[12px] text-foreground truncate block">{tou.nome}</span>
                        <div className="flex items-center gap-1.5">
                            {tou.raca && <span className="text-[10px] text-muted-foreground">{tou.raca}</span>}
                            {formatPrice(tou.preco) && <span className="text-[10px] font-bold text-primary-dark">{formatPrice(tou.preco)}</span>}
                        </div>
                    </div>
                </div>

                {/* Action */}
                {tou.catalogo_id && (
                    <button
                        onClick={() => navigate(`/genetica/touros/${tou.catalogo_id}`)}
                        className="text-[10px] font-bold text-primary hover:text-primary/80 px-2 py-1 rounded-md border border-primary/20 shrink-0"
                    >
                        Ver
                    </button>
                )}
            </div>

            {/* Motivo / badge */}
            {cruzamento.motivo && (
                <div className="ml-10">
                    <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full",
                        cruzamento.compativel ? "text-emerald-600 bg-emerald-500/10" : "text-muted-foreground bg-muted/50"
                    )}>
                        {cruzamento.motivo}
                    </span>
                </div>
            )}
        </div>
    );
}

function RecomendacaoGeneticaCard({ intentData, onExpand }: { intentData: any; onExpand?: () => void }) {
    const navigate = useNavigate();

    return (
        <div className="mt-2 bg-background/50 border border-emerald-500/20 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2 border-b border-border/30 pb-2">
                <div className="flex items-center gap-2 font-semibold text-emerald-700">
                    <Sparkles className="w-4 h-4" />
                    Cruzamentos Sugeridos
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-bold">{intentData.cruzamentos?.length || 0}</span>
                    {onExpand && <ExpandButton onClick={onExpand} />}
                </div>
            </div>

            {/* Contexto */}
            <div className="text-[12px] text-muted-foreground mb-3 bg-emerald-500/5 border border-emerald-500/10 rounded-lg px-3 py-2">
                {intentData.usandoDoadorasCliente ? (
                    <>Combinei suas <span className="font-bold text-foreground">{intentData.totalDoadoras} doadora{intentData.totalDoadoras !== 1 ? 's' : ''}</span> com <span className="font-bold text-foreground">{intentData.totalTouros} touro{intentData.totalTouros !== 1 ? 's' : ''}</span> disponíveis no catálogo</>
                ) : (
                    <>Sugestões de cruzamento com <span className="font-bold text-foreground">{intentData.totalDoadoras} doadora{intentData.totalDoadoras !== 1 ? 's' : ''}</span> e <span className="font-bold text-foreground">{intentData.totalTouros} touro{intentData.totalTouros !== 1 ? 's' : ''}</span> do catálogo</>
                )}
            </div>

            <div className="flex flex-col divide-y divide-border/30">
                {(intentData.cruzamentos || []).map((c: any, i: number) => (
                    <CruzamentoRow key={i} cruzamento={c} />
                ))}
            </div>

            <button
                onClick={() => navigate('/cliente/mercado')}
                className="mt-3 w-full text-center text-[12px] font-bold text-primary hover:text-primary/80 py-1.5 rounded-lg border border-primary/20 transition-colors"
            >
                Ver catálogo completo
            </button>
        </div>
    );
}

// === Time-Based Contextual Suggestions ===
function getTimeSuggestions(): { greeting: string; pills: string[] } {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 9) {
        return {
            greeting: 'Bom dia! O que vamos resolver hoje?',
            pills: [
                'Quais serviços temos hoje?',
                'Resumo geral da fazenda',
                'Algum parto previsto essa semana?',
            ],
        };
    }
    if (hour >= 9 && hour < 12) {
        return {
            greeting: 'Como posso te ajudar nessa manhã?',
            pills: [
                'Quais DGs estão pendentes?',
                'Receptoras aptas para protocolar',
                'Agenda da semana',
            ],
        };
    }
    if (hour >= 12 && hour < 17) {
        return {
            greeting: 'Boa tarde! No que posso ajudar?',
            pills: [
                'Relatório de DGs feitas hoje',
                'Algum parto previsto essa semana?',
                'Ver estoque de sêmen',
            ],
        };
    }
    if (hour >= 17 && hour < 22) {
        return {
            greeting: 'Boa noite! Vamos fechar o dia?',
            pills: [
                'Resumo do dia na fazenda',
                'O que temos agendado para amanhã?',
                'Ranking dos touros',
            ],
        };
    }
    // 22-5
    return {
        greeting: 'Boa noite! Em que posso ajudar?',
        pills: [
            'Resumo geral da fazenda',
            'Verificar estoque de sêmen',
            'Quais receptoras estão prenhas?',
        ],
    };
}

// === Follow-Up Suggestions Helper ===
function getFollowUpSuggestions(intentData: any): string[] {
    if (!intentData || !intentData.tipo) return ["Resumo geral da fazenda", "Quais os próximos partos?"];

    switch (intentData.tipo) {
        case 'RESUMO':
            return ["Quais touros têm melhor desempenho?", "Ver estoque de sêmen", "Ver repetidoras"];
        case 'PROXIMOS_PARTOS':
            return ["Ver desempenho veterinário", "Resumo da fazenda"];
        case 'LISTA_RECEPTORAS':
        case 'RECEPTORAS':
            return ["Mostrar apenas as vazias", "Quais estão aptas para protocolo?", "Mostrar repetidoras"];
        case 'LISTA_DOADORAS':
            return ["Qual o estoque de embriões?", "Compare o desempenho das fazendas"];
        case 'ANALISE_REPETIDORAS':
            return ["Quais touros têm melhor desempenho?", "Resumo geral da fazenda"];
        case 'ESTOQUE_SEMEN':
            return ["E o estoque de embriões?", "Quais touros têm melhor taxa de prenhez?"];
        case 'ESTOQUE_EMBRIOES':
            return ["Qual o estoque de sêmen?", "Quais receptoras posso protocolar?"];
        case 'BUSCA_ANIMAL':
            return ["Buscar outro animal pelo brinco", "Resumo da fazenda"];
        case 'DESEMPENHO_TOURO':
            return ["Desempenho veterinário", "Estoque de sêmen"];
        case 'DESEMPENHO_VET':
            return ["Ranking de touros", "Resumo geral"];
        case 'COMPARACAO_FAZENDAS':
            return ["Resumo geral", "Lista de Doadoras"];
        case 'CATALOGO_GENETICA':
            return ["Meu botijão", "Minhas reservas", "Sugerir genética pro meu rebanho"];
        case 'MEU_BOTIJAO':
            return ["Ver catálogo de genética", "Minhas reservas"];
        case 'MINHAS_RESERVAS':
            return ["Ver catálogo de genética", "O que tenho no botijão?"];
        case 'RECOMENDACAO_GENETICA':
            return ["Ver catálogo completo", "Meu botijão", "Resumo do rebanho"];
        default:
            return ["O que precisa ser feito essa semana?", "Compare o desempenho das fazendas"];
    }
}

const WELCOME_MESSAGE: Message = {
    id: 'welcome',
    role: 'assistant',
    content: '' // Vazio, pois renderizamos componente customizado
};
let persistedMessages: Message[] = [];

// === Zero-State Onboarding Component ===

const SUGGESTION_CHIPS = [
    { label: 'Vacas prenhes', query: 'Quais receptoras estão prenhes?' },
    { label: 'Próximos partos', query: 'Quais os próximos partos?' },
    { label: 'Buscar animal', query: 'Buscar animal pelo brinco' },
    { label: 'Estoque de sêmen', query: 'Qual o estoque de sêmen atual?' },
];

const SUGGESTION_CHIPS_CLIENTE = [
    { label: 'Catálogo genética', query: 'O que tem disponível no catálogo de genética?' },
    { label: 'Meu botijão', query: 'O que tenho no meu botijão?' },
    { label: 'Minhas reservas', query: 'Como estão minhas reservas de genética?' },
    { label: 'Próximos partos', query: 'Quais os próximos partos?' },
];


interface ZeroStateHeroProps {
    onSuggestionClick: (text: string) => void;
    kpis: { totalReceptoras: number; prenhes: number; proximosPartos: number | null; fazendas: number } | null;
    isLoadingKpis: boolean;
}

function SuggestionChips({ chips, onSelect }: { chips: { label: string; query: string }[]; onSelect: (query: string) => void }) {
    return (
        <div className="flex flex-wrap gap-1.5 mt-2">
            {chips.map((chip) => (
                <button
                    key={chip.label}
                    onClick={() => onSelect(chip.query)}
                    className="rounded-full border border-border/60 bg-background/80 px-3 py-1 text-[12px] font-medium text-muted-foreground transition-all active:scale-[0.97] hover:bg-muted/50 hover:text-foreground"
                >
                    {chip.label}
                </button>
            ))}
        </div>
    );
}

function buildResumoTexto(kpis: ZeroStateHeroProps['kpis']): string {
    if (!kpis) return '';
    const parts: string[] = [];
    parts.push(`Você tem ${kpis.totalReceptoras} receptora${kpis.totalReceptoras !== 1 ? 's' : ''}`);
    if (kpis.prenhes > 0) {
        parts.push(`${kpis.prenhes} ${kpis.prenhes === 1 ? 'está prenhe' : 'estão prenhes'}`);
    }
    if (kpis.proximosPartos != null && kpis.proximosPartos > 0) {
        parts.push(`${kpis.proximosPartos} com parto previsto nos próximos 60 dias`);
    }
    if (kpis.fazendas > 1) {
        parts.push(`distribuídas em ${kpis.fazendas} fazendas`);
    }
    return parts.join(', ') + '.';
}

function ZeroStateHero({ onSuggestionClick, kpis, isLoadingKpis }: ZeroStateHeroProps) {
    const { isCliente } = usePermissions();
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
    const resumo = buildResumoTexto(kpis);
    const chips = isCliente ? SUGGESTION_CHIPS_CLIENTE : SUGGESTION_CHIPS;

    return (
        <div className="flex flex-col items-center w-full max-w-2xl px-4 py-6 mx-auto">
            {/* Saudação + Logo */}
            <div className="flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="mb-4">
                    <GeniaLogo size={56} showText={false} variant="premium" />
                </div>
                <h2 className="text-xl font-black text-foreground tracking-tight">
                    {greeting}! Sou a Gen.IA
                </h2>
                <p className="text-[15px] text-muted-foreground mt-2 leading-relaxed max-w-md">
                    {isLoadingKpis && !kpis
                        ? 'Carregando dados do seu rebanho...'
                        : resumo
                            ? <>{resumo} <span className="text-foreground font-medium">Como posso ajudar hoje?</span></>
                            : 'Sua consultora de reprodução. Me pergunte sobre o rebanho, estoques ou métricas.'
                    }
                </p>
            </div>

            {/* Sugestões rápidas */}
            <div
                className="flex flex-wrap justify-center gap-2 mt-5 animate-in fade-in slide-in-from-bottom-4 duration-700"
                style={{ animationDelay: '200ms', animationFillMode: 'backwards' }}
            >
                {chips.map((chip) => (
                    <button
                        key={chip.label}
                        onClick={() => onSuggestionClick(chip.query)}
                        className="rounded-full border border-border/60 bg-card/50 px-3.5 py-1.5 text-[13px] font-medium text-foreground transition-all active:scale-[0.97] hover:bg-muted/50"
                    >
                        {chip.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

// === Fullscreen Report Content ===

function FullscreenReportContent({ intentData, humanizeStatus }: { intentData: any; humanizeStatus: (s?: string | null) => string }) {
    if (!intentData?.tipo) return null;
    const tipo = intentData.tipo;

    if (tipo === 'LISTA_RECEPTORAS' && intentData.animais?.length > 0) {
        return (
            <AnimalListCard
                icon={<ListChecks className="w-4 h-4" />}
                title="Receptoras"
                total={intentData.total}
                mostrando={intentData.mostrando}
                items={intentData.animais}
                renderItem={(a: any) => (
                    <div className="flex items-center justify-between gap-2 py-1.5">
                        <span className="font-bold text-[13px] text-foreground truncate">{a.identificacao}</span>
                        <StatusBadge status={a.status} humanize={humanizeStatus} />
                    </div>
                )}
            />
        );
    }

    if (tipo === 'LISTA_DOADORAS' && intentData.animais?.length > 0) {
        return (
            <AnimalListCard
                icon={<Award className="w-4 h-4" />}
                title="Doadoras"
                total={intentData.total}
                items={intentData.animais}
                renderItem={(d: any) => (
                    <div className="flex items-center justify-between gap-2 py-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="font-bold text-[13px] text-foreground truncate">{d.nome}</span>
                            {d.raca && <span className="text-[11px] text-muted-foreground">({d.raca})</span>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[11px] text-muted-foreground">{d.totalAspiracoes} asp.</span>
                            <span className={cn("text-[12px] font-black px-2 py-0.5 rounded-full", d.mediaOocitos < 5 ? "bg-red-500/10 text-red-700" : d.mediaOocitos < 10 ? "bg-amber-500/10 text-amber-700" : "bg-emerald-500/10 text-emerald-700")}>
                                {d.mediaOocitos} ooc/asp
                            </span>
                        </div>
                    </div>
                )}
            />
        );
    }

    if (tipo === 'ANALISE_REPETIDORAS' && intentData.animais?.length > 0) {
        return (
            <AnimalListCard
                icon={<Repeat2 className="w-4 h-4" />}
                title="Repetidoras"
                total={intentData.total}
                accentColor="red"
                summary={`Min. ${intentData.minProtocolos} protocolos sem prenhez`}
                items={intentData.animais}
                renderItem={(a: any) => (
                    <div className="flex items-center justify-between gap-2 py-1.5">
                        <span className="font-bold text-[13px] text-foreground truncate">{a.identificacao}</span>
                        <div className="flex items-center gap-2 shrink-0">
                            <span className={cn("text-[12px] font-black px-2 py-0.5 rounded-full", a.protocolosSemPrenhez >= 5 ? "bg-red-500/15 text-red-700" : "bg-amber-500/15 text-amber-700")}>
                                {a.protocolosSemPrenhez}x sem prenhez
                            </span>
                            <span className="text-[11px] text-muted-foreground">{a.totalProtocolos} total</span>
                        </div>
                    </div>
                )}
            />
        );
    }

    if (tipo === 'PROXIMOS_PARTOS' && intentData.animais?.length > 0) {
        return (
            <AnimalListCard
                icon={<Baby className="w-4 h-4" />}
                title="Próximos Partos"
                total={intentData.total}
                accentColor="amber"
                summary={intentData.urgentes > 0 ? `${intentData.urgentes} urgente(s)` : undefined}
                items={intentData.animais}
                renderItem={(a: any) => (
                    <div className="flex items-center justify-between gap-2 py-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                            <UrgencyDot dias={a.diasRestantes} />
                            <span className="font-bold text-[13px] text-foreground truncate">{a.identificacao}</span>
                            <StatusBadge status={a.status} humanize={humanizeStatus} />
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[11px] text-muted-foreground">{formatDateBR(a.dataPartoPrevista)}</span>
                            <span className={cn("text-[11px] font-bold", a.diasRestantes <= 0 ? "text-red-600" : a.diasRestantes <= 7 ? "text-amber-600" : "text-muted-foreground")}>
                                {a.diasRestantes <= 0 ? `${Math.abs(a.diasRestantes)}d atrasado` : `${a.diasRestantes}d`}
                            </span>
                        </div>
                    </div>
                )}
            />
        );
    }

    if (tipo === 'PROXIMOS_SERVICOS' && intentData.itens?.length > 0) {
        return (
            <AnimalListCard
                icon={<Clock className="w-4 h-4" />}
                title="Próximos Serviços"
                total={intentData.total}
                summary={[
                    intentData.urgentes > 0 ? `${intentData.urgentes} urgente(s)` : null,
                    intentData.passados > 0 ? `${intentData.passados} atrasado(s)` : null,
                ].filter(Boolean).join(' | ') || undefined}
                items={intentData.itens}
                renderItem={(i: any) => (
                    <div className="flex items-center justify-between gap-2 py-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                            <UrgencyDot dias={i.diasRestantes} />
                            <span className="font-bold text-[13px] text-foreground truncate">{i.identificacao}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                            <EtapaBadge etapa={i.etapa} />
                            <span className="text-[11px] text-muted-foreground">{formatDateBR(i.dataEsperada)}</span>
                            <span className={cn("text-[11px] font-bold", i.diasRestantes < 0 ? "text-red-600" : i.diasRestantes <= 2 ? "text-amber-600" : "text-muted-foreground")}>
                                {i.diasRestantes < 0 ? `${Math.abs(i.diasRestantes)}d atrasado` : i.diasRestantes === 0 ? 'hoje' : `${i.diasRestantes}d`}
                            </span>
                        </div>
                    </div>
                )}
            />
        );
    }

    if (tipo === 'CATALOGO_GENETICA' && intentData.itens?.length > 0) {
        return <CatalogoGeneticaCard intentData={intentData} />;
    }

    if (tipo === 'MEU_BOTIJAO') {
        return <MeuBotijaoCard intentData={intentData} />;
    }

    if (tipo === 'MINHAS_RESERVAS' && intentData.itens?.length > 0) {
        return <MinhasReservasCard intentData={intentData} />;
    }

    if (tipo === 'RECOMENDACAO_GENETICA' && intentData.cruzamentos?.length > 0) {
        return <RecomendacaoGeneticaCard intentData={intentData} />;
    }

    if ((tipo === 'DESEMPENHO_VET' || tipo === 'DESEMPENHO_TOURO' || tipo === 'COMPARACAO_FAZENDAS') && intentData.veterinarios?.length > 0) {
        return (
            <div className="mt-2 bg-background/50 border border-violet-500/20 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 text-violet-700 font-semibold mb-3 border-b border-violet-500/10 pb-2">
                    <Award className="w-4 h-4" />
                    Desempenho Veterinário
                    {intentData.periodo && <span className="text-xs bg-violet-500/10 text-violet-700 px-2 py-0.5 rounded-full ml-auto">{intentData.periodo}</span>}
                </div>
                <div className="flex flex-col gap-2">
                    {intentData.veterinarios.map((v: any, i: number) => (
                        <div key={i} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg hover:bg-muted/30">
                            <div className="flex items-center gap-2">
                                <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black", i === 0 ? "bg-amber-500/20 text-amber-700" : "bg-muted text-muted-foreground")}>{i + 1}</span>
                                <span className="font-bold text-[13px] text-foreground">{v.nome}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                                <span className="text-[11px] text-muted-foreground">{v.total} DGs</span>
                                <span className="text-[11px] text-emerald-700 font-bold">{v.prenhes} prenhes</span>
                                <span className={cn("text-[12px] font-black px-2 py-0.5 rounded-full", parseFloat(v.taxa) >= 50 ? "bg-emerald-500/10 text-emerald-700" : "bg-red-500/10 text-red-700")}>{v.taxa}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (tipo === 'ESTOQUE_SEMEN' && intentData.itens?.length > 0) {
        return (
            <AnimalListCard
                icon={<BarChart3 className="w-4 h-4" />}
                title="Estoque de Sêmen"
                total={intentData.total}
                items={intentData.itens}
                renderItem={(item: any) => (
                    <div className="flex items-center justify-between gap-2 py-1.5">
                        <span className="font-bold text-[13px] text-foreground truncate">{item.touro}</span>
                        <div className="flex items-center gap-2 shrink-0">
                            {item.raca && <span className="text-[11px] text-muted-foreground">({item.raca})</span>}
                            <span className="text-[12px] font-black px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700">{item.doses} doses</span>
                        </div>
                    </div>
                )}
            />
        );
    }

    if (tipo === 'ESTOQUE_EMBRIOES' && intentData.itens?.length > 0) {
        return (
            <div className="mt-2 bg-background/50 border border-cyan-500/20 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 text-cyan-700 font-semibold mb-3 border-b border-cyan-500/10 pb-2">
                    <Snowflake className="w-4 h-4" />
                    Embriões Congelados
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-bold ml-auto">{intentData.total}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {intentData.itens.map((item: any, i: number) => (
                        <div key={i} className="flex items-center justify-between gap-1 px-2 py-1.5 rounded-lg bg-muted/30">
                            <span className="text-[12px] font-bold text-foreground truncate">{item.classificacao}</span>
                            <span className="text-[12px] font-black text-cyan-700">{item.quantidade}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Fallback — generic metrics card
    const labelMap: Record<string, string> = {
        total: 'Total', totalAnimais: 'Animais', totalDoadoras: 'Doadoras',
        realizadas: 'Realizadas', taxaPrenhez: 'Taxa Prenhez', positivos: 'Positivos',
        vazias: 'Vazias', prenhes: 'Prenhes', machos: 'Machos', femeas: 'Fêmeas',
        totalSessoes: 'Sessões', tourosComEstoque: 'Touros c/ Estoque',
        partosProximos: 'Partos Próx. 30d', cioLivre: 'Cio Livre',
        totalProtocolos: 'Protocolos', totalReceptoras: 'Receptoras',
        aptas: 'Aptas', inaptas: 'Inaptas', urgentes: 'Urgentes',
        receptorasComTE: 'Receptoras', taxaAproveitamento: 'Tx. Aproveit.',
        comDG: 'Com DG', aguardandoDG: 'Aguard. DG',
    };

    const metrics = Object.entries(intentData)
        .filter(([k, v]) => labelMap[k] && v !== undefined && v !== null)
        .map(([k, v]) => ({ label: labelMap[k], value: v }));

    if (metrics.length === 0) return null;

    return (
        <div className="mt-2 bg-background/50 border border-primary/20 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-primary-dark font-semibold mb-3 border-b border-primary/10 pb-2">
                <BarChart3 className="w-4 h-4" />
                {tipo}
                {intentData.periodo && <span className="text-xs bg-primary/10 text-primary-dark px-2 py-0.5 rounded-full ml-auto">{intentData.periodo}</span>}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {metrics.map(({ label, value }, i) => (
                    <div key={i} className="flex flex-col">
                        <span className="text-xs text-muted-foreground uppercase font-medium">{label}</span>
                        <span className="text-lg font-bold text-foreground">{String(value)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// === Main Component ===

export default function ConsultorIA() {
    const { toast } = useToast();
    const { clienteId } = usePermissions();
    const { data: hubData, isLoading: hubLoading } = useGlobalFarmData();
    const { data: clienteHubData, isLoading: clienteHubLoading } = useClienteHubData(clienteId ?? undefined);
    const location = useLocation();

    const kpis = useMemo(() => {
        if (clienteHubData) {
            const receptoras = clienteHubData.receptoras;
            const hoje = new Date();
            const prenhes = receptoras.filter(r => r.status_reprodutivo?.includes('PRENHE')).length;
            const proximosPartos = receptoras.filter(r => {
                if (!r.data_provavel_parto) return false;
                const diff = Math.ceil((new Date(r.data_provavel_parto).getTime() - hoje.getTime()) / 86400000);
                return diff >= 0 && diff <= 60;
            }).length;

            return {
                totalReceptoras: receptoras.length,
                prenhes,
                proximosPartos,
                fazendas: clienteHubData.fazendas.length,
            };
        }
        if (hubData) {
            return {
                totalReceptoras: hubData.receptoras.length,
                prenhes: hubData.receptoras.filter(r => r.status?.includes('PRENHE')).length,
                proximosPartos: null,
                fazendas: hubData.fazendaIds.length,
            };
        }
        return null;
    }, [clienteHubData, hubData]);

    const humanizeStatus = (statusStr?: string | null) => {
        if (!statusStr) return 'Desconhecido';
        if (statusStr === 'PRENHE_DE_FEMEA') return 'Prenhe de Fêmea ♀️';
        if (statusStr === 'PRENHE_DE_MACHO') return 'Prenhe de Macho ♂️';
        if (statusStr === 'PRENHE_RETOQUE') return 'Prenhe (Retoque)';
        if (statusStr === 'PRENHE') return 'Prenhe';
        if (statusStr === 'VAZIA') return 'Vazia';
        return statusStr.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    };

    const [fullscreenReport, setFullscreenReport] = useState<{ intentData: any; title: string } | null>(null);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>(
        persistedMessages.length > 0 ? persistedMessages : [WELCOME_MESSAGE]
    );
    const [isLoading, setIsLoading] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<any>(null);

    useEffect(() => { persistedMessages = messages; }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    const startListening = () => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            toast({
                title: "Microfone não suportado",
                description: "Seu navegador atual não suporta reconhecimento de voz nativo (ex: Safari iOS muito antigo).",
                variant: "destructive"
            });
            return;
        }

        if (isListening) {
            recognitionRef.current?.stop();
            return;
        }

        try {
            const recognition = new SpeechRecognition();
            recognitionRef.current = recognition;
            recognition.lang = 'pt-BR';
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;

            recognition.onstart = () => setIsListening(true);

            recognition.onend = () => {
                setIsListening(false);
            };

            recognition.onerror = (e: any) => {
                console.error("Speech error", e.error);
                setIsListening(false);
                if (e.error !== 'no-speech' && e.error !== 'aborted') {
                    toast({
                        title: "Erro no Microfone",
                        description: "Não foi possível captar sua voz.",
                        variant: "destructive"
                    });
                }
            };

            recognition.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                setInput(transcript);
                // Send automatically and request voice return
                setTimeout(() => handleSend(transcript), 300);
            };

            recognition.start();
        } catch (e) {
            console.error("Failed to start speech recognition", e);
            setIsListening(false);
        }
    };

    // Global Action Handlers para o FAB de Voz
    useEffect(() => {
        const handleStartVoice = () => {
            if (!isListening) startListening();
        };

        const handleStopVoice = () => {
            if (recognitionRef.current && isListening) {
                // Ao parar pelo gatilho nativo, o reconhecimento emite onresult naturalmente e processa.
                recognitionRef.current.stop();
            }
        };

        window.addEventListener('genia:start-voice', handleStartVoice);
        window.addEventListener('genia:stop-voice', handleStopVoice);

        // Se fomos navegados via FAB com Hold, inicia imediatamente
        if ((location.state as any)?.autoStartVoice) {
            // timeout ultra rápido pra dar tempo da tela montar antes de pedir o mic
            setTimeout(() => {
                if (!isListening && !recognitionRef.current) {
                    startListening();
                }
            }, 100);

            // Limpa o state para não trigar recarregando
            window.history.replaceState({}, document.title);
        }

        return () => {
            window.removeEventListener('genia:start-voice', handleStartVoice);
            window.removeEventListener('genia:stop-voice', handleStopVoice);
        }
    }, [isListening, location.state]);

    const handleSend = async (text: string = input) => {
        if (!text.trim() || isLoading) return;

        const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        // AI "Thinking" Placeholder
        const aiMessageId = (Date.now() + 1).toString();
        setMessages(prev => [...prev, { id: aiMessageId, role: 'assistant', content: '', isSearching: true }]);

        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();

            if (sessionError || !session?.access_token) {
                console.error("Auth Error:", sessionError, "Session:", session);
                throw new Error("Não autenticado. Recarregue a página.");
            }

            const token = session.access_token;

            // Prepare history (last 6 messages, only user and reliable model messages)
            const historyToSend = messages
                .filter(m => !m.isSearching && m.role !== 'assistant' || (m.role === 'assistant' && !m.content.startsWith('*Aviso:*') && m.content.trim() !== ''))
                .slice(-6)
                .map(m => ({
                    role: m.role,
                    content: m.content
                }));

            console.log("Sending query:", text, "with history:", historyToSend);

            // 1. Call Gemini Edge Function to get intent
            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-report-intent`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ query: text, history: historyToSend })
            });

            if (!res.ok) {
                let errorMsg = 'Falha ao interpretar pedido.';
                try {
                    const errorText = await res.text();
                    try {
                        const errorBody = JSON.parse(errorText);
                        if (errorBody.error) errorMsg = errorBody.error;
                        if (errorBody.details) errorMsg += `\nDetalhes: ${errorBody.details}`;
                    } catch (parseErr) {
                        errorMsg += `\nRaw: ${errorText}`; // Fallback to raw text if not JSON
                    }
                } catch (e) {
                    errorMsg += ` (Status: ${res.status})`;
                }
                throw new Error(errorMsg);
            }

            const jsonIntent: AIIntent = await res.json();

            // 2. Update AI message with friendly response and remove thinking state
            setMessages(prev => prev.map(m =>
                m.id === aiMessageId
                    ? { ...m, content: jsonIntent.resposta_amigavel, isSearching: false, intentData: jsonIntent }
                    : m
            ));

            // Beep curto de notificação (Web Audio API)
            try {
                const ctx = new AudioContext();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.value = 880;
                gain.gain.value = 0.12;
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.15);
            } catch (_) { /* browser policy — ignora */ }

            // 3. If it needs data, fetch it
            if (jsonIntent.precisa_buscar_dados) {
                try {
                    // Resolve farm filter: nome_fazenda → filtered farmIds/receptoraIds
                    let effectiveFarmIds = hubData?.fazendaIds || [];
                    let effectiveReceptoraIds = hubData?.receptoraIds || [];

                    if (jsonIntent.nome_fazenda && hubData?.fazendaNomeMap) {
                        const nomeBusca = jsonIntent.nome_fazenda.toLowerCase();
                        const matchedFarmIds = Array.from(hubData.fazendaNomeMap.entries())
                            .filter(([, nome]) => nome.toLowerCase().includes(nomeBusca))
                            .map(([id]) => id);

                        if (matchedFarmIds.length > 0) {
                            effectiveFarmIds = matchedFarmIds;
                            // Filter receptoras to only those in matched farms
                            const matchedSet = new Set(matchedFarmIds);
                            effectiveReceptoraIds = hubData.receptoras
                                .filter(r => matchedSet.has(hubData.receptoraFazendaMap.get(r.id) || ''))
                                .map(r => r.id);
                        }
                    }

                    const reportData = await fetchReportDataFromIntent(
                        jsonIntent,
                        effectiveFarmIds,
                        effectiveReceptoraIds,
                        clienteId
                    );

                    setMessages(prev => [...prev, {
                        id: (Date.now() + 2).toString(),
                        role: 'assistant',
                        content: `Aqui estão os resultados encontrados no banco de dados para o seu rebanho:`,
                        intentData: reportData
                    }]);
                } catch (dbError: any) {
                    console.error("DB Error:", dbError);
                    setMessages(prev => [...prev, {
                        id: (Date.now() + 2).toString(),
                        role: 'assistant',
                        content: `*Aviso:* Ocorreu um erro ao buscar os dados biológicos: ${dbError.message}`
                    }]);
                }
            }

        } catch (error: any) {
            console.error("AI Error:", error);
            toast({
                title: 'Erro de Conexão',
                description: error.message || 'Não consegui me conectar ao córtex central da IA.',
                variant: 'destructive'
            });
            setMessages(prev => prev.filter(m => m.id !== aiMessageId));
        } finally {
            setIsLoading(false);
        }
    };

    const getReportTitle = (intentData: any): string => {
        const tipoLabels: Record<string, string> = {
            LISTA_RECEPTORAS: 'Receptoras', LISTA_DOADORAS: 'Doadoras', ANALISE_REPETIDORAS: 'Repetidoras',
            PROXIMOS_PARTOS: 'Próximos Partos', PROXIMOS_SERVICOS: 'Próximos Serviços',
            DESEMPENHO_VET: 'Desempenho Veterinário', DESEMPENHO_TOURO: 'Desempenho por Touro',
            COMPARACAO_FAZENDAS: 'Comparação de Fazendas', ESTOQUE_SEMEN: 'Estoque de Sêmen',
            ESTOQUE_EMBRIOES: 'Embriões Congelados', NASCIMENTOS: 'Nascimentos',
            RESUMO: 'Resumo Geral', TE: 'Transferência de Embriões', DG: 'Diagnóstico de Gestação',
            ASPIRACAO: 'Aspiração', SEXAGEM: 'Sexagem', RECEPTORAS: 'Receptoras',
            REBANHO: 'Rebanho', PROTOCOLOS: 'Protocolos', BUSCA_ANIMAL: 'Busca de Animal',
            CATALOGO_GENETICA: 'Catálogo de Genética', MEU_BOTIJAO: 'Meu Botijão',
            MINHAS_RESERVAS: 'Minhas Reservas', RECOMENDACAO_GENETICA: 'Sugestões de Genética',
        };
        return tipoLabels[intentData?.tipo] || intentData?.tipo || 'Relatório';
    };

    const openFullscreen = (intentData: any) => {
        setFullscreenReport({ intentData, title: getReportTitle(intentData) });
    };

    if (hubLoading) {
        return <div className="flex h-[calc(100vh-100px)] items-center justify-center"><LoadingInline text="Carregando Córtex da Fazenda..." /></div>;
    }

    return (
        <div className="flex flex-col absolute inset-0 w-full mx-auto overflow-hidden bg-background">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 shrink-0 bg-background/95 backdrop-blur-md z-20 shadow-sm">
                <GeniaLogo size={42} showText={true} variant="default" />
                <div className="flex flex-col justify-center translate-y-0.5">
                    <span className="text-[10px] bg-primary/10 text-primary-dark px-1.5 py-0.5 rounded-md uppercase tracking-widest font-bold w-fit mb-0.5">Beta</span>
                    <p className="text-[13px] text-muted-foreground leading-tight font-medium">Inteligência reprodutiva do rebanho</p>
                </div>
            </div>

            {/* Messages Area (Fecho Ecler Dinâmico DNA) */}
            <div className="flex-1 overflow-y-auto px-2 md:px-0 py-6 space-y-6 relative z-0">
                {/* Espinha Dorsal do DNA (Timeline Central) */}
                {messages.length > 1 && (
                    <div className="absolute left-1/2 top-8 bottom-8 w-[2px] -translate-x-1/2 bg-gradient-to-b from-transparent via-primary/30 to-transparent -z-10 hidden md:block" />
                )}

                {messages.map((msg, i) => {
                    if (msg.id === 'welcome') {
                        return (
                            <ZeroStateHero
                                key={msg.id}
                                onSuggestionClick={(text) => handleSend(text)}
                                kpis={kpis}
                                isLoadingKpis={clienteHubLoading}
                            />
                        );
                    }

                    const isUser = msg.role === 'user';
                    return (
                        <div
                            key={msg.id}
                            className={cn(
                                "grid grid-cols-1 md:grid-cols-2 w-full gap-2 md:gap-0 opacity-0 relative",
                                isUser ? "animate-dna-right" : "animate-dna-left"
                            )}
                            style={{ animationDelay: `${Math.min(i * 150, 1500)}ms` }}
                        >
                            {/* LINHA USUÁRIO (Direita) */}
                            {isUser ? (
                                <>
                                    {/* Lado Esquerdo (Conector MD+) */}
                                    <div className="hidden md:flex items-center justify-end w-full pr-[15px] pt-5 opacity-70">
                                        <div className="h-[2px] w-[30%] bg-gradient-to-l from-border/60 to-transparent" />
                                        <div className="w-2.5 h-2.5 rounded-full border-2 border-background bg-border/60 shrink-0 translate-x-[20px]" />
                                    </div>
                                    {/* Lado Direito (Balão Usuário) */}
                                    <div className="flex w-full justify-end md:pl-6 max-w-[90%] md:max-w-full justify-self-end">
                                        <div className="bg-muted/40 backdrop-blur-md border border-border/50 text-foreground rounded-2xl rounded-tr-sm px-5 py-3.5 shadow-sm whitespace-pre-wrap text-[15px] leading-relaxed relative">
                                            <div className="md:hidden absolute top-5 -left-2 w-[10px] h-[2px] bg-border/50" />
                                            {msg.content}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                /* LINHA IA (Esquerda) */
                                <>
                                    {/* Lado Esquerdo (Balão IA) */}
                                    <div className="flex w-full justify-start md:pr-6 max-w-[95%] md:max-w-full">
                                        <div className="glass-panel border border-border/50 text-foreground/90 rounded-2xl rounded-tl-sm px-5 py-3.5 shadow-sm whitespace-pre-wrap text-[15px] leading-relaxed w-full">

                                            {msg.isSearching ? (
                                                <div className="flex items-center gap-3 h-6">
                                                    <span className="text-primary-dark font-medium animate-pulse">Analisando...</span>
                                                    {/* Nosso glorioso DNA Loader inline */}
                                                    <LoadingInline text="" />
                                                </div>
                                            ) : (
                                                <div className="flex flex-col gap-3">
                                                    <div className="markdown-light">{msg.content}</div>

                                                    {/* Renderização do JSON/Card de Dados */}
                                                    {msg.intentData && msg.intentData.tipo && (
                                                        /* === LISTA_RECEPTORAS Card === */
                                                        msg.intentData.tipo === 'LISTA_RECEPTORAS' && msg.intentData.animais?.length > 0 ? (
                                                            <AnimalListCard
                                                                icon={<ListChecks className="w-4 h-4" />}
                                                                title="Receptoras"
                                                                total={msg.intentData.total}
                                                                mostrando={msg.intentData.mostrando}
                                                                items={msg.intentData.animais}
                                                                onExport={() => exportGenIAPdf(msg.intentData)}
                                                                onExpand={() => openFullscreen(msg.intentData)}
                                                                renderItem={(a: any) => (
                                                                    <div className="flex items-center justify-between gap-2 py-1.5">
                                                                        <span className="font-bold text-[13px] text-foreground truncate">{a.identificacao}</span>
                                                                        <StatusBadge status={a.status} humanize={humanizeStatus} />
                                                                    </div>
                                                                )}
                                                            />
                                                        ) :
                                                            /* === LISTA_DOADORAS Card === */
                                                            msg.intentData.tipo === 'LISTA_DOADORAS' && msg.intentData.animais?.length > 0 ? (
                                                                <AnimalListCard
                                                                    icon={<Award className="w-4 h-4" />}
                                                                    title="Doadoras"
                                                                    total={msg.intentData.total}
                                                                    items={msg.intentData.animais}
                                                                    onExport={() => exportGenIAPdf(msg.intentData)}
                                                                    onExpand={() => openFullscreen(msg.intentData)}
                                                                    renderItem={(d: any) => (
                                                                        <div className="flex items-center justify-between gap-2 py-1.5">
                                                                            <div className="flex items-center gap-2 min-w-0">
                                                                                <span className="font-bold text-[13px] text-foreground truncate">{d.nome}</span>
                                                                                {d.raca && <span className="text-[11px] text-muted-foreground">({d.raca})</span>}
                                                                            </div>
                                                                            <div className="flex items-center gap-2 shrink-0">
                                                                                <span className="text-[11px] text-muted-foreground">{d.totalAspiracoes} asp.</span>
                                                                                <span className={cn(
                                                                                    "text-[12px] font-black px-2 py-0.5 rounded-full",
                                                                                    d.mediaOocitos < 5 ? "bg-red-500/10 text-red-700" : d.mediaOocitos < 10 ? "bg-amber-500/10 text-amber-700" : "bg-emerald-500/10 text-emerald-700"
                                                                                )}>
                                                                                    {d.mediaOocitos} ooc/asp
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                />
                                                            ) :
                                                                /* === ANALISE_REPETIDORAS Card === */
                                                                msg.intentData.tipo === 'ANALISE_REPETIDORAS' && msg.intentData.animais?.length > 0 ? (
                                                                    <AnimalListCard
                                                                        icon={<Repeat2 className="w-4 h-4" />}
                                                                        title="Repetidoras"
                                                                        total={msg.intentData.total}
                                                                        accentColor="red"
                                                                        summary={`Min. ${msg.intentData.minProtocolos} protocolos sem prenhez`}
                                                                        items={msg.intentData.animais}
                                                                        onExport={() => exportGenIAPdf(msg.intentData)}
                                                                        onExpand={() => openFullscreen(msg.intentData)}
                                                                        renderItem={(a: any) => (
                                                                            <div className="flex items-center justify-between gap-2 py-1.5">
                                                                                <span className="font-bold text-[13px] text-foreground truncate">{a.identificacao}</span>
                                                                                <div className="flex items-center gap-2 shrink-0">
                                                                                    <span className={cn(
                                                                                        "text-[12px] font-black px-2 py-0.5 rounded-full",
                                                                                        a.protocolosSemPrenhez >= 5 ? "bg-red-500/15 text-red-700" : "bg-amber-500/15 text-amber-700"
                                                                                    )}>
                                                                                        {a.protocolosSemPrenhez}x sem prenhez
                                                                                    </span>
                                                                                    <span className="text-[11px] text-muted-foreground">{a.totalProtocolos} total</span>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    />
                                                                ) :
                                                                    /* === PROXIMOS_PARTOS Card === */
                                                                    msg.intentData.tipo === 'PROXIMOS_PARTOS' && msg.intentData.animais?.length > 0 ? (
                                                                        <AnimalListCard
                                                                            icon={<Baby className="w-4 h-4" />}
                                                                            title="Próximos Partos"
                                                                            total={msg.intentData.total}
                                                                            accentColor="amber"
                                                                            summary={msg.intentData.urgentes > 0 ? `${msg.intentData.urgentes} urgente(s)` : undefined}
                                                                            items={msg.intentData.animais}
                                                                            onExport={() => exportGenIAPdf(msg.intentData)}
                                                                            onExpand={() => openFullscreen(msg.intentData)}
                                                                            renderItem={(a: any) => (
                                                                                <div className="flex items-center justify-between gap-2 py-1.5">
                                                                                    <div className="flex items-center gap-2 min-w-0">
                                                                                        <UrgencyDot dias={a.diasRestantes} />
                                                                                        <span className="font-bold text-[13px] text-foreground truncate">{a.identificacao}</span>
                                                                                        <StatusBadge status={a.status} humanize={humanizeStatus} />
                                                                                    </div>
                                                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                                                        <span className="text-[11px] text-muted-foreground">{formatDateBR(a.dataPartoPrevista)}</span>
                                                                                        <span className={cn("text-[11px] font-bold", a.diasRestantes <= 0 ? "text-red-600" : a.diasRestantes <= 7 ? "text-amber-600" : "text-muted-foreground")}>
                                                                                            {a.diasRestantes <= 0 ? `${Math.abs(a.diasRestantes)}d atrasado` : `${a.diasRestantes}d`}
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        />
                                                                    ) :
                                                                        /* === PROXIMOS_SERVICOS Card === */
                                                                        msg.intentData.tipo === 'PROXIMOS_SERVICOS' && msg.intentData.itens?.length > 0 ? (
                                                                            <AnimalListCard
                                                                                icon={<Clock className="w-4 h-4" />}
                                                                                title="Próximos Serviços"
                                                                                total={msg.intentData.total}
                                                                                summary={[
                                                                                    msg.intentData.urgentes > 0 ? `${msg.intentData.urgentes} urgente(s)` : null,
                                                                                    msg.intentData.passados > 0 ? `${msg.intentData.passados} atrasado(s)` : null,
                                                                                ].filter(Boolean).join(' | ') || undefined}
                                                                                items={msg.intentData.itens}
                                                                                onExport={() => exportGenIAPdf(msg.intentData)}
                                                                                onExpand={() => openFullscreen(msg.intentData)}
                                                                                renderItem={(i: any) => (
                                                                                    <div className="flex items-center justify-between gap-2 py-1.5">
                                                                                        <div className="flex items-center gap-2 min-w-0">
                                                                                            <UrgencyDot dias={i.diasRestantes} />
                                                                                            <span className="font-bold text-[13px] text-foreground truncate">{i.identificacao}</span>
                                                                                        </div>
                                                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                                                            <EtapaBadge etapa={i.etapa} />
                                                                                            <span className="text-[11px] text-muted-foreground">{formatDateBR(i.dataEsperada)}</span>
                                                                                            <span className={cn("text-[11px] font-bold", i.diasRestantes < 0 ? "text-red-600" : i.diasRestantes <= 2 ? "text-amber-600" : "text-muted-foreground")}>
                                                                                                {i.diasRestantes < 0 ? `${Math.abs(i.diasRestantes)}d atrasado` : i.diasRestantes === 0 ? 'hoje' : `${i.diasRestantes}d`}
                                                                                            </span>
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            />
                                                                        ) :
                                                                            /* === CATALOGO_GENETICA Card === */
                                                                            msg.intentData.tipo === 'CATALOGO_GENETICA' && msg.intentData.itens?.length > 0 ? (
                                                                                <CatalogoGeneticaCard intentData={msg.intentData} onExpand={() => openFullscreen(msg.intentData)} />
                                                                            ) :
                                                                            /* === MEU_BOTIJAO Card === */
                                                                            msg.intentData.tipo === 'MEU_BOTIJAO' ? (
                                                                                <MeuBotijaoCard intentData={msg.intentData} onExpand={() => openFullscreen(msg.intentData)} />
                                                                            ) :
                                                                            /* === MINHAS_RESERVAS Card === */
                                                                            msg.intentData.tipo === 'MINHAS_RESERVAS' && msg.intentData.itens?.length > 0 ? (
                                                                                <MinhasReservasCard intentData={msg.intentData} onExpand={() => openFullscreen(msg.intentData)} />
                                                                            ) :
                                                                            /* === RECOMENDACAO_GENETICA Card === */
                                                                            msg.intentData.tipo === 'RECOMENDACAO_GENETICA' && msg.intentData.cruzamentos?.length > 0 ? (
                                                                                <RecomendacaoGeneticaCard intentData={msg.intentData} onExpand={() => openFullscreen(msg.intentData)} />
                                                                            ) :
                                                                            /* === DESEMPENHO_VET Card === */
                                                                            (msg.intentData.tipo === 'DESEMPENHO_VET' || msg.intentData.tipo === 'DESEMPENHO_TOURO' || msg.intentData.tipo === 'COMPARACAO_FAZENDAS') && msg.intentData.veterinarios?.length > 0 ? (
                                                                                <div className="mt-2 bg-background/50 border border-violet-500/20 rounded-xl p-4 shadow-sm">
                                                                                    <div className="flex items-center gap-2 text-violet-700 font-semibold mb-3 border-b border-violet-500/10 pb-2">
                                                                                        <Award className="w-4 h-4" />
                                                                                        Desempenho Veterinário
                                                                                        <div className="flex items-center gap-2 ml-auto">
                                                                                            {msg.intentData.periodo && (
                                                                                                <span className="text-xs bg-violet-500/10 text-violet-700 px-2 py-0.5 rounded-full">{msg.intentData.periodo}</span>
                                                                                            )}
                                                                                            <ExportPdfButton intentData={msg.intentData} />
                                                                                            <ExpandButton onClick={() => openFullscreen(msg.intentData)} />
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="flex flex-col gap-2">
                                                                                        {msg.intentData.veterinarios.map((v: any, i: number) => (
                                                                                            <div key={i} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg hover:bg-muted/30">
                                                                                                <div className="flex items-center gap-2">
                                                                                                    <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black", i === 0 ? "bg-amber-500/20 text-amber-700" : "bg-muted text-muted-foreground")}>{i + 1}</span>
                                                                                                    <span className="font-bold text-[13px] text-foreground">{v.nome}</span>
                                                                                                </div>
                                                                                                <div className="flex items-center gap-3 shrink-0">
                                                                                                    <span className="text-[11px] text-muted-foreground">{v.total} DGs</span>
                                                                                                    <span className="text-[11px] text-emerald-700 font-bold">{v.prenhes} prenhes</span>
                                                                                                    <span className={cn("text-[12px] font-black px-2 py-0.5 rounded-full", parseFloat(v.taxa) >= 50 ? "bg-emerald-500/10 text-emerald-700" : "bg-red-500/10 text-red-700")}>{v.taxa}</span>
                                                                                                </div>
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            ) :
                                                                                /* === PROTOCOLOS Card === */
                                                                                /* === ESTOQUE_SEMEN Card === */
                                                                                msg.intentData.tipo === 'ESTOQUE_SEMEN' && msg.intentData.itens?.length > 0 ? (
                                                                                    <AnimalListCard
                                                                                        icon={<BarChart3 className="w-4 h-4" />}
                                                                                        title="Estoque de Sêmen"
                                                                                        total={msg.intentData.total}
                                                                                        items={msg.intentData.itens}
                                                                                        onExport={() => exportGenIAPdf(msg.intentData)}
                                                                                        onExpand={() => openFullscreen(msg.intentData)}
                                                                                        renderItem={(item: any) => (
                                                                                            <div className="flex items-center justify-between gap-2 py-1.5">
                                                                                                <span className="font-bold text-[13px] text-foreground truncate">{item.touro}</span>
                                                                                                <div className="flex items-center gap-2 shrink-0">
                                                                                                    {item.raca && <span className="text-[11px] text-muted-foreground">({item.raca})</span>}
                                                                                                    <span className="text-[12px] font-black px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700">
                                                                                                        {item.doses} doses
                                                                                                    </span>
                                                                                                </div>
                                                                                            </div>
                                                                                        )}
                                                                                    />
                                                                                ) :
                                                                                    /* === ESTOQUE_EMBRIOES Card === */
                                                                                    msg.intentData.tipo === 'ESTOQUE_EMBRIOES' && msg.intentData.itens?.length > 0 ? (
                                                                                        <div className="mt-2 bg-background/50 border border-cyan-500/20 rounded-xl p-4 shadow-sm">
                                                                                            <div className="flex items-center gap-2 text-cyan-700 font-semibold mb-3 border-b border-cyan-500/10 pb-2">
                                                                                                <Snowflake className="w-4 h-4" />
                                                                                                Embriões Congelados
                                                                                                <div className="flex items-center gap-2 ml-auto">
                                                                                                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-bold">{msg.intentData.total}</span>
                                                                                                    <ExportPdfButton intentData={msg.intentData} />
                                                                                                    <ExpandButton onClick={() => openFullscreen(msg.intentData)} />
                                                                                                </div>
                                                                                            </div>
                                                                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                                                                {msg.intentData.itens.slice(0, 12).map((item: any, i: number) => (
                                                                                                    <div key={i} className="flex items-center justify-between gap-1 px-2 py-1.5 rounded-lg bg-muted/30">
                                                                                                        <span className="text-[12px] font-bold text-foreground truncate">{item.classificacao}</span>
                                                                                                        <span className="text-[12px] font-black text-cyan-700">{item.quantidade}</span>
                                                                                                    </div>
                                                                                                ))}
                                                                                            </div>
                                                                                        </div>
                                                                                    ) :
                                                                                        msg.intentData.tipo === 'PROTOCOLOS' ? (
                                                                                            <div className="mt-2 bg-background/50 border border-primary/20 rounded-xl p-4 shadow-sm">
                                                                                                <div className="flex items-center justify-between mb-3 border-b border-primary/10 pb-2">
                                                                                                    <div className="flex items-center gap-2 text-primary-dark font-semibold">
                                                                                                        <BarChart3 className="w-4 h-4" />
                                                                                                        Relatório de Protocolos
                                                                                                    </div>
                                                                                                    <div className="flex items-center gap-2">
                                                                                                        {msg.intentData.periodo && (
                                                                                                            <span className="text-xs bg-primary/10 text-primary-dark px-2 py-0.5 rounded-full">{msg.intentData.periodo}</span>
                                                                                                        )}
                                                                                                        <ExportPdfButton intentData={msg.intentData} />
                                                                                                        <ExpandButton onClick={() => openFullscreen(msg.intentData)} />
                                                                                                    </div>
                                                                                                </div>
                                                                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                                                                    <div className="flex flex-col">
                                                                                                        <span className="text-xs text-muted-foreground uppercase font-medium">Protocolos</span>
                                                                                                        <span className="text-lg font-bold text-foreground">{msg.intentData.totalProtocolos}</span>
                                                                                                    </div>
                                                                                                    <div className="flex flex-col">
                                                                                                        <span className="text-xs text-muted-foreground uppercase font-medium">Receptoras</span>
                                                                                                        <span className="text-lg font-bold text-foreground">{msg.intentData.totalReceptoras}</span>
                                                                                                    </div>
                                                                                                    <div className="flex flex-col">
                                                                                                        <span className="text-xs text-muted-foreground uppercase font-medium">Aptas</span>
                                                                                                        <span className="text-lg font-bold text-emerald-600">{msg.intentData.aptas}</span>
                                                                                                    </div>
                                                                                                    <div className="flex flex-col">
                                                                                                        <span className="text-xs text-muted-foreground uppercase font-medium">Inaptas</span>
                                                                                                        <span className="text-lg font-bold text-red-500">{msg.intentData.inaptas}</span>
                                                                                                    </div>
                                                                                                </div>
                                                                                            </div>
                                                                                        ) :
                                                                                            msg.intentData.tipo === 'BUSCA_ANIMAL' && msg.intentData.categoria !== 'Não Encontrado na Base Principal' ? (
                                                                                                <div className="mt-3 glass-panel border border-primary/20 rounded-xl overflow-hidden shadow-md">
                                                                                                    <div className="bg-primary/10 px-4 py-3 flex justify-between items-center border-b border-primary/20">
                                                                                                        <div className="flex items-center gap-3">
                                                                                                            <div className="w-10 h-10 rounded-full bg-primary/20 flex flex-col items-center justify-center border border-primary/30 shadow-inner">
                                                                                                                <span className="text-primary-dark font-black text-sm">
                                                                                                                    {msg.intentData.categoria?.[0] || 'A'}
                                                                                                                </span>
                                                                                                            </div>
                                                                                                            <div className="flex flex-col">
                                                                                                                <span className="text-[10px] uppercase tracking-wider text-primary font-bold leading-tight mb-0.5 opacity-80">{msg.intentData.categoria}</span>
                                                                                                                <span className="text-lg font-black text-foreground leading-none tracking-tight">{msg.intentData.nomeEncontrado}</span>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                        <div className="flex items-center gap-2">
                                                                                                        <ExpandButton onClick={() => openFullscreen(msg.intentData)} />
                                                                                                        <span className={cn(
                                                                                                            "px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider shadow-sm",
                                                                                                            msg.intentData.status?.toUpperCase()?.includes('PRENHE') ? "bg-emerald-500/15 text-emerald-700 border border-emerald-500/20" :
                                                                                                                msg.intentData.status?.toUpperCase()?.includes('VAZIA') ? "bg-red-500/15 text-red-700 border border-red-500/20" :
                                                                                                                    msg.intentData.status?.toUpperCase()?.includes('PARIDA') ? "bg-teal-500/15 text-teal-700 border border-teal-500/20" :
                                                                                                                        "bg-muted text-muted-foreground border border-border"
                                                                                                        )}>
                                                                                                            {humanizeStatus(msg.intentData.status)}
                                                                                                        </span>
                                                                                                        </div>
                                                                                                    </div>

                                                                                                    <div className="p-4 flex flex-col gap-5">
                                                                                                        {/* Info Grid */}
                                                                                                        <div className="flex flex-wrap gap-6 bg-background/50 rounded-lg p-3 border border-border/40">
                                                                                                            {msg.intentData.raca && msg.intentData.raca !== 'N/A' && (
                                                                                                                <div className="flex flex-col gap-1">
                                                                                                                    <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Raça</span>
                                                                                                                    <div className="text-[15px] font-bold text-foreground bg-primary/5 px-2.5 py-1 rounded-md border border-primary/10">{msg.intentData.raca}</div>
                                                                                                                </div>
                                                                                                            )}
                                                                                                            {msg.intentData.cioLivre && msg.intentData.cioLivre === 'Sim' && (
                                                                                                                <div className="flex flex-col gap-1">
                                                                                                                    <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Cio Livre</span>
                                                                                                                    <div className="text-[15px] font-bold text-blue-600 flex items-center gap-1.5 bg-blue-500/5 px-2.5 py-1 rounded-md border border-blue-500/10">
                                                                                                                        <CheckCircle2 className="w-4 h-4" /> Sim, Ativa
                                                                                                                    </div>
                                                                                                                </div>
                                                                                                            )}
                                                                                                            {msg.intentData.dataPartoPrevista && (
                                                                                                                <div className="flex flex-col gap-1">
                                                                                                                    <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Previsão de Parto</span>
                                                                                                                    <div className="text-[15px] font-bold text-foreground bg-primary/5 px-2.5 py-1 rounded-md border border-primary/10 flex items-center gap-1.5">
                                                                                                                        <Calendar className="w-4 h-4 text-primary" />
                                                                                                                        {new Date(msg.intentData.dataPartoPrevista + 'T00:00:00').toLocaleDateString('pt-BR')}
                                                                                                                    </div>
                                                                                                                </div>
                                                                                                            )}
                                                                                                            {msg.intentData.cruzamento && (
                                                                                                                <div className="flex flex-col gap-1 w-full mt-1">
                                                                                                                    <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Cruzamento Atual</span>
                                                                                                                    <div className="text-[14px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/5 px-3 py-1.5 rounded-md border border-emerald-500/20 flex flex-wrap gap-1.5 items-center">
                                                                                                                        <span>{msg.intentData.cruzamento.doadora}</span>
                                                                                                                        <span className="text-muted-foreground font-normal text-xs mx-1">×</span>
                                                                                                                        <span>{msg.intentData.cruzamento.touro}</span>
                                                                                                                    </div>
                                                                                                                </div>
                                                                                                            )}
                                                                                                        </div>

                                                                                                        {/* History */}
                                                                                                        {msg.intentData.historico && Array.isArray(msg.intentData.historico) && msg.intentData.historico.length > 0 && (
                                                                                                            <div className="pt-4 border-t border-border/40 relative">
                                                                                                                <div className="absolute -top-3 left-4 glass-panel px-2">
                                                                                                                    <span className="text-[10px] text-primary-dark uppercase font-black tracking-widest flex items-center gap-1.5">
                                                                                                                        <Activity className="w-3.5 h-3.5" /> Últimos Eventos
                                                                                                                    </span>
                                                                                                                </div>
                                                                                                                <div className="flex flex-col gap-3 mt-2">
                                                                                                                    {msg.intentData.historico.map((hx: any, i: number) => {
                                                                                                                        const conf = tipoIconConfig[hx.tipo] || { icon: Activity, className: 'text-primary' };
                                                                                                                        const badgeConf = tipoBadgeConfig[hx.tipo];
                                                                                                                        const Icon = conf.icon;

                                                                                                                        return (
                                                                                                                            <div key={i} className="flex items-center justify-between group relative pl-5">
                                                                                                                                {/* Timeline line */}
                                                                                                                                {i !== msg.intentData.historico.length - 1 && (
                                                                                                                                    <div className="absolute top-4 left-[0.22rem] w-[2px] h-full bg-primary/10 rounded-full" />
                                                                                                                                )}
                                                                                                                                {/* Timeline dot */}
                                                                                                                                <div className="absolute top-1.5 left-0 w-2 h-2 rounded-full bg-primary/40 ring-4 ring-card group-hover:bg-primary transition-colors z-10 shadow-sm" />

                                                                                                                                <div className="flex flex-col flex-1 pl-2">
                                                                                                                                    <span className="text-[13px] font-bold text-foreground flex items-center gap-1.5">
                                                                                                                                        <Icon className={cn("w-3.5 h-3.5", conf.className)} />
                                                                                                                                        {badgeConf ? badgeConf.label : hx.tipo}
                                                                                                                                    </span>
                                                                                                                                    <span className="text-[11px] font-medium text-muted-foreground mt-0.5">{hx.resumo}</span>
                                                                                                                                    {hx.detalhes && (
                                                                                                                                        <span className="text-[10px] text-muted-foreground mt-0.5 max-w-[90%] truncate opacity-80">{hx.detalhes}</span>
                                                                                                                                    )}
                                                                                                                                </div>

                                                                                                                                <div className="flex flex-col items-end gap-1 shrink-0">
                                                                                                                                    <span className="text-[11px] font-bold text-muted-foreground bg-muted/50 px-2 rounded-sm">{hx.data ? new Date(hx.data + 'T00:00:00').toLocaleDateString('pt-BR') : '-'}</span>
                                                                                                                                </div>
                                                                                                                            </div>
                                                                                                                        )
                                                                                                                    })}
                                                                                                                </div>
                                                                                                            </div>
                                                                                                        )}
                                                                                                    </div>
                                                                                                </div>
                                                                                            ) : (() => {
                                                                                                const tipoLabels: Record<string, string> = {
                                                                                                    LISTA_RECEPTORAS: 'Receptoras', LISTA_DOADORAS: 'Doadoras', ANALISE_REPETIDORAS: 'Repetidoras',
                                                                                                    PROXIMOS_PARTOS: 'Próximos Partos', PROXIMOS_SERVICOS: 'Próximos Serviços',
                                                                                                    DESEMPENHO_VET: 'Desempenho Veterinário', DESEMPENHO_TOURO: 'Desempenho por Touro',
                                                                                                    COMPARACAO_FAZENDAS: 'Comparação de Fazendas', ESTOQUE_SEMEN: 'Estoque de Sêmen',
                                                                                                    ESTOQUE_EMBRIOES: 'Embriões Congelados', NASCIMENTOS: 'Nascimentos',
                                                                                                    RESUMO: 'Resumo Geral', TE: 'Transferência de Embriões', DG: 'Diagnóstico de Gestação',
                                                                                                    ASPIRACAO: 'Aspiração', SEXAGEM: 'Sexagem', RECEPTORAS: 'Receptoras',
                                                                                                    REBANHO: 'Rebanho', PROTOCOLOS: 'Protocolos', BUSCA_ANIMAL: 'Busca de Animal',
                                                                                                    CATALOGO_GENETICA: 'Catálogo de Genética', MEU_BOTIJAO: 'Meu Botijão',
                                                                                                    MINHAS_RESERVAS: 'Minhas Reservas', RECOMENDACAO_GENETICA: 'Sugestões de Genética',
                                                                                                };
                                                                                                const tipoLabel = tipoLabels[msg.intentData.tipo] || msg.intentData.tipo;
                                                                                                const isEmptyList = msg.intentData.total === 0 && ['LISTA_RECEPTORAS', 'LISTA_DOADORAS', 'ANALISE_REPETIDORAS', 'PROXIMOS_PARTOS', 'PROXIMOS_SERVICOS', 'ESTOQUE_SEMEN', 'ESTOQUE_EMBRIOES', 'NASCIMENTOS', 'DESEMPENHO_TOURO', 'COMPARACAO_FAZENDAS', 'CATALOGO_GENETICA', 'MINHAS_RESERVAS'].includes(msg.intentData.tipo);
                                                                                                return (
                                                                                                    <div className="mt-2 bg-background/50 border border-primary/20 rounded-xl p-4 shadow-sm">
                                                                                                        <div className="flex items-center justify-between mb-3 border-b border-primary/10 pb-2">
                                                                                                            <div className="flex items-center gap-2 text-primary-dark font-semibold">
                                                                                                                <BarChart3 className="w-4 h-4" />
                                                                                                                {msg.intentData.tipo === 'BUSCA_ANIMAL' ? 'Busca Falhou' : tipoLabel}
                                                                                                            </div>
                                                                                                            <div className="flex items-center gap-2">
                                                                                                                {msg.intentData.periodo && (
                                                                                                                    <span className="text-xs bg-primary/10 text-primary-dark px-2 py-0.5 rounded-full">
                                                                                                                        {msg.intentData.periodo}
                                                                                                                    </span>
                                                                                                                )}
                                                                                                                {!isEmptyList && <ExportPdfButton intentData={msg.intentData} />}
                                                                                                                {!isEmptyList && <ExpandButton onClick={() => openFullscreen(msg.intentData)} />}
                                                                                                            </div>
                                                                                                        </div>

                                                                                                        {msg.intentData.tipo === 'BUSCA_ANIMAL' && msg.intentData.mensagem ? (
                                                                                                            <div className="text-sm text-muted-foreground flex items-center gap-2 bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                                                                                                                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                                                                                                                <span className="text-red-700/90 font-medium">{msg.intentData.mensagem}</span>
                                                                                                            </div>
                                                                                                        ) : isEmptyList ? (
                                                                                                            <div className="flex flex-col gap-2">
                                                                                                                <div className="text-sm text-muted-foreground flex items-center gap-2 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
                                                                                                                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                                                                                                                    <span className="font-medium text-amber-800">
                                                                                                                        {msg.intentData.motivo || 'Nenhum resultado encontrado para esta consulta.'}
                                                                                                                    </span>
                                                                                                                </div>
                                                                                                                {msg.intentData.totalGeral != null && (
                                                                                                                    <div className="grid grid-cols-3 gap-2 text-center">
                                                                                                                        <div className="bg-muted/30 rounded-lg p-2">
                                                                                                                            <div className="text-lg font-bold text-foreground">{msg.intentData.totalGeral}</div>
                                                                                                                            <div className="text-[10px] text-muted-foreground uppercase font-medium">Total</div>
                                                                                                                        </div>
                                                                                                                        <div className="bg-muted/30 rounded-lg p-2">
                                                                                                                            <div className="text-lg font-bold text-amber-600">{msg.intentData.totalVazias ?? 0}</div>
                                                                                                                            <div className="text-[10px] text-muted-foreground uppercase font-medium">Vazias</div>
                                                                                                                        </div>
                                                                                                                        <div className="bg-muted/30 rounded-lg p-2">
                                                                                                                            <div className="text-lg font-bold text-red-500">{msg.intentData.emProtocolo ?? 0}</div>
                                                                                                                            <div className="text-[10px] text-muted-foreground uppercase font-medium">Em Protocolo</div>
                                                                                                                        </div>
                                                                                                                    </div>
                                                                                                                )}
                                                                                                            </div>
                                                                                                        ) : (
                                                                                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                                                                                {msg.intentData.total !== undefined && (
                                                                                                                    <div className="flex flex-col">
                                                                                                                        <span className="text-xs text-muted-foreground uppercase font-medium">Total</span>
                                                                                                                        <span className="text-lg font-bold text-foreground">{msg.intentData.total}</span>
                                                                                                                    </div>
                                                                                                                )}
                                                                                                                {msg.intentData.totalAnimais !== undefined && (
                                                                                                                    <div className="flex flex-col">
                                                                                                                        <span className="text-xs text-muted-foreground uppercase font-medium">Bezerros/Animais</span>
                                                                                                                        <span className="text-lg font-bold text-foreground">{msg.intentData.totalAnimais}</span>
                                                                                                                    </div>
                                                                                                                )}
                                                                                                                {msg.intentData.totalDoadoras !== undefined && (
                                                                                                                    <div className="flex flex-col">
                                                                                                                        <span className="text-xs text-muted-foreground uppercase font-medium">Doadoras</span>
                                                                                                                        <span className="text-lg font-bold text-emerald-600">{msg.intentData.totalDoadoras}</span>
                                                                                                                    </div>
                                                                                                                )}
                                                                                                                {msg.intentData.realizadas !== undefined && (
                                                                                                                    <div className="flex flex-col">
                                                                                                                        <span className="text-xs text-muted-foreground uppercase font-medium">Realizadas</span>
                                                                                                                        <span className="text-lg font-bold text-emerald-600">{msg.intentData.realizadas}</span>
                                                                                                                    </div>
                                                                                                                )}
                                                                                                                {msg.intentData.receptorasComTE !== undefined && (
                                                                                                                    <div className="flex flex-col">
                                                                                                                        <span className="text-xs text-muted-foreground uppercase font-medium">Receptoras</span>
                                                                                                                        <span className="text-lg font-bold text-foreground">{msg.intentData.receptorasComTE}</span>
                                                                                                                    </div>
                                                                                                                )}
                                                                                                                {msg.intentData.comDG !== undefined && msg.intentData.comDG > 0 && (
                                                                                                                    <div className="flex flex-col">
                                                                                                                        <span className="text-xs text-muted-foreground uppercase font-medium">Com DG</span>
                                                                                                                        <span className="text-lg font-bold text-foreground">{msg.intentData.comDG}</span>
                                                                                                                    </div>
                                                                                                                )}
                                                                                                                {msg.intentData.aguardandoDG > 0 && (
                                                                                                                    <div className="flex flex-col">
                                                                                                                        <span className="text-xs text-muted-foreground uppercase font-medium">Aguard. DG</span>
                                                                                                                        <span className="text-lg font-bold text-amber-600">{msg.intentData.aguardandoDG}</span>
                                                                                                                    </div>
                                                                                                                )}
                                                                                                                {msg.intentData.taxaPrenhez && (
                                                                                                                    <div className="flex flex-col">
                                                                                                                        <span className="text-xs text-muted-foreground uppercase font-medium">Tx. Prenhez</span>
                                                                                                                        <span className="text-lg font-bold text-emerald-600">{msg.intentData.taxaPrenhez}</span>
                                                                                                                    </div>
                                                                                                                )}
                                                                                                                {msg.intentData.taxaAproveitamento && (
                                                                                                                    <div className="flex flex-col">
                                                                                                                        <span className="text-xs text-muted-foreground uppercase font-medium">Tx. Aproveit.</span>
                                                                                                                        <span className="text-lg font-bold text-emerald-600">{msg.intentData.taxaAproveitamento}</span>
                                                                                                                    </div>
                                                                                                                )}
                                                                                                                {msg.intentData.positivos !== undefined && (
                                                                                                                    <div className="flex flex-col">
                                                                                                                        <span className="text-xs text-muted-foreground uppercase font-medium">Positivos</span>
                                                                                                                        <span className="text-lg font-bold text-foreground">{msg.intentData.positivos}</span>
                                                                                                                    </div>
                                                                                                                )}
                                                                                                                {msg.intentData.vazias !== undefined && (
                                                                                                                    <div className="flex flex-col">
                                                                                                                        <span className="text-xs text-muted-foreground uppercase font-medium">Vazias</span>
                                                                                                                        <span className="text-lg font-bold text-red-500">{msg.intentData.vazias}</span>
                                                                                                                    </div>
                                                                                                                )}
                                                                                                                {msg.intentData.prenhes !== undefined && (
                                                                                                                    <div className="flex flex-col">
                                                                                                                        <span className="text-xs text-muted-foreground uppercase font-medium">Prenhes</span>
                                                                                                                        <span className="text-lg font-bold text-emerald-600">{msg.intentData.prenhes}</span>
                                                                                                                    </div>
                                                                                                                )}
                                                                                                                {msg.intentData.cioLivre !== undefined && msg.intentData.tipo !== 'BUSCA_ANIMAL' && (
                                                                                                                    <div className="flex flex-col">
                                                                                                                        <span className="text-xs text-muted-foreground uppercase font-medium">Cio Livre</span>
                                                                                                                        <span className="text-lg font-bold text-blue-500">{msg.intentData.cioLivre}</span>
                                                                                                                    </div>
                                                                                                                )}
                                                                                                                {msg.intentData.machos !== undefined && (
                                                                                                                    <div className="flex flex-col">
                                                                                                                        <span className="text-xs text-muted-foreground uppercase font-medium">Machos</span>
                                                                                                                        <span className="text-lg font-bold text-blue-600">{msg.intentData.machos}</span>
                                                                                                                    </div>
                                                                                                                )}
                                                                                                                {msg.intentData.femeas !== undefined && (
                                                                                                                    <div className="flex flex-col">
                                                                                                                        <span className="text-xs text-muted-foreground uppercase font-medium">Fêmeas</span>
                                                                                                                        <span className="text-lg font-bold text-pink-600">{msg.intentData.femeas}</span>
                                                                                                                    </div>
                                                                                                                )}
                                                                                                                {msg.intentData.totalSessoes !== undefined && (
                                                                                                                    <div className="flex flex-col">
                                                                                                                        <span className="text-xs text-muted-foreground uppercase font-medium">Sessões</span>
                                                                                                                        <span className="text-lg font-bold text-foreground">{msg.intentData.totalSessoes}</span>
                                                                                                                    </div>
                                                                                                                )}
                                                                                                                {msg.intentData.tourosComEstoque !== undefined && (
                                                                                                                    <div className="flex flex-col">
                                                                                                                        <span className="text-xs text-muted-foreground uppercase font-medium">Touros c/ Estoque</span>
                                                                                                                        <span className="text-lg font-bold text-blue-600">{msg.intentData.tourosComEstoque}</span>
                                                                                                                    </div>
                                                                                                                )}
                                                                                                                {msg.intentData.partosProximos !== undefined && (
                                                                                                                    <div className="flex flex-col">
                                                                                                                        <span className="text-xs text-muted-foreground uppercase font-medium">Partos Próx. 30d</span>
                                                                                                                        <span className="text-lg font-bold text-amber-600">{msg.intentData.partosProximos}</span>
                                                                                                                    </div>
                                                                                                                )}
                                                                                                            </div>
                                                                                                        )}
                                                                                                    </div>
                                                                                                );
                                                                                            })()
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Follow-up chips — só na última msg da IA, se não está carregando */}
                                    {i === messages.length - 1 && !msg.isSearching && !isLoading && (
                                        <div className="max-w-[95%] md:max-w-full mt-1.5 ml-1">
                                            <SuggestionChips
                                                chips={getFollowUpSuggestions(msg.intentData).map(s => ({ label: s, query: s }))}
                                                onSelect={(text) => handleSend(text)}
                                            />
                                        </div>
                                    )}

                                    {/* Lado Direito (Conector MD+) */}
                                    <div className="hidden md:flex items-center justify-start w-full pl-[15px] pt-5 opacity-70">
                                        <div className={cn("w-2.5 h-2.5 rounded-full border-2 border-background shrink-0 -translate-x-[20px] transition-colors", msg.isSearching ? "bg-primary/40 animate-pulse" : "bg-primary")} />
                                        <div className="h-[2px] w-[30%] bg-gradient-to-r from-primary/50 to-transparent" />
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Bar — Living Input Bar (mic/send/waveform unificados) */}
            <UnifiedInputBar
                input={input}
                setInput={setInput}
                isLoading={isLoading}
                isListening={isListening}
                onSend={() => handleSend(input)}
                onStartListening={startListening}
            />

            {/* Fullscreen Report Viewer */}
            {fullscreenReport && (
                <ReportFullscreenViewer
                    open={!!fullscreenReport}
                    onClose={() => setFullscreenReport(null)}
                    title={fullscreenReport.title}
                    onExportPdf={hasExportableData(fullscreenReport.intentData) ? () => exportGenIAPdf(fullscreenReport.intentData) : undefined}
                >
                    <FullscreenReportContent intentData={fullscreenReport.intentData} humanizeStatus={humanizeStatus} />
                </ReportFullscreenViewer>
            )}
        </div>
    );
}
