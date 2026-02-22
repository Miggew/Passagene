import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { useGlobalFarmData } from '@/hooks/useGlobalFarmData';
import { Send, Sparkles, User, ArrowRight, BarChart3, CheckCircle2, Activity, AlertCircle, Calendar, ListChecks, ChevronDown, Award, Baby, Clock, Repeat2, Snowflake, Download, Mic, MicOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LoadingInline } from '@/components/shared/LoadingScreen';
import { LogoPassagene } from '@/components/ui/LogoPassagene';
import { GeniaLogo } from '@/components/ui/GeniaLogo';
import { fetchReportDataFromIntent, type AIIntent } from '@/services/aiReportService';
import { tipoIconConfig, tipoBadgeConfig } from '@/lib/receptoraHistoricoUtils';
import { formatDateBR } from '@/lib/dateUtils';
import { exportToPdf, type PdfColumn } from '@/lib/exportPdf';

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
    if (['PROXIMOS_SERVICOS', 'ESTOQUE_SEMEN', 'ESTOQUE_EMBRIOES'].includes(tipo))
        return (intentData.itens?.length ?? 0) > 0;
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

function AnimalListCard({ icon, title, total, mostrando, accentColor, summary, items, renderItem, onExport }: {
    icon: React.ReactNode;
    title: string;
    total: number;
    mostrando?: number;
    accentColor?: 'red' | 'amber' | string;
    summary?: string;
    items: any[];
    renderItem: (item: any) => React.ReactNode;
    onExport?: () => void;
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

function ZeroStateHero({ onSuggestionClick }: { onSuggestionClick: (text: string) => void }) {
    return (
        <div className="flex flex-col items-center justify-center w-full max-w-2xl px-4 py-8 mx-auto text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="mb-6 flex items-center justify-center">
                <GeniaLogo size={80} showText={false} variant="premium" />
            </div>
            <h2 className="text-2xl font-black text-foreground mb-3 tracking-tight">Eu sou a sua Gênia da Pecuária.</h2>
            <p className="text-muted-foreground mb-8 text-[15px] leading-relaxed max-w-md">
                Esqueça menus complicados. Peça-me relatórios sobre seu rebanho, estoques ou métricas em formato de chat.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
                <button onClick={() => onSuggestionClick("Resumo geral da fazenda")} className="flex items-center gap-3 p-4 bg-card rounded-xl border border-primary/20 hover:bg-primary/5 hover:border-primary/40 transition-all text-left group shadow-sm">
                    <div className="p-2.5 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                        <Activity className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-bold text-foreground text-[14px]">Resumo da Fazenda</span>
                        <span className="text-[12px] text-muted-foreground line-clamp-1">Status atual do rebanho</span>
                    </div>
                </button>

                <button onClick={() => onSuggestionClick("Quais touros têm melhor desempenho nas DGs?")} className="flex items-center gap-3 p-4 bg-card rounded-xl border border-primary/20 hover:bg-primary/5 hover:border-primary/40 transition-all text-left group shadow-sm">
                    <div className="p-2.5 bg-amber-500/10 rounded-lg group-hover:bg-amber-500/20 transition-colors">
                        <Award className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-bold text-foreground text-[14px]">Ranking de Touros</span>
                        <span className="text-[12px] text-muted-foreground line-clamp-1">Maior taxa de prenhez</span>
                    </div>
                </button>

                <button onClick={() => onSuggestionClick("Existem receptoras repetidoras com mais de 3 protocolos?")} className="flex items-center gap-3 p-4 bg-card rounded-xl border border-primary/20 hover:bg-primary/5 hover:border-primary/40 transition-all text-left group shadow-sm">
                    <div className="p-2.5 bg-red-500/10 rounded-lg group-hover:bg-red-500/20 transition-colors">
                        <AlertCircle className="w-5 h-5 text-red-600" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-bold text-foreground text-[14px]">Alerta Repetidoras</span>
                        <span className="text-[12px] text-muted-foreground line-clamp-1">Receptoras problemáticas</span>
                    </div>
                </button>

                <button onClick={() => onSuggestionClick("Qual é o meu estoque atual de sêmen?")} className="flex items-center gap-3 p-4 bg-card rounded-xl border border-primary/20 hover:bg-primary/5 hover:border-primary/40 transition-all text-left group shadow-sm">
                    <div className="p-2.5 bg-cyan-500/10 rounded-lg group-hover:bg-cyan-500/20 transition-colors">
                        <Snowflake className="w-5 h-5 text-cyan-600" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-bold text-foreground text-[14px]">Estoque de Sêmen</span>
                        <span className="text-[12px] text-muted-foreground line-clamp-1">Doses por touro e raça</span>
                    </div>
                </button>
            </div>

            <div className="mt-8 text-[12px] text-muted-foreground/80 flex items-center gap-2">
                <Mic className="w-3.5 h-3.5" /> Experimente apertar o microfone e falar comigo!
            </div>
        </div>
    );
}

// === Main Component ===

export default function ConsultorIA() {
    const { toast } = useToast();
    const { clienteId } = usePermissions();
    const { data: hubData, isLoading: hubLoading } = useGlobalFarmData();
    const location = useLocation();

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
                setTimeout(() => handleSend(transcript, true), 300);
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

    const handleSend = async (text: string = input, wantsVoice: boolean = false) => {
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
                body: JSON.stringify({ query: text, history: historyToSend, wantsVoice })
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

            // Se recebemos a voz da OpenAI, tocar imediatamente
            if (jsonIntent.audioBase64) {
                try {
                    const audio = new Audio("data:audio/mp3;base64," + jsonIntent.audioBase64);
                    audio.play().catch(e => console.error("Audio playback prevented by browser policy", e));
                } catch (e) {
                    console.error("Error creating audio instance", e);
                }
            }

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

    const allSuggestions = [
        "Quais os próximos partos?",
        "Quais receptoras posso protocolar?",
        "O que precisa ser feito essa semana?",
        "Quais embriões estão congelados?",
        "Compare o desempenho das fazendas",
        "Mostre as doadoras com baixa produção",
    ];
    // Rotate 4 suggestions based on conversation length
    const sugStartIdx = Math.floor(messages.length / 2) % allSuggestions.length;
    const suggestions = Array.from({ length: 4 }, (_, i) => allSuggestions[(sugStartIdx + i) % allSuggestions.length]);

    if (hubLoading) {
        return <div className="flex h-[calc(100vh-100px)] items-center justify-center"><LoadingInline text="Carregando Córtex da Fazenda..." /></div>;
    }

    return (
        <div className="flex flex-col h-[calc(100dvh-180px)] md:h-[calc(100dvh-140px)] w-full max-w-4xl mx-auto overflow-hidden bg-background rounded-2xl border border-border/50 shadow-sm relative">
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
                        return <ZeroStateHero key={msg.id} onSuggestionClick={(text) => handleSend(text, false)} />;
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
                                        <div className="h-[2px] w-[30%] bg-gradient-to-l from-primary/50 to-transparent" />
                                        <div className="w-2.5 h-2.5 rounded-full border-2 border-background bg-primary shrink-0 translate-x-[20px]" />
                                    </div>
                                    {/* Lado Direito (Balão Usuário) */}
                                    <div className="flex w-full justify-end md:pl-6 max-w-[90%] md:max-w-full justify-self-end">
                                        <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-5 py-3.5 shadow-sm whitespace-pre-wrap text-[15px] leading-relaxed relative">
                                            <div className="md:hidden absolute top-5 -left-2 w-[10px] h-[2px] bg-primary/30" />
                                            {msg.content}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                /* LINHA IA (Esquerda) */
                                <>
                                    {/* Lado Esquerdo (Balão IA) */}
                                    <div className="flex w-full justify-start md:pr-6 max-w-[95%] md:max-w-full">
                                        <div className="bg-card border border-border/50 text-foreground/90 rounded-2xl rounded-tl-sm px-5 py-3.5 shadow-sm whitespace-pre-wrap text-[15px] leading-relaxed w-full">

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
                                                                    onExport={() => exportGenIAPdf(msg.intentData)}
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
                                                                                                };
                                                                                                const tipoLabel = tipoLabels[msg.intentData.tipo] || msg.intentData.tipo;
                                                                                                const isEmptyList = msg.intentData.total === 0 && ['LISTA_RECEPTORAS', 'LISTA_DOADORAS', 'ANALISE_REPETIDORAS', 'PROXIMOS_PARTOS', 'PROXIMOS_SERVICOS', 'ESTOQUE_SEMEN', 'ESTOQUE_EMBRIOES', 'NASCIMENTOS', 'DESEMPENHO_TOURO', 'COMPARACAO_FAZENDAS'].includes(msg.intentData.tipo);
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

                                    {/* Follow Up Suggestion Chips */}
                                    {i === messages.length - 1 && !msg.isSearching && msg.intentData && (
                                        <div className="flex flex-col gap-2 mt-3 animate-in fade-in slide-in-from-top-2 duration-500 ml-10">
                                            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider ml-1">Sugestões para continuar:</span>
                                            <div className="flex flex-wrap gap-2">
                                                {getFollowUpSuggestions(msg.intentData).map((sug, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => handleSend(sug, false)}
                                                        className="text-[12px] font-medium px-3.5 py-2 rounded-xl border border-primary/20 bg-card text-foreground hover:bg-primary/5 hover:text-primary-dark hover:border-primary/40 transition-all flex items-center gap-2 shadow-sm group"
                                                    >
                                                        <Sparkles className="w-3.5 h-3.5 text-primary/40 group-hover:text-primary transition-colors" />
                                                        {sug}
                                                    </button>
                                                ))}
                                            </div>
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

            {/* Input Area */}
            <div className="mt-auto px-4 shrink-0 bg-background/95 backdrop-blur-md py-4 z-20 border-t border-border/30">
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
                            placeholder="Como posso te ajudar?"
                            className="flex-1 max-h-32 min-h-[44px] bg-transparent border-0 focus:ring-0 resize-none py-3 px-3 text-[15px] scrollbar-thin outline-none placeholder:text-muted-foreground/60 placeholder:font-medium leading-relaxed"
                            rows={1}
                        />
                        <button
                            onClick={startListening}
                            disabled={isLoading}
                            className={cn(
                                "w-11 h-11 shrink-0 rounded-full flex items-center justify-center transition-all disabled:opacity-50 mb-0.5",
                                isListening
                                    ? "bg-red-500 hover:bg-red-600 text-white shadow-lg animate-pulse ring-4 ring-red-500/20"
                                    : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                            )}
                            title="Falar com a Gen.IA"
                        >
                            {isListening ? <Mic className="w-4 h-4 ml-0.5" /> : <Mic className="w-4 h-4 ml-0.5" />}
                        </button>
                        <button
                            onClick={() => handleSend(input, false)}
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
