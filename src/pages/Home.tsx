import { useNavigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { Building2, Dna, FlaskConical, Tractor, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

// Mapeamento de ícones por código do hub
const hubIcons: Record<string, React.ElementType> = {
  administrativo: Building2,
  genetica: Dna,
  laboratorio: FlaskConical,
  campo: Tractor,
};

// Cores de fundo por hub
const hubColors: Record<string, string> = {
  administrativo: 'bg-blue-500 hover:bg-blue-600',
  genetica: 'bg-purple-500 hover:bg-purple-600',
  laboratorio: 'bg-emerald-500 hover:bg-emerald-600',
  campo: 'bg-amber-500 hover:bg-amber-600',
};

export default function Home() {
  const navigate = useNavigate();
  const { getAccessibleHubs, profile } = usePermissions();
  const { signOut } = useAuth();

  const accessibleHubs = getAccessibleHubs();

  const handleHubClick = (hubCode: string, firstRoute: string) => {
    // Navega para a primeira rota do hub
    navigate(firstRoute);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <header className="p-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-green-400">Passagene</h1>
          <p className="text-slate-400 text-sm">Sistema de Controle FIV/TE</p>
        </div>

        <div className="flex items-center gap-4">
          {profile && (
            <span className="text-slate-400 text-sm">
              Olá, <span className="text-white font-medium">{profile.nome}</span>
            </span>
          )}
          <button
            onClick={signOut}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-red-600/20 hover:text-red-400 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-semibold text-white mb-2">
              Selecione um módulo
            </h2>
            <p className="text-slate-400">
              Escolha o hub que deseja acessar
            </p>
          </div>

          {accessibleHubs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-400">
                Você não tem acesso a nenhum módulo.
              </p>
              <p className="text-slate-500 text-sm mt-2">
                Entre em contato com o administrador.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {accessibleHubs.map((hub) => {
                const Icon = hubIcons[hub.code] || Building2;
                const colorClass = hubColors[hub.code] || 'bg-slate-500 hover:bg-slate-600';

                return (
                  <button
                    key={hub.code}
                    onClick={() => handleHubClick(hub.code, hub.routes[0])}
                    className={cn(
                      'flex flex-col items-center justify-center p-8 rounded-2xl transition-all transform hover:scale-105',
                      'text-white shadow-lg',
                      colorClass
                    )}
                  >
                    <Icon className="w-16 h-16 mb-4" />
                    <span className="text-xl font-semibold">{hub.name}</span>
                    {hub.description && (
                      <span className="text-sm opacity-80 mt-1 text-center">
                        {hub.description}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center text-slate-500 text-sm">
        Passagene &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
