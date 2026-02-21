import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useTheme } from '@/hooks/useTheme';
import { Settings, LogOut, Sun, Moon, Laptop, User } from 'lucide-react';
import logoEscrito from '@/assets/logoescrito.svg';
import { cn } from '@/lib/utils';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
    DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';

export default function TopBar() {
    const navigate = useNavigate();
    const { signOut } = useAuth();
    const { profile } = usePermissions();
    const { theme, setTheme } = useTheme();

    return (
        <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-14 items-center justify-between px-4 lg:px-8 max-w-7xl mx-auto">

                {/* Left: Logo */}
                <div
                    className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => navigate('/')}
                >
                    <img src={logoEscrito} alt="PassaGene" className="h-8 w-auto" />
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

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="flex items-center justify-center w-8 h-8 rounded-full bg-muted hover:bg-muted/80 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 focus:ring-offset-background" aria-label="Configurações">
                                <Settings className="w-4 h-4 text-foreground" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56" sideOffset={8}>
                            <DropdownMenuLabel className="font-normal">
                                <div className="flex flex-col space-y-1">
                                    <p className="text-sm font-medium leading-none">{profile?.nome || 'Usuário'}</p>
                                    <p className="text-xs leading-none text-muted-foreground">
                                        {profile?.email}
                                    </p>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />

                            <DropdownMenuGroup>
                                <div className="px-2 py-1.5 flex items-center justify-between">
                                    <span className="text-sm font-medium">Tema Visual</span>
                                    <div className="flex items-center border rounded-full overflow-hidden bg-muted/50 p-0.5">
                                        <button
                                            onClick={() => setTheme('light')}
                                            className={cn("p-1.5 rounded-full transition-colors", theme === 'light' && "bg-background shadow-sm text-foreground")}
                                            title="Modo Claro"
                                        >
                                            <Sun className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => setTheme('system')}
                                            className={cn("p-1.5 rounded-full transition-colors", theme === 'system' && "bg-background shadow-sm text-foreground")}
                                            title="Automático (Sistema)"
                                        >
                                            <Laptop className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => setTheme('dark')}
                                            className={cn("p-1.5 rounded-full transition-colors", theme === 'dark' && "bg-background shadow-sm text-foreground")}
                                            title="Modo Escuro"
                                        >
                                            <Moon className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Espaço para futuras funcionalidades */}
                                <DropdownMenuItem className="cursor-pointer text-muted-foreground" disabled>
                                    <User className="w-4 h-4 mr-2" />
                                    Preferências (Em breve)
                                </DropdownMenuItem>
                            </DropdownMenuGroup>

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                                onClick={signOut}
                                className="text-red-500 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/50 cursor-pointer font-medium"
                            >
                                <LogOut className="w-4 h-4 mr-2" />
                                Sair do sistema
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </header>
    );
}
