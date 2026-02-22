import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useTheme } from '@/hooks/useTheme';
import { useGlobalAnalysisQueue, useCancelAllAnalysis } from '@/hooks/useEmbryoScores';
import type { GlobalAnalysisQueueData } from '@/hooks/useEmbryoScores';
import { LoaderDNA } from '@/components/ui/LoaderDNA';
import { Settings, LogOut, Sun, Moon, Laptop, User, X, Menu, Home, FileText } from 'lucide-react';
import { LogoPassagene } from '@/components/ui/LogoPassagene';
import { cn } from '@/lib/utils';
import { CLIENTE_NAV_ROUTES, routeIcons, routeLabels } from '@/lib/nav-config';

function TopBarAnalysisBadge() {
    const { data: queue } = useGlobalAnalysisQueue();
    const queueData: GlobalAnalysisQueueData = queue ?? { pending: 0, processing: 0, total: 0, oldestStartedAt: null, newestExpectedCount: null };
    const cancelAll = useCancelAllAnalysis();
    const [confirming, setConfirming] = useState(false);
    const [, setTick] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (queueData.processing > 0 && queueData.oldestStartedAt) {
            intervalRef.current = setInterval(() => setTick(t => t + 1), 1000);
        } else if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [queueData.processing > 0, queueData.oldestStartedAt]);

    if (queueData.total === 0) return null;

    const handleCancel = () => {
        if (!confirming) {
            setConfirming(true);
            return;
        }
        cancelAll.mutate(undefined, {
            onSuccess: () => setConfirming(false),
            onError: () => setConfirming(false),
        });
    };

    const formatElapsed = (startedAt: string) => {
        const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
        if (elapsed < 0) return '0s';
        const m = Math.floor(elapsed / 60);
        const s = elapsed % 60;
        return m > 0 ? `${m}m${String(s).padStart(2, '0')}s` : `${s}s`;
    };

    return (
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-full border border-primary/20 bg-primary/5 shadow-sm transition-all animate-in fade-in zoom-in duration-300">
            <div className="shrink-0 flex items-center justify-center w-[22px] h-[22px] bg-primary/10 rounded-full">
                <LoaderDNA size={16} variant="accent" />
            </div>
            <div className="flex flex-col hidden sm:flex justify-center -space-y-0.5">
                <span className="text-[9px] font-extrabold text-primary uppercase tracking-wider leading-tight">
                    IA: {queueData.processing} {queueData.pending > 0 && `+${queueData.pending}`}
                </span>
                {queueData.oldestStartedAt && queueData.processing > 0 && (
                    <span className="text-[9px] font-mono text-muted-foreground font-bold tracking-tight">
                        {formatElapsed(queueData.oldestStartedAt)}
                    </span>
                )}
            </div>
            <button
                onClick={handleCancel}
                disabled={cancelAll.isPending}
                className={`ml-1 flex items-center justify-center w-5 h-5 rounded-full transition-colors ${confirming
                    ? 'bg-red-500 text-white shadow-sm scale-110'
                    : 'bg-black/5 text-muted-foreground hover:bg-red-500/10 hover:text-red-500'
                    } disabled:opacity-50`}
                title={confirming ? 'Confirmar aborto?' : 'Abortar IA'}
            >
                <X className="w-3 h-3" />
            </button>
        </div>
    );
}

export default function TopBar() {
    const navigate = useNavigate();
    const { signOut } = useAuth();
    const { profile } = usePermissions();
    const { theme, setTheme } = useTheme();

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleMobileNav = (route: string) => {
        setIsMobileMenuOpen(false);
        navigate(route);
    };

    return (
        <>
            <header className="sticky top-0 z-40 w-full border-b-[3px] border-border glass-panel/95 backdrop-blur supports-[backdrop-filter]:glass-panel/80 shadow-sm">
                <div className="flex h-16 items-center justify-between px-4 lg:px-8 max-w-7xl mx-auto">

                    {/* Left: Hamburger Menu (Mobile Clientes ONLY) */}
                    <div className="flex items-center gap-3">
                        {/* Type Assertion on profile to avoid UserProfile missing "role" */}
                        {(profile as any)?.role === 'cliente' && (
                            <button
                                onClick={() => setIsMobileMenuOpen(true)}
                                className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl border-2 border-border bg-background text-foreground hover:bg-muted transition-colors"
                            >
                                <Menu className="w-5 h-5" />
                            </button>
                        )}

                        {/* Logo */}
                        <div
                            className="flex items-center cursor-pointer transition-transform hover:-translate-y-0.5"
                            onClick={() => navigate('/')}
                        >
                            {/* Logo Completa no Desktop e Mobile */}
                            <div className="hidden md:block">
                                <LogoPassagene height={32} variant="premium" showText={true} />
                            </div>
                            <div className="block md:hidden">
                                <LogoPassagene height={28} variant="premium" showText={true} />
                            </div>
                        </div>
                    </div>

                    {/* Center: Greeting (Visible on larger screens) */}
                    <div className="hidden md:flex flex-1 justify-center">
                        {profile?.nome && (
                            <span className="text-sm font-medium text-muted-foreground">
                                Olá, <span className="text-foreground">{profile.nome.split(' ')[0]}</span>!
                            </span>
                        )}
                    </div>

                    {/* Right: Settings / Profile */}
                    <div className="flex items-center gap-4">
                        {/* Mobile Greeting (only if name is very short or just the first name) */}
                        <div className="md:hidden">
                            {profile?.nome && (
                                <span className="text-sm font-medium text-foreground">
                                    Olá, {profile.nome.split(' ')[0]}
                                </span>
                            )}
                        </div>

                        <TopBarAnalysisBadge />

                        <div
                            className="relative ml-2 flex items-center justify-center"
                            ref={menuRef}
                        >

                            {/* Filhas Mitóticas (Sub-menus) - Estouram p/ BAIXO no Desktop/TopBar */}
                            <div className={cn(
                                "absolute top-10 right-0 flex flex-col items-end gap-3 z-40 mt-1 transition-all duration-300",
                                isMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                            )}>

                                {/* Tema */}
                                <button
                                    onClick={() => { setTheme(theme === 'dark' ? 'light' : 'dark'); setIsMenuOpen(false); }}
                                    className={cn(
                                        "group/btn flex items-center justify-end gap-3 transition-all duration-300 ease-out",
                                        isMenuOpen ? "translate-y-0 scale-100 delay-[50ms]" : "translate-y-[-20px] scale-75"
                                    )}
                                    aria-label="Alternar Tema"
                                >
                                    <span className="px-2.5 py-1 rounded-full glass-panel border border-border text-foreground font-bold text-[10px] tracking-wide whitespace-nowrap shadow-md opacity-0 -translate-x-2 group-hover/btn:opacity-100 group-hover/btn:translate-x-0 transition-all duration-300">
                                        {theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
                                    </span>
                                    <div className="w-10 h-10 rounded-full glass-panel shadow-lg flex items-center justify-center border-2 border-border group-hover/btn:border-primary/50 transition-colors">
                                        {theme === 'dark' ? <Sun className="w-4 h-4 text-foreground" /> : <Moon className="w-4 h-4 text-foreground" />}
                                    </div>
                                </button>

                                {/* Preferencias */}
                                <button
                                    onClick={() => setIsMenuOpen(false)}
                                    className={cn(
                                        "group/btn flex items-center justify-end gap-3 transition-all duration-300 ease-out",
                                        isMenuOpen ? "translate-y-0 scale-100 delay-[100ms]" : "translate-y-[-40px] scale-75"
                                    )}
                                >
                                    <span className="px-2.5 py-1 rounded-full glass-panel border border-border text-foreground font-bold text-[10px] tracking-wide whitespace-nowrap shadow-md opacity-0 -translate-x-2 group-hover/btn:opacity-100 group-hover/btn:translate-x-0 transition-all duration-300">
                                        Preferências
                                    </span>
                                    <div className="w-10 h-10 rounded-full glass-panel shadow-lg flex items-center justify-center border-2 border-border group-hover/btn:border-primary/50 transition-colors">
                                        <User className="w-4 h-4 text-foreground" />
                                    </div>
                                </button>

                                {/* Sair */}
                                <button
                                    onClick={signOut}
                                    className={cn(
                                        "group/btn flex items-center justify-end gap-3 transition-all duration-300 ease-out relative",
                                        isMenuOpen ? "translate-y-0 scale-100 delay-[150ms]" : "translate-y-[-60px] scale-75"
                                    )}
                                >
                                    <div className="absolute top-0 right-0 w-2 h-2 rounded-full bg-red-500 z-10 animate-pulse border border-background"></div>
                                    <span className="px-2.5 py-1 rounded-full glass-panel border border-border text-red-500 font-bold text-[10px] tracking-wide whitespace-nowrap shadow-md opacity-0 -translate-x-2 group-hover/btn:opacity-100 group-hover/btn:translate-x-0 transition-all duration-300">
                                        Sair do Sistema
                                    </span>
                                    <div className="w-10 h-10 rounded-full glass-panel shadow-lg flex items-center justify-center border-2 border-border group-hover/btn:border-red-500/50 transition-colors">
                                        <LogOut className="w-4 h-4 text-red-500" />
                                    </div>
                                </button>
                            </div>

                            {/* Célula Mãe (A Engrenagem de Click) */}
                            <div
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                                className={cn(
                                    "relative z-50 w-10 h-10 rounded-xl border-[3px] shadow-brutal-sm flex items-center justify-center cursor-pointer transition-all duration-300 active:translate-y-1 active:shadow-none",
                                    isMenuOpen ? "bg-muted border-border text-foreground shadow-sm" : "glass-panel border-border text-foreground hover:bg-muted"
                                )}>
                                <Settings className={cn(
                                    "w-5 h-5 transition-transform duration-500",
                                    isMenuOpen ? "rotate-90 scale-110 text-[#080B0A]" : "text-foreground"
                                )} />
                            </div>

                        </div>
                    </div>
                </div>
            </header>

            {/* Mobile Nav Overlay (Clients Only) */}
            {(profile as any)?.role === 'cliente' && (
                <>
                    {/* Backdrop */}
                    <div
                        className={cn(
                            "fixed inset-0 z-50 bg-background/80 backdrop-blur-sm transition-opacity duration-300 md:hidden",
                            isMobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                        )}
                        onClick={() => setIsMobileMenuOpen(false)}
                    />

                    {/* Drawer */}
                    <div
                        className={cn(
                            "fixed inset-y-0 left-0 z-50 w-[280px] glass-panel border-r-[3px] border-border shadow-brutal transition-transform duration-300 ease-out md:hidden flex flex-col",
                            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
                        )}
                    >
                        <div className="flex items-center justify-between p-4 border-b-2 border-border/50">
                            <LogoPassagene height={28} variant="premium" />
                            <button
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="p-2 rounded-lg hover:bg-muted transition-colors"
                            >
                                <X className="w-5 h-5 text-foreground" />
                            </button>
                        </div>

                        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                            {CLIENTE_NAV_ROUTES.map(route => {
                                const Icon = routeIcons[route] || Home;
                                const label = routeLabels[route] || route;
                                const isActive = window.location.pathname === route || window.location.pathname.startsWith(route + '/');

                                return (
                                    <button
                                        key={route}
                                        onClick={() => handleMobileNav(route)}
                                        className={cn(
                                            "w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left",
                                            isActive
                                                ? "bg-muted border-border text-foreground shadow-sm font-bold"
                                                : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground font-medium"
                                        )}
                                    >
                                        <Icon className={cn("w-5 h-5", isActive && "scale-110")} />
                                        <span>{label}</span>
                                    </button>
                                );
                            })}
                        </nav>

                        <div className="p-4 border-t-2 border-border/50">
                            <div className="flex items-center gap-3 px-2 mb-4">
                                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold border-2 border-border">
                                    {profile?.nome?.[0] || 'U'}
                                </div>
                                <div className="flex-1 truncate">
                                    <p className="text-sm font-bold truncate text-foreground">{profile?.nome}</p>
                                    <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
                                </div>
                            </div>
                            <button
                                onClick={signOut}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border-2 border-border glass-panel text-red-500 font-bold hover:bg-red-50 transition-colors shadow-brutal-sm active:translate-y-1 active:shadow-none"
                            >
                                <LogOut className="w-4 h-4" />
                                <span>Sair da Conta</span>
                            </button>
                        </div>
                    </div>
                </>
            )}
        </>
    );
}
