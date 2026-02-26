import { Outlet, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import MobileNav from './MobileNav';
import TopBar from './TopBar';

export default function MainLayout() {
  const location = useLocation();
  const isGenia = location.pathname === '/genia';

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <TopBar />

      <main className={cn(
        "flex-1 w-full overflow-y-auto flex flex-col relative",
        isGenia ? "p-0" : "p-4 md:p-6 lg:p-8 pb-24"
      )}>
        <Outlet />
      </main>

      <MobileNav />
    </div>
  );
}
