import { Outlet } from 'react-router-dom';
import MobileNav from './MobileNav';
import TopBar from './TopBar';

export default function MainLayout() {
  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-0 md:p-8">
      {/* 
        This is the inner mobile/desktop phone wrapper that mimics the HTML prototype.
        On mobile it stretches, on desktop it sits like an iPad/app window. 
      */}
      <div className="flex flex-col w-full h-screen md:max-w-[1000px] md:h-auto md:min-h-[85vh] md:border-4 md:border-border md:rounded-[32px] md:shadow-brutal-lg bg-background overflow-hidden relative">
        {/* TopBar Universal */}
        <TopBar />

        {/* Conteúdo principal */}
        <main className="flex-1 w-full p-4 md:p-6 lg:p-8 overflow-y-auto pb-32">
          <Outlet />
        </main>

        {/* Navegação mobile */}
        <MobileNav />
      </div>
    </div>
  );
}
