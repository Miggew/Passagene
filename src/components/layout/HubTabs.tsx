import { useNavigate, useLocation } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { Building2, Dna, FlaskConical, Tractor, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

// Mapeamento de ícones por código do hub
const hubIcons: Record<string, React.ElementType> = {
  administrativo: Building2,
  genetica: Dna,
  laboratorio: FlaskConical,
  campo: Tractor,
};

export default function HubTabs() {
  const navigate = useNavigate();
  const location = useLocation();
  const { getAccessibleHubs, getHubForRoute } = usePermissions();

  const accessibleHubs = getAccessibleHubs();
  const currentHub = getHubForRoute(location.pathname);

  const handleHubClick = (hubCode: string, firstRoute: string) => {
    navigate(firstRoute);
  };

  return (
    <div className="bg-slate-800 border-b border-slate-700">
      <div className="flex items-center">
        {/* Botão Home (logo) */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 px-4 py-3 text-green-400 hover:bg-slate-700 transition-colors border-r border-slate-700"
          title="Voltar para os hubs"
        >
          <Home className="w-5 h-5" />
        </button>

        {/* Tabs dos hubs */}
        <div className="flex items-center overflow-x-auto">
          {accessibleHubs.map((hub) => {
            const Icon = hubIcons[hub.code] || Building2;
            const isActive = currentHub?.code === hub.code;

            return (
              <button
                key={hub.code}
                onClick={() => handleHubClick(hub.code, hub.routes[0])}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap',
                  isActive
                    ? 'bg-slate-900 text-white border-b-2 border-green-500'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{hub.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
