import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import HubTabs from './HubTabs';
import MobileNav from './MobileNav';
import { usePermissions } from '@/hooks/usePermissions';
import ThemeToggle from '@/components/shared/ThemeToggle';

export default function MainLayout() {
  const { isCliente } = usePermissions();

  return (
    <div className="flex flex-col min-h-screen bg-secondary">
      {/* Header com tabs de hubs - esconde em mobile */}
      <div className="hidden md:block">
        <HubTabs />
      </div>

      {/* Header mobile para clientes - ThemeToggle no canto superior direito */}
      {isCliente && (
        <div className="md:hidden fixed top-0 right-0 z-50 p-3">
          <ThemeToggle size="default" />
        </div>
      )}

      {/* Conteúdo principal com sidebar */}
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-4 md:p-8 overflow-auto pb-24 md:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Navegação mobile */}
      <MobileNav />
    </div>
  );
}
