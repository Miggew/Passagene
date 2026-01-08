import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Home,
  Beef,
  Syringe,
  TestTube,
  Dna,
  ArrowRightLeft,
  Stethoscope,
  Activity,
} from 'lucide-react';

const menuItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/clientes', label: 'Clientes', icon: Users },
  { path: '/fazendas', label: 'Fazendas', icon: Home },
  { path: '/doadoras', label: 'Doadoras', icon: Dna },
  { path: '/receptoras', label: 'Receptoras', icon: Beef },
  { path: '/protocolos', label: 'Protocolos', icon: Syringe },
  { path: '/aspiracoes', label: 'Aspirações', icon: TestTube },
  { path: '/doses-semen', label: 'Doses de Sêmen', icon: Dna },
  { path: '/lotes-fiv', label: 'Lotes FIV', icon: TestTube },
  { path: '/embrioes', label: 'Embriões/Estoque', icon: Dna },
  { path: '/transferencia', label: 'Transferência (TE)', icon: ArrowRightLeft },
  { path: '/dg', label: 'DG', icon: Stethoscope },
  { path: '/sexagem', label: 'Sexagem', icon: Activity },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <div className="w-64 bg-slate-900 text-white min-h-screen p-4 flex flex-col">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-green-400">FIV/TE Bovina</h1>
        <p className="text-sm text-slate-400">Sistema de Controle</p>
      </div>

      <nav className="flex-1 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                isActive
                  ? 'bg-green-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="pt-4 border-t border-slate-800">
        <p className="text-xs text-slate-500 text-center">© 2024 FIV/TE System</p>
      </div>
    </div>
  );
}