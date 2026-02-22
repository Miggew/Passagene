import { useNavigate } from 'react-router-dom';
import { Settings } from 'lucide-react';
import ThemeToggle from '@/components/shared/ThemeToggle';
import { LogoPassagene } from '@/components/ui/LogoPassagene';
import HomeDashboardClienteAI from './HomeDashboardClienteAI';
interface HomeClienteProps {
    clienteId: string;
    clienteNome?: string;
}

export default function HomeCliente({ clienteId, clienteNome }: HomeClienteProps) {
    const navigate = useNavigate();

    return (
        <div className="flex flex-col w-full h-full min-h-0">
            {/* Dashboard Cliente - flex-1 preenche tudo */}
            <HomeDashboardClienteAI
                clienteId={clienteId}
                clienteNome={clienteNome}
            />
        </div>
    );
}
