import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import EmptyState from '@/components/shared/EmptyState';
import { useToast } from '@/hooks/use-toast';
import {
  Home,
  Beef,
  Baby,
  Snowflake,
  Syringe,
  ArrowRight,
  MapPin,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ResumoData {
  totalFazendas: number;
  totalReceptoras: number;
  totalPrenhes: number;
  totalEmbrioes: number;
  totalDoses: number;
}

interface FazendaInfo {
  id: string;
  nome: string;
  localizacao?: string;
  totalReceptoras: number;
  totalPrenhes: number;
}

interface Props {
  clienteId: string;
  clienteNome?: string;
}

export default function HomeDashboardCliente({ clienteId }: Props) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [resumo, setResumo] = useState<ResumoData>({
    totalFazendas: 0,
    totalReceptoras: 0,
    totalPrenhes: 0,
    totalEmbrioes: 0,
    totalDoses: 0,
  });
  const [fazendas, setFazendas] = useState<FazendaInfo[]>([]);

  useEffect(() => {
    if (clienteId) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load fazendas
      const { data: fazendasData, error: fazendasError } = await supabase
        .from('fazendas')
        .select('id, nome, localizacao')
        .eq('cliente_id', clienteId)
        .order('nome');

      if (fazendasError) throw fazendasError;

      const fazendaIds = fazendasData?.map(f => f.id) || [];

      // Load counts in parallel
      const [embrioesRes, dosesRes, receptorasView] = await Promise.all([
        supabase
          .from('embrioes')
          .select('id', { count: 'exact', head: true })
          .eq('cliente_id', clienteId)
          .eq('status_atual', 'CONGELADO'),
        supabase
          .from('doses_semen')
          .select('id', { count: 'exact', head: true })
          .eq('cliente_id', clienteId),
        fazendaIds.length > 0
          ? supabase
              .from('vw_receptoras_fazenda_atual')
              .select('receptora_id, fazenda_id_atual')
              .eq('cliente_id', clienteId)
          : Promise.resolve({ data: [] }),
      ]);

      const receptoraIds = receptorasView.data?.map((r: { receptora_id: string }) => r.receptora_id) || [];

      // Load receptora status
      let receptorasData: { id: string; status_reprodutivo?: string }[] = [];
      if (receptoraIds.length > 0) {
        const { data } = await supabase
          .from('receptoras')
          .select('id, status_reprodutivo')
          .in('id', receptoraIds);
        receptorasData = data || [];
      }

      // Build fazenda map
      const receptorasPorFazenda = new Map<string, { total: number; prenhes: number }>();
      receptorasView.data?.forEach((rv: { receptora_id: string; fazenda_id_atual: string }) => {
        const receptora = receptorasData.find(r => r.id === rv.receptora_id);
        if (receptora) {
          const current = receptorasPorFazenda.get(rv.fazenda_id_atual) || { total: 0, prenhes: 0 };
          current.total++;
          if (receptora.status_reprodutivo?.includes('PRENHE')) {
            current.prenhes++;
          }
          receptorasPorFazenda.set(rv.fazenda_id_atual, current);
        }
      });

      // Calculate totals
      let totalReceptoras = 0;
      let totalPrenhes = 0;
      receptorasPorFazenda.forEach(v => {
        totalReceptoras += v.total;
        totalPrenhes += v.prenhes;
      });

      // Build fazendas list
      const fazendasProcessadas: FazendaInfo[] = (fazendasData || []).map(f => {
        const stats = receptorasPorFazenda.get(f.id) || { total: 0, prenhes: 0 };
        return {
          id: f.id,
          nome: f.nome,
          localizacao: f.localizacao,
          totalReceptoras: stats.total,
          totalPrenhes: stats.prenhes,
        };
      });

      setResumo({
        totalFazendas: fazendasData?.length || 0,
        totalReceptoras,
        totalPrenhes,
        totalEmbrioes: embrioesRes.count || 0,
        totalDoses: dosesRes.count || 0,
      });

      setFazendas(fazendasProcessadas);

    } catch (error) {
      toast({
        title: 'Erro ao carregar dados',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  const kpiCards = [
    { label: 'Fazendas', value: resumo.totalFazendas, icon: Home, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Receptoras', value: resumo.totalReceptoras, icon: Beef, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { label: 'Prenhes', value: resumo.totalPrenhes, icon: Baby, color: 'text-pink-500', bg: 'bg-pink-500/10' },
    { label: 'Embriões', value: resumo.totalEmbrioes, icon: Snowflake, color: 'text-cyan-500', bg: 'bg-cyan-500/10', sublabel: 'congelados' },
    { label: 'Doses', value: resumo.totalDoses, icon: Syringe, color: 'text-indigo-500', bg: 'bg-indigo-500/10', sublabel: 'sêmen' },
  ];

  return (
    <div className="space-y-4">
      {/* KPIs Premium */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-y md:divide-y-0 divide-border/50">
          {kpiCards.map((kpi) => (
            <div key={kpi.label} className="p-4 hover:bg-muted/30 transition-colors group">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${kpi.bg} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
                  <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{kpi.label}</p>
                  <p className="text-xl font-bold truncate">{kpi.value}</p>
                  {kpi.sublabel && (
                    <p className="text-[10px] text-muted-foreground">{kpi.sublabel}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Minhas Fazendas */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-muted/50 to-transparent flex items-center justify-between">
          <h3 className="font-semibold text-sm">Minhas Fazendas</h3>
          {fazendas.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {fazendas.length} fazenda{fazendas.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        {fazendas.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="Nenhuma fazenda"
              description="Você ainda não possui fazendas cadastradas"
            />
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {fazendas.map((fazenda) => (
              <div
                key={fazenda.id}
                onClick={() => navigate(`/fazendas/${fazenda.id}`)}
                className="flex items-center justify-between p-4 hover:bg-gradient-to-r hover:from-primary/5 hover:to-transparent cursor-pointer group transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Home className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                      {fazenda.nome}
                    </p>
                    {fazenda.localizacao && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {fazenda.localizacao}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex gap-2">
                    <div className="text-center px-3 py-1 rounded-lg bg-muted/50">
                      <p className="text-sm font-bold">{fazenda.totalReceptoras}</p>
                      <p className="text-[10px] text-muted-foreground">receptoras</p>
                    </div>
                    <div className="text-center px-3 py-1 rounded-lg bg-pink-500/10">
                      <p className="text-sm font-bold text-pink-600">{fazenda.totalPrenhes}</p>
                      <p className="text-[10px] text-muted-foreground">prenhes</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Atalhos */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => navigate('/embrioes-congelados')}
          className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:border-primary/30 hover:bg-gradient-to-r hover:from-primary/5 hover:to-transparent transition-all group text-left"
        >
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Snowflake className="w-5 h-5 text-cyan-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">Embriões</p>
            <p className="text-xs text-muted-foreground truncate">{resumo.totalEmbrioes} congelados</p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </button>

        <button
          onClick={() => navigate('/doses-semen')}
          className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:border-primary/30 hover:bg-gradient-to-r hover:from-primary/5 hover:to-transparent transition-all group text-left"
        >
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Syringe className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">Doses de Sêmen</p>
            <p className="text-xs text-muted-foreground truncate">{resumo.totalDoses} disponíveis</p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </button>
      </div>
    </div>
  );
}
