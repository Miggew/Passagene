import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import HubTabs from './HubTabs';
import MobileNav from './MobileNav';

export default function MainLayout() {
  return (
    <div className="flex flex-col min-h-screen bg-secondary">
      {/* Header com tabs de hubs - esconde em mobile */}
      <div className="hidden md:block">
        <HubTabs />
      </div>

      {/* Conteúdo principal com sidebar */}
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-4 md:p-8 overflow-auto pb-20 md:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Navegação mobile */}
      <MobileNav />
    </div>
  );
}
