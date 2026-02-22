import { Outlet } from 'react-router-dom';
import MobileNav from './MobileNav';
import TopBar from './TopBar';

export default function MainLayout() {
  return (
    <div className="flex flex-col min-h-screen bg-secondary pb-24 lg:pb-0">
      {/* TopBar Universal */}
      <TopBar />

      {/* Conteúdo principal */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
        <Outlet />
      </main>

      {/* Navegação mobile */}
      <MobileNav />
    </div>
  );
}
