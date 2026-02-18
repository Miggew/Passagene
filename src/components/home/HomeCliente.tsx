import { useNavigate } from 'react-router-dom';
import { Settings } from 'lucide-react';
import ThemeToggle from '@/components/shared/ThemeToggle';
import logoEscrito from '@/assets/logoescrito.svg';
import HomeDashboardClienteAI from './HomeDashboardClienteAI';
interface HomeClienteProps {
    clienteId: string;
    clienteNome?: string;
}

export default function HomeCliente({ clienteId, clienteNome }: HomeClienteProps) {
    const navigate = useNavigate();

    return (
        <div className="flex flex-col w-full overflow-hidden h-[calc(100dvh-112px)]">
            {/* Header: Configurações esquerda + Logo central + ThemeToggle direita */}
            <div className="relative flex items-center justify-center pb-3 shrink-0">
                {/* Botão configurações - canto superior esquerdo */}
                <div className="absolute left-0 top-0">
                    <button
                        onClick={() => navigate('/cliente/configuracoes')}
                        className="w-10 h-10 rounded-lg flex items-center justify-center bg-muted/50 hover:bg-muted border border-border/50 hover:border-border transition-all active:scale-95"
                    >
                        <Settings className="w-5 h-5 text-muted-foreground" />
                    </button>
                </div>

                {/* Logo centralizada */}
                <img src={logoEscrito} alt="PassaGene" className="h-9 w-auto" />

                {/* ThemeToggle - canto superior direito */}
                <div className="absolute right-0 top-0">
                    <ThemeToggle />
                </div>
            </div>

            {/* Dashboard Cliente - flex-1 preenche tudo */}
            <HomeDashboardClienteAI
                clienteId={clienteId}
                clienteNome={clienteNome}
            />
        </div>
    );
}
