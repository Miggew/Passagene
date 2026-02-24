import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import PageHeader from '@/components/shared/PageHeader';
import AdminDashboardTab from '@/components/admin/AdminDashboardTab';
import AdminClientesTab from '@/components/admin/AdminClientesTab';
import AdminFazendasTab from '@/components/admin/AdminFazendasTab';
import AdminUsuariosTab from '@/components/admin/AdminUsuariosTab';
import AdminCatalogoTab from '@/components/admin/AdminCatalogoTab';
import { LayoutDashboard, Users, Home, Shield, Dna } from 'lucide-react';

type TabType = 'visao-geral' | 'clientes' | 'fazendas' | 'catalogo' | 'usuarios';

interface TabConfig {
  value: TabType;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

const TABS_CONFIG: TabConfig[] = [
  { value: 'visao-geral', label: 'Visao Geral', icon: LayoutDashboard },
  { value: 'clientes', label: 'Clientes', icon: Users },
  { value: 'fazendas', label: 'Fazendas', icon: Home },
  { value: 'catalogo', label: 'Catalogo', icon: Dna, adminOnly: true },
  { value: 'usuarios', label: 'Usuarios', icon: Shield, adminOnly: true },
];

export default function Administrativo() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAdmin } = usePermissions();

  // Ler tab da URL ou usar default
  const initialTab = (searchParams.get('tab') as TabType) || 'visao-geral';
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  // Filtrar tabs baseado em permissao
  const visibleTabs = TABS_CONFIG.filter(tab => !tab.adminOnly || isAdmin);

  // Sincronizar URL com tab ativa
  useEffect(() => {
    const currentTab = searchParams.get('tab');
    if (currentTab !== activeTab) {
      setSearchParams({ tab: activeTab }, { replace: true });
    }
  }, [activeTab, searchParams, setSearchParams]);

  // Se usuario nao-admin tentar acessar tab de usuarios via URL, redirecionar
  useEffect(() => {
    const urlTab = searchParams.get('tab') as TabType;
    if (urlTab === 'usuarios' && !isAdmin) {
      setActiveTab('visao-geral');
    }
  }, [searchParams, isAdmin]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Painel Administrativo"
        description="Gerencie clientes, fazendas e usuarios do sistema"
      />

      {/* Tabs Premium */}
      <div className="rounded-2xl border-2 border-border glass-panel p-1.5 shadow-brutal-sm overflow-x-auto">
        <div className="flex gap-1">
          {visibleTabs.map(({ value, label, icon: Icon }) => {
            const isActive = activeTab === value;

            return (
              <button
                key={value}
                onClick={() => handleTabChange(value)}
                className={`
                  relative flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                  text-sm font-medium transition-all duration-200
                  ${isActive
                    ? 'bg-muted/80 text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                  }
                `}
              >
                {/* Indicador inferior para tab ativa */}
                {isActive && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-primary rounded-full" />
                )}

                {/* Icone com container */}
                <div className={`
                  flex items-center justify-center w-7 h-7 rounded-md transition-colors
                  ${isActive ? 'bg-primary/15' : 'bg-muted/50'}
                `}>
                  <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>

                {/* Label - esconde em mobile */}
                <span className="hidden sm:inline">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Conteudo da Aba */}
      {activeTab === 'visao-geral' && (
        <AdminDashboardTab onNavigateToTab={handleTabChange} />
      )}
      {activeTab === 'clientes' && <AdminClientesTab />}
      {activeTab === 'fazendas' && <AdminFazendasTab />}
      {activeTab === 'catalogo' && isAdmin && <AdminCatalogoTab />}
      {activeTab === 'usuarios' && isAdmin && <AdminUsuariosTab />}
    </div>
  );
}
