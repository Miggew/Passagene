import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  Home as HomeIcon,
  Baby,
  Activity,
  UserCheck,
  Calendar,
  ArrowRight,
  Syringe,
  FlaskConical,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface KPIData {
  totalClientes: number;
  totalFazendas: number;
  totalUsuarios: number;
  usuariosAtivos: number;
  totalReceptoras: number;
  totalDoadoras: number;
  totalEmbrioes: number;
  protocolosAbertos: number;
  lotesAbertos: number;
}

export default function HomeDashboardAdmin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPIData>({
    totalClientes: 0,
    totalFazendas: 0,
    totalUsuarios: 0,
    usuariosAtivos: 0,
    totalReceptoras: 0,
    totalDoadoras: 0,
    totalEmbrioes: 0,
    protocolosAbertos: 0,
    lotesAbertos: 0,
  });

  useEffect(() => {
    loadKPIs();
  }, []);

  async function loadKPIs() {
    setLoading(true);
    try {
      const [
        clientesRes,
        fazendasRes,
        usuariosRes,
        usuariosAtivosRes,
        receptorasRes,
        doadorasRes,
        embrioesRes,
        protocolosRes,
        lotesRes,
      ] = await Promise.all([
        supabase.from('clientes').select('id', { count: 'exact', head: true }),
        supabase.from('fazendas').select('id', { count: 'exact', head: true }),
        supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
        supabase.from('user_profiles').select('id', { count: 'exact', head: true }).eq('active', true),
        supabase.from('receptoras').select('id', { count: 'exact', head: true }),
        supabase.from('doadoras').select('id', { count: 'exact', head: true }),
        supabase.from('embrioes').select('id', { count: 'exact', head: true }).eq('status_atual', 'CONGELADO'),
        supabase.from('protocolos_sincronizacao').select('id', { count: 'exact', head: true }).eq('status', 'PASSO1_FECHADO'),
        supabase.from('lotes_fiv').select('id', { count: 'exact', head: true }).eq('status', 'ABERTO'),
      ]);

      setKpis({
        totalClientes: clientesRes.count || 0,
        totalFazendas: fazendasRes.count || 0,
        totalUsuarios: usuariosRes.count || 0,
        usuariosAtivos: usuariosAtivosRes.count || 0,
        totalReceptoras: receptorasRes.count || 0,
        totalDoadoras: doadorasRes.count || 0,
        totalEmbrioes: embrioesRes.count || 0,
        protocolosAbertos: protocolosRes.count || 0,
        lotesAbertos: lotesRes.count || 0,
      });
    } catch {
      toast.error('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const kpiCards = [
    { label: 'Clientes', value: kpis.totalClientes, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Fazendas', value: kpis.totalFazendas, icon: HomeIcon, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Usuários', value: `${kpis.usuariosAtivos}/${kpis.totalUsuarios}`, icon: UserCheck, color: 'text-violet-500', bg: 'bg-violet-500/10' },
    { label: 'Receptoras', value: kpis.totalReceptoras, icon: Activity, color: 'text-pink-500', bg: 'bg-pink-500/10' },
    { label: 'Doadoras', value: kpis.totalDoadoras, icon: Activity, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { label: 'Embriões', value: kpis.totalEmbrioes, icon: Baby, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
  ];

  const atalhos = [
    { label: 'Protocolos', sublabel: `${kpis.protocolosAbertos} aguardando 2º passo`, icon: Syringe, color: 'text-orange-500', bg: 'bg-orange-500/10', href: '/protocolos' },
    { label: 'Lotes FIV', sublabel: `${kpis.lotesAbertos} abertos`, icon: FlaskConical, color: 'text-teal-500', bg: 'bg-teal-500/10', href: '/lotes-fiv' },
    { label: 'Painel Admin', sublabel: 'Clientes e usuários', icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10', href: '/administrativo' },
    { label: 'Relatórios', sublabel: 'Visão geral', icon: Calendar, color: 'text-purple-500', bg: 'bg-purple-500/10', href: '/relatorios' },
  ];

  return (
    <div className="space-y-4">
      {/* KPIs Premium - Grid Compacto */}
      <div className="rounded-2xl border-2 border-border glass-panel overflow-hidden shadow-brutal-sm">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-x divide-y lg:divide-y-0 divide-border/50">
          {kpiCards.map((kpi) => (
            <div
              key={kpi.label}
              className="p-4 hover:bg-muted/30 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${kpi.bg} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
                  <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{kpi.label}</p>
                  <p className="text-xl font-bold truncate">{kpi.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Atalhos Rápidos Premium */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {atalhos.map((item) => (
          <button
            key={item.label}
            onClick={() => navigate(item.href)}
            className="flex items-center gap-3 p-3 rounded-2xl border-2 border-border shadow-brutal-sm glass-panel hover:border-primary/50 hover:bg-gradient-to-r hover:from-primary/5 hover:to-transparent transition-all group text-left hover:-translate-y-0.5 hover:shadow-none"
          >
            <div className={`w-10 h-10 rounded-lg ${item.bg} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
              <item.icon className={`w-5 h-5 ${item.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{item.label}</p>
              <p className="text-xs text-muted-foreground truncate">{item.sublabel}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
