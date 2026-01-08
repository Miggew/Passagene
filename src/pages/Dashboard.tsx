import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import {
  Plus,
  Syringe,
  TestTube,
  Dna,
  ArrowRightLeft,
  Stethoscope,
  Activity,
  ClipboardList,
} from 'lucide-react';

interface DashboardStats {
  protocolosAbertos: number;
  receptorasSincronizadas: number;
  embrioesFrescosDisponiveis: number;
  embrioesCongeladosEstoque: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    protocolosAbertos: 0,
    receptorasSincronizadas: 0,
    embrioesFrescosDisponiveis: 0,
    embrioesCongeladosEstoque: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      // Protocolos abertos (sem data_retirada)
      const { count: protocolosCount } = await supabase
        .from('protocolos_sincronizacao')
        .select('*', { count: 'exact', head: true })
        .is('data_retirada', null);

      // Receptoras sincronizadas (status APTA ou SINCRONIZADA)
      const { count: receptorasCount } = await supabase
        .from('protocolo_receptoras')
        .select('*', { count: 'exact', head: true })
        .in('status', ['APTA', 'SINCRONIZADA']);

      // Embriões frescos disponíveis hoje (da view)
      const { count: frescosCount } = await supabase
        .from('v_embrioes_disponiveis_te')
        .select('*', { count: 'exact', head: true })
        .eq('disponivel_fresco_hoje', true);

      // Embriões congelados em estoque (da view)
      const { count: congeladosCount } = await supabase
        .from('v_embrioes_disponiveis_te')
        .select('*', { count: 'exact', head: true })
        .eq('disponivel_congelado', true);

      setStats({
        protocolosAbertos: protocolosCount || 0,
        receptorasSincronizadas: receptorasCount || 0,
        embrioesFrescosDisponiveis: frescosCount || 0,
        embrioesCongeladosEstoque: congeladosCount || 0,
      });
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { label: 'Novo Protocolo', path: '/protocolos/novo', icon: Syringe, color: 'bg-green-600 hover:bg-green-700' },
    { label: 'Registrar Retirada', path: '/protocolos', icon: ClipboardList, color: 'bg-blue-600 hover:bg-blue-700' },
    { label: 'Nova Aspiração', path: '/aspiracoes/novo', icon: TestTube, color: 'bg-purple-600 hover:bg-purple-700' },
    { label: 'Criar Lote FIV', path: '/lotes-fiv/novo', icon: TestTube, color: 'bg-indigo-600 hover:bg-indigo-700' },
    { label: 'Gerar Embriões', path: '/embrioes/novo', icon: Dna, color: 'bg-pink-600 hover:bg-pink-700' },
    { label: 'TE do Protocolo', path: '/transferencia', icon: ArrowRightLeft, color: 'bg-orange-600 hover:bg-orange-700' },
    { label: 'Lançar DG', path: '/dg', icon: Stethoscope, color: 'bg-teal-600 hover:bg-teal-700' },
    { label: 'Lançar Sexagem', path: '/sexagem', icon: Activity, color: 'bg-cyan-600 hover:bg-cyan-700' },
  ];

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-600 mt-1">Visão geral do sistema de FIV/TE</p>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Ações Rápidas</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.path} to={action.path}>
                <Button
                  className={`w-full h-24 flex flex-col items-center justify-center gap-2 ${action.color} text-white`}
                >
                  <Icon className="w-6 h-6" />
                  <span className="text-sm font-medium text-center">{action.label}</span>
                </Button>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Stats Cards */}
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Estatísticas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Protocolos Abertos</CardTitle>
              <CardDescription>Em andamento</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-green-600">{stats.protocolosAbertos}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Receptoras Sincronizadas</CardTitle>
              <CardDescription>Aptas para TE</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-blue-600">{stats.receptorasSincronizadas}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Embriões Frescos</CardTitle>
              <CardDescription>Disponíveis hoje (D7/D8)</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-purple-600">{stats.embrioesFrescosDisponiveis}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Embriões Congelados</CardTitle>
              <CardDescription>Em estoque</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-cyan-600">{stats.embrioesCongeladosEstoque}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}