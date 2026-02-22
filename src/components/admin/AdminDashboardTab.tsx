import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent } from '@/components/ui/card';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { handleError } from '@/lib/error-handler';
import { Users, Home, Shield, UserCheck, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface KPIData {
  totalClientes: number;
  totalFazendas: number;
  totalUsuarios: number;
  usuariosAtivos: number;
  usuariosAdmin: number;
  usuariosOperacional: number;
  usuariosCliente: number;
}

interface RecentItem {
  id: string;
  nome: string;
  created_at: string;
}

interface Props {
  onNavigateToTab: (tab: 'clientes' | 'fazendas' | 'usuarios') => void;
}

export default function AdminDashboardTab({ onNavigateToTab }: Props) {
  const { isAdmin } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPIData>({
    totalClientes: 0,
    totalFazendas: 0,
    totalUsuarios: 0,
    usuariosAtivos: 0,
    usuariosAdmin: 0,
    usuariosOperacional: 0,
    usuariosCliente: 0,
  });
  const [recentClientes, setRecentClientes] = useState<RecentItem[]>([]);
  const [recentFazendas, setRecentFazendas] = useState<RecentItem[]>([]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Carregar clientes
      const { data: clientes, error: clientesError } = await supabase
        .from('clientes')
        .select('id, nome, created_at')
        .order('created_at', { ascending: false });

      if (clientesError) throw clientesError;

      // Carregar fazendas
      const { data: fazendas, error: fazendasError } = await supabase
        .from('fazendas')
        .select('id, nome, created_at')
        .order('created_at', { ascending: false });

      if (fazendasError) throw fazendasError;

      // Carregar usuarios (apenas se admin)
      let usuarios: { id: string; active: boolean; user_type: string }[] = [];
      if (isAdmin) {
        const { data: usuariosData, error: usuariosError } = await supabase
          .from('user_profiles')
          .select('id, active, user_type');

        if (usuariosError) throw usuariosError;
        usuarios = usuariosData || [];
      }

      // Calcular KPIs
      setKpis({
        totalClientes: clientes?.length || 0,
        totalFazendas: fazendas?.length || 0,
        totalUsuarios: usuarios.length,
        usuariosAtivos: usuarios.filter(u => u.active).length,
        usuariosAdmin: usuarios.filter(u => u.user_type === 'admin').length,
        usuariosOperacional: usuarios.filter(u => u.user_type === 'operacional').length,
        usuariosCliente: usuarios.filter(u => u.user_type === 'cliente').length,
      });

      // Ultimos 5 registros
      setRecentClientes((clientes || []).slice(0, 5));
      setRecentFazendas((fazendas || []).slice(0, 5));

    } catch (error) {
      handleError(error, 'Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return '-';
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Clientes */}
        <Card
          className="cursor-pointer transition-all border-2 border-border shadow-brutal-sm hover:translate-y-0.5 hover:shadow-none hover:border-primary/50"
          onClick={() => onNavigateToTab('clientes')}
        >
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Clientes</p>
                <p className="text-2xl font-bold">{kpis.totalClientes}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Fazendas */}
        <Card
          className="cursor-pointer transition-all border-2 border-border shadow-brutal-sm hover:translate-y-0.5 hover:shadow-none hover:border-emerald-500/50"
          onClick={() => onNavigateToTab('fazendas')}
        >
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                <Home className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Fazendas</p>
                <p className="text-2xl font-bold">{kpis.totalFazendas}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Usuarios (admin only) */}
        {isAdmin && (
          <Card
            className="cursor-pointer transition-all border-2 border-border shadow-brutal-sm hover:translate-y-0.5 hover:shadow-none hover:border-violet-500/50"
            onClick={() => onNavigateToTab('usuarios')}
          >
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center border border-violet-500/20">
                  <Shield className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Usuarios</p>
                  <p className="text-2xl font-bold">{kpis.totalUsuarios}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Usuarios Ativos (admin only) */}
        {isAdmin && (
          <Card
            className="cursor-pointer transition-all border-2 border-border shadow-brutal-sm hover:translate-y-0.5 hover:shadow-none hover:border-green-500/50"
            onClick={() => onNavigateToTab('usuarios')}
          >
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center border border-green-500/20">
                  <UserCheck className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Ativos</p>
                  <p className="text-2xl font-bold">{kpis.usuariosAtivos}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Cards de distribuicao (admin only) */}
      {isAdmin && (
        <div className="grid grid-cols-3 gap-4">
          <Card className="border-2 border-border shadow-brutal-sm hover:translate-y-0.5 hover:shadow-none transition-all">
            <CardContent className="pt-4 flex flex-col gap-1 items-start">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-bold">Admins</p>
              <p className="text-3xl font-extrabold text-primary">{kpis.usuariosAdmin}</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-border shadow-brutal-sm hover:translate-y-0.5 hover:shadow-none transition-all">
            <CardContent className="pt-4 flex flex-col gap-1 items-start">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-bold">Operacionais</p>
              <p className="text-3xl font-extrabold text-sky-500">{kpis.usuariosOperacional}</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-border shadow-brutal-sm hover:translate-y-0.5 hover:shadow-none transition-all">
            <CardContent className="pt-4 flex flex-col gap-1 items-start">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-bold">Clientes</p>
              <p className="text-3xl font-extrabold text-amber-500">{kpis.usuariosCliente}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Listas recentes */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Ultimos Clientes */}
        <div className="rounded-xl border-2 border-border glass-panel overflow-hidden shadow-brutal-sm">
          <div className="px-4 py-3 glass-panel border-b-2 border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full bg-primary/40" />
              <span className="text-sm font-semibold">Ultimos Clientes</span>
            </div>
            <button
              onClick={() => onNavigateToTab('clientes')}
              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
            >
              Ver todos <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-border/50">
            {recentClientes.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                Nenhum cliente cadastrado
              </div>
            ) : (
              recentClientes.map((cliente, index) => (
                <div
                  key={cliente.id}
                  className="group px-4 py-3 flex items-center justify-between transition-colors hover:bg-muted/50"
                >
                  <span className="font-medium text-sm group-hover:text-primary transition-colors truncate">
                    {cliente.nome}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(cliente.created_at)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Ultimas Fazendas */}
        <div className="rounded-xl border-2 border-border glass-panel overflow-hidden shadow-brutal-sm">
          <div className="px-4 py-3 glass-panel border-b-2 border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full bg-emerald-500/40" />
              <span className="text-sm font-semibold">Ultimas Fazendas</span>
            </div>
            <button
              onClick={() => onNavigateToTab('fazendas')}
              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
            >
              Ver todas <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-border/50">
            {recentFazendas.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                Nenhuma fazenda cadastrada
              </div>
            ) : (
              recentFazendas.map((fazenda, index) => (
                <div
                  key={fazenda.id}
                  className="group px-4 py-3 flex items-center justify-between transition-colors hover:bg-muted/50"
                >
                  <span className="font-medium text-sm group-hover:text-primary transition-colors truncate">
                    {fazenda.nome}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(fazenda.created_at)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
