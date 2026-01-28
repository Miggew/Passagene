import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import HubTabs from './HubTabs';

export default function MainLayout() {
  return (
    <div className="flex flex-col min-h-screen bg-secondary">
      {/* Header com tabs de hubs */}
      <HubTabs />

      {/* Conteúdo principal com sidebar */}
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-6 md:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
