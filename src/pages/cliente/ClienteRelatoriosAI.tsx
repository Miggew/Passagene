import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { useClienteHubData } from '@/hooks/cliente';
import { Send, Sparkles, User, ArrowRight, BarChart3, CheckCircle2, Activity, AlertCircle, Calendar, ListChecks, ChevronDown, Award, Baby, Clock, Repeat2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LoadingInline } from '@/components/shared/LoadingScreen';
import { fetchReportDataFromIntent, type AIIntent } from '@/services/aiReportService';
import { tipoIconConfig, tipoBadgeConfig } from '@/lib/receptoraHistoricoUtils';
import { formatDateBR } from '@/lib/dateUtils';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    isSearching?: boolean;
    intentData?: any;
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

function AnimalListCard({ icon, title, total, mostrando, accentColor, summary, items, renderItem }: {
    icon: React.ReactNode;
    title: string;
    total: number;
    mostrando?: number;
    accentColor?: 'red' | 'amber' | string;
    summary?: string;
    items: any[];
    renderItem: (item: any) => React.ReactNode;
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
                {mostrando != null && mostrando < total && (
                    <span className="text-[10px] text-muted-foreground">mostrando {mostrando} de {total}</span>
                )}
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

// === Persist messages across navigation (resets on page reload) ===
const WELCOME_MESSAGE: Message = {
    id: 'welcome',
    role: 'assistant',
    content: 'Olá! Sou o seu Assistente de IA PassaGene. Posso buscar relatórios de aspiração, transferência de embriões, ou analisar o desempenho do seu rebanho e veterinários. O que você gostaria de saber hoje?'
};
let persistedMessages: Message[] = [];

// === Main Component ===

export default function ClienteRelatoriosAI() {
    const { clienteId } = usePermissions();
    const { toast } = useToast();
    const { data: hubData, isLoading: hubLoading } = useClienteHubData(clienteId);

    const humanizeStatus = (statusStr?: string | null) => {
        if (!statusStr) return 'Desconhecido';
        if (statusStr === 'PRENHE_DE_FEMEA') return 'Prenhe de Fêmea ♀️';
        if (statusStr === 'PRENHE_DE_MACHO') return 'Prenhe de Macho ♂️';
        if (statusStr === 'PRENHE_RETOQUE') return 'Prenhe (Retoque)';
        if (statusStr === 'PRENHE') return 'Prenhe';
        if (statusStr === 'VAZIA') return 'Vazia';
        return statusStr.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    };

    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>(
        persistedMessages.length > 0 ? persistedMessages : [WELCOME_MESSAGE]
    );
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => { persistedMessages = messages; }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

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
            const { data: session } = await supabase.auth.getSession();
            const token = session.session?.access_token;

            // Prepare history (last 6 messages, only user and reliable model messages)
            const historyToSend = messages
                .filter(m => !m.isSearching && m.role !== 'assistant' || (m.role === 'assistant' && !m.content.startsWith('*Aviso:*') && m.content))
                .slice(-6)
                .map(m => ({
                    role: m.role,
                    content: m.content
                }));

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
                    const errorBody = await res.json();
                    if (errorBody.error) errorMsg = errorBody.error;
                    if (errorBody.details) errorMsg += `\nDetalhes: ${errorBody.details}`;
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
                        effectiveReceptoraIds
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

    const suggestions = [
        "Quais os próximos partos?",
        "Quais receptoras posso protocolar?",
        "O que precisa ser feito essa semana?",
    ];

    if (hubLoading) {
        return <div className="flex h-[calc(100vh-100px)] items-center justify-center"><LoadingInline text="Carregando Córtex da Fazenda..." /></div>;
    }

    return (
        <div className="flex flex-col h-[calc(100dvh-120px)] max-w-4xl mx-auto pb-4">
            {/* Header */}
            <div className="flex items-center gap-3 px-2 py-4 border-b border-border/40">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                    <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                    <h1 className="text-xl font-semibold text-foreground">Consultor IA</h1>
                    <p className="text-sm text-muted-foreground">Relatórios dinâmicos e análises exclusivas do seu rebanho</p>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-2 py-6 space-y-6">
                {messages.map((msg) => (
                    <div key={msg.id} className={cn("flex w-full", msg.role === 'user' ? "justify-end" : "justify-start")}>
                        <div className={cn(
                            "flex max-w-[85%] gap-4",
                            msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                        )}>
                            {/* Avatar */}
                            <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1",
                                msg.role === 'user' ? "bg-muted" : "bg-primary text-primary-foreground"
                            )}>
                                {msg.role === 'user' ? <User className="w-4 h-4 text-muted-foreground" /> : <Sparkles className="w-4 h-4" />}
                            </div>

                            {/* Bubble */}
                            <div className={cn(
                                "rounded-2xl px-5 py-3.5 shadow-sm whitespace-pre-wrap text-[15px] leading-relaxed",
                                msg.role === 'user'
                                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                                    : "bg-card border border-border/50 rounded-tl-sm text-foreground/90"
                            )}>
                                {msg.isSearching ? (
                                    <div className="flex items-center gap-3 h-6">
                                        <span className="text-primary-dark font-medium animate-pulse">Consultando dados biológicos...</span>
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
                                                    renderItem={(a: any) => (
                                                        <div className="flex items-center justify-between gap-2 py-1.5">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <UrgencyDot dias={a.diasParaEtapa} />
                                                                <span className="font-bold text-[13px] text-foreground truncate">{a.identificacao}</span>
                                                                <StatusBadge status={a.status} humanize={humanizeStatus} />
                                                                {a.diasGestacao != null && (
                                                                    <span className="text-[11px] text-muted-foreground">({a.diasGestacao}d)</span>
                                                                )}
                                                            </div>
                                                            {a.etapaProxima && (
                                                                <div className="flex items-center gap-1.5 shrink-0">
                                                                    <EtapaBadge etapa={a.etapaProxima} />
                                                                    <span className="text-[11px] text-muted-foreground">{a.dataEtapa ? formatDateBR(a.dataEtapa) : ''}</span>
                                                                    {a.diasParaEtapa != null && (
                                                                        <span className={cn("text-[11px] font-bold", a.diasParaEtapa <= 0 ? "text-red-600" : a.diasParaEtapa <= 3 ? "text-amber-600" : "text-muted-foreground")}>
                                                                            {a.diasParaEtapa <= 0 ? 'hoje' : `${a.diasParaEtapa}d`}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
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
                                            /* === DESEMPENHO_VET Card === */
                                            msg.intentData.tipo === 'DESEMPENHO_VET' && msg.intentData.veterinarios?.length > 0 ? (
                                                <div className="mt-2 bg-background/50 border border-violet-500/20 rounded-xl p-4 shadow-sm">
                                                    <div className="flex items-center gap-2 text-violet-700 font-semibold mb-3 border-b border-violet-500/10 pb-2">
                                                        <Award className="w-4 h-4" />
                                                        Desempenho Veterinário
                                                        {msg.intentData.periodo && (
                                                            <span className="text-xs bg-violet-500/10 text-violet-700 px-2 py-0.5 rounded-full ml-auto">{msg.intentData.periodo}</span>
                                                        )}
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
                                            msg.intentData.tipo === 'PROTOCOLOS' ? (
                                                <div className="mt-2 bg-background/50 border border-primary/20 rounded-xl p-4 shadow-sm">
                                                    <div className="flex items-center justify-between mb-3 border-b border-primary/10 pb-2">
                                                        <div className="flex items-center gap-2 text-primary-dark font-semibold">
                                                            <BarChart3 className="w-4 h-4" />
                                                            Relatório de Protocolos
                                                        </div>
                                                        {msg.intentData.periodo && (
                                                            <span className="text-xs bg-primary/10 text-primary-dark px-2 py-0.5 rounded-full">{msg.intentData.periodo}</span>
                                                        )}
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
                                                <div className="mt-3 bg-card border border-primary/20 rounded-xl overflow-hidden shadow-md">
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
                                                                <div className="absolute -top-3 left-4 bg-card px-2">
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
                                            ) : (
                                                <div className="mt-2 bg-background/50 border border-primary/20 rounded-xl p-4 shadow-sm">
                                                    <div className="flex items-center justify-between mb-3 border-b border-primary/10 pb-2">
                                                        <div className="flex items-center gap-2 text-primary-dark font-semibold">
                                                            <BarChart3 className="w-4 h-4" />
                                                            {msg.intentData.tipo === 'BUSCA_ANIMAL' ? 'Busca Falhou' : `Relatório de ${msg.intentData.tipo}`}
                                                        </div>
                                                        {msg.intentData.periodo && (
                                                            <span className="text-xs bg-primary/10 text-primary-dark px-2 py-0.5 rounded-full">
                                                                {msg.intentData.periodo}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {msg.intentData.tipo === 'BUSCA_ANIMAL' && msg.intentData.mensagem ? (
                                                        <div className="text-sm text-muted-foreground flex items-center gap-2 bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                                                            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                                                            <span className="text-red-700/90 font-medium">{msg.intentData.mensagem}</span>
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
                                                            {msg.intentData.taxaPrenhez && (
                                                                <div className="flex flex-col">
                                                                    <span className="text-xs text-muted-foreground uppercase font-medium">Tx. Prenhez</span>
                                                                    <span className="text-lg font-bold text-emerald-600">{msg.intentData.taxaPrenhez}</span>
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
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="mt-auto px-2">
                {/* Suggestion Chips */}
                {messages.length <= 2 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                        {suggestions.map((sug, i) => (
                            <button
                                key={i}
                                onClick={() => handleSend(sug)}
                                className="text-xs px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary-dark hover:bg-primary/15 hover:border-primary/40 transition-all flex items-center gap-1.5"
                            >
                                {sug}
                                <ArrowRight className="w-3 h-3" />
                            </button>
                        ))}
                    </div>
                )}

                <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-[2rem] blur-md transition-all group-focus-within:bg-primary/20" />
                    <div className="relative flex items-end gap-2 bg-card border border-border/80 rounded-[2rem] p-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder="Ex: Qual veterinário teve o melhor aproveitamento esse ano?"
                            className="flex-1 max-h-32 min-h-[44px] bg-transparent border-0 focus:ring-0 resize-none py-3 px-4 text-sm scrollbar-thin outline-none"
                            rows={1}
                        />
                        <button
                            onClick={() => handleSend()}
                            disabled={!input.trim() || isLoading}
                            className="w-11 h-11 shrink-0 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground rounded-full flex items-center justify-center transition-all shadow-md mb-0.5 mr-0.5"
                        >
                            <Send className="w-4 h-4 ml-0.5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
