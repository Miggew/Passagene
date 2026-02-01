import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ClipboardList,
  Users,
  Dna,
  TrendingUp,
  ArrowRight,
  Calendar,
  Activity,
} from 'lucide-react';
import { CowIcon } from '@/components/icons/CowIcon';
import { EmbryoIcon } from '@/components/icons/EmbryoIcon';
import { supabase } from '@/lib/supabase';
import { useClienteFilter } from '@/hooks/useClienteFilter';
import PageHeader from '@/components/shared/PageHeader';

interface DashboardStats {
  protocolos: number;
  aspiracoes: number;
  receptoras: number;
  doadoras: number;
  embrioes: number;
  dosesSemen: number;
}

export default function RelatoriosHome() {
  const navigate = useNavigate();
  const { clienteIdFilter, userContext } = useClienteFilter();
  const [stats, setStats] = useState<DashboardStats>({
    protocolos: 0,
    aspiracoes: 0,
    receptoras: 0,
    doadoras: 0,
    embrioes: 0,
    dosesSemen: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [clienteIdFilter]);

  const loadStats = async () => {
    try {
      setLoading(true);

      // Buscar fazendas do cliente (se filtro ativo)
      let fazendaIds: string[] = [];
      if (clienteIdFilter) {
        const { data: fazendas } = await supabase
          .from('fazendas')
          .select('id')
          .eq('cliente_id', clienteIdFilter);
        fazendaIds = fazendas?.map(f => f.id) ?? [];
      }

      // Queries em paralelo
      const [
        protocolosResult,
        aspiracoesResult,
        receptorasResult,
        doadorasResult,
        embrioesResult,
        dosesSemenResult,
      ] = await Promise.all([
        // Protocolos dos últimos 30 dias
        clienteIdFilter && fazendaIds.length > 0
          ? supabase
              .from('protocolos_sincronizacao')
              .select('id', { count: 'exact', head: true })
              .in('fazenda_id', fazendaIds)
              .gte('data_inicio', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          : supabase
              .from('protocolos_sincronizacao')
              .select('id', { count: 'exact', head: true })
              .gte('data_inicio', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),

        // Aspirações dos últimos 30 dias
        clienteIdFilter && fazendaIds.length > 0
          ? supabase
              .from('pacotes_aspiracao')
              .select('id', { count: 'exact', head: true })
              .in('fazenda_id', fazendaIds)
              .gte('data_aspiracao', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          : supabase
              .from('pacotes_aspiracao')
              .select('id', { count: 'exact', head: true })
              .gte('data_aspiracao', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),

        // Total de receptoras (usando view para fazenda atual)
        clienteIdFilter && fazendaIds.length > 0
          ? supabase
              .from('vw_receptoras_fazenda_atual')
              .select('receptora_id', { count: 'exact', head: true })
              .in('fazenda_id_atual', fazendaIds)
          : supabase
              .from('receptoras')
              .select('id', { count: 'exact', head: true }),

        // Total de doadoras
        clienteIdFilter && fazendaIds.length > 0
          ? supabase
              .from('doadoras')
              .select('id', { count: 'exact', head: true })
              .in('fazenda_id', fazendaIds)
          : supabase
              .from('doadoras')
              .select('id', { count: 'exact', head: true }),

        // Total de embriões congelados
        clienteIdFilter
          ? supabase
              .from('embrioes')
              .select('id', { count: 'exact', head: true })
              .eq('status_atual', 'CONGELADO')
              .eq('cliente_id', clienteIdFilter)
          : supabase
              .from('embrioes')
              .select('id', { count: 'exact', head: true })
              .eq('status_atual', 'CONGELADO'),

        // Total de doses de sêmen
        clienteIdFilter
          ? supabase
              .from('doses_semen')
              .select('id', { count: 'exact', head: true })
              .eq('cliente_id', clienteIdFilter)
          : supabase
              .from('doses_semen')
              .select('id', { count: 'exact', head: true }),
      ]);

      setStats({
        protocolos: protocolosResult.count ?? 0,
        aspiracoes: aspiracoesResult.count ?? 0,
        receptoras: receptorasResult.count ?? 0,
        doadoras: doadorasResult.count ?? 0,
        embrioes: embrioesResult.count ?? 0,
        dosesSemen: dosesSemenResult.count ?? 0,
      });
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  const menuCards = [
    {
      title: 'Serviços de Campo',
      description: 'Protocolos, Aspirações, TE, DG e Sexagem',
      icon: ClipboardList,
      route: '/relatorios/servicos',
      color: 'bg-primary/10 text-primary',
    },
    {
      title: 'Animais',
      description: 'Receptoras e Doadoras',
      icon: CowIcon,
      route: '/relatorios/animais',
      color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    },
    {
      title: 'Material Genético',
      description: 'Embriões e Doses de Sêmen',
      icon: EmbryoIcon,
      route: '/relatorios/material',
      color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    },
    {
      title: 'Produção',
      description: 'Lotes FIV e Métricas',
      icon: TrendingUp,
      route: '/relatorios/producao',
      color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Hub Relatórios"
        description={
          userContext.isCliente
            ? `Visualize os dados e relatórios da sua conta`
            : 'Central de consultas e relatórios do sistema'
        }
      />

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Activity className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {loading ? '...' : stats.protocolos}
                </p>
                <p className="text-xs text-muted-foreground">Protocolos (30d)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Calendar className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {loading ? '...' : stats.aspiracoes}
                </p>
                <p className="text-xs text-muted-foreground">Aspirações (30d)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Users className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {loading ? '...' : stats.receptoras}
                </p>
                <p className="text-xs text-muted-foreground">Receptoras</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Dna className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {loading ? '...' : stats.doadoras}
                </p>
                <p className="text-xs text-muted-foreground">Doadoras</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <EmbryoIcon className="w-5 h-5 text-cyan-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {loading ? '...' : stats.embrioes}
                </p>
                <p className="text-xs text-muted-foreground">Embriões Cong.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-rose-500/10">
                <Dna className="w-5 h-5 text-rose-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {loading ? '...' : stats.dosesSemen}
                </p>
                <p className="text-xs text-muted-foreground">Doses Sêmen</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cards de navegação */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {menuCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.route}
              className="cursor-pointer hover:shadow-md transition-shadow group"
              onClick={() => navigate(card.route)}
            >
              <CardHeader className="pb-2">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${card.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
              </CardHeader>
              <CardContent>
                <CardTitle className="text-base mb-1 flex items-center justify-between">
                  {card.title}
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </CardTitle>
                <CardDescription>{card.description}</CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
