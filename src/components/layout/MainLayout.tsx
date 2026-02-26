import { Outlet, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import MobileNav from './MobileNav';
import TopBar from './TopBar';

export default function MainLayout() {
  const location = useLocation();
  const isGenia = location.pathname === '/genia';

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
        <main className={cn(
          "flex-1 w-full overflow-y-auto flex flex-col relative",
          isGenia ? "p-0" : "p-4 md:p-6 lg:p-8 pb-24"
        )}>
          <Outlet />
        </main>

        {/* FAB flutuante Gen.IA */}
        <MobileNav />
      </div>
    </div>
  );
}
