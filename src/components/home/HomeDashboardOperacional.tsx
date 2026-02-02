import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import EmptyState from '@/components/shared/EmptyState';
import { useToast } from '@/hooks/use-toast';
import {
  Home,
  Users,
  Beef,
  Baby,
  Syringe,
  Stethoscope,
  Dna,
  Calendar,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { differenceInDays } from 'date-fns';

interface ResumoData {
  totalClientes: number;
  totalFazendas: number;
  totalReceptoras: number;
  totalPrenhes: number;
}

interface ServicosPendentes {
  protocolosPasso2: number;
  receptorasDG: number;
  receptorasSexagem: number;
  partoProximo: number;
}

interface FazendaComServicos {
  id: string;
  nome: string;
  cliente_nome: string;
  protocolosPasso2: number;
  receptorasDG: number;
  receptorasSexagem: number;
  partoProximo: number;
  totalPendentes: number;
}

interface Props {
  clienteIds: string[];
}

export default function HomeDashboardOperacional({ clienteIds }: Props) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [resumo, setResumo] = useState<ResumoData>({
    totalClientes: 0,
    totalFazendas: 0,
    totalReceptoras: 0,
    totalPrenhes: 0,
  });
  const [servicosPendentes, setServicosPendentes] = useState<ServicosPendentes>({
    protocolosPasso2: 0,
    receptorasDG: 0,
    receptorasSexagem: 0,
    partoProximo: 0,
  });
  const [fazendasComServicos, setFazendasComServicos] = useState<FazendaComServicos[]>([]);

  useEffect(() => {
    if (clienteIds.length > 0) {
      loadData();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteIds]);

  const loadData = async () => {
    try {
      setLoading(true);

      const { data: fazendas, error: fazendasError } = await supabase
        .from('fazendas')
        .select('id, nome, cliente_id, cliente:clientes(nome)')
        .in('cliente_id', clienteIds)
        .order('nome');

      if (fazendasError) throw fazendasError;

      const fazendaIds = fazendas?.map(f => f.id) || [];

      if (fazendaIds.length === 0) {
        setResumo({ totalClientes: clienteIds.length, totalFazendas: 0, totalReceptoras: 0, totalPrenhes: 0 });
        setLoading(false);
        return;
      }

      const { data: receptorasView } = await supabase
        .from('vw_receptoras_fazenda_atual')
        .select('receptora_id, fazenda_id_atual')
        .in('cliente_id', clienteIds);

      const receptoraIds = receptorasView?.map(r => r.receptora_id) || [];

      let receptorasData: { id: string; status_reprodutivo?: string; data_provavel_parto?: string }[] = [];
      if (receptoraIds.length > 0) {
        const { data } = await supabase
          .from('receptoras')
          .select('id, status_reprodutivo, data_provavel_parto')
          .in('id', receptoraIds);
        receptorasData = data || [];
      }

      const { data: protocolos } = await supabase
        .from('protocolos_sincronizacao')
        .select('id, fazenda_id')
        .in('fazenda_id', fazendaIds)
        .eq('status', 'PASSO1_FECHADO');

      const { data: transferencias } = await supabase
        .from('transferencias_embrioes')
        .select('id, receptora_id, data_te')
        .in('receptora_id', receptoraIds)
        .eq('status_te', 'REALIZADA');

      const receptorasPorFazenda = new Map<string, typeof receptorasData>();
      receptorasView?.forEach(rv => {
        const receptora = receptorasData.find(r => r.id === rv.receptora_id);
        if (receptora) {
          const current = receptorasPorFazenda.get(rv.fazenda_id_atual) || [];
          current.push(receptora);
          receptorasPorFazenda.set(rv.fazenda_id_atual, current);
        }
      });

      const ultimaTE = new Map<string, string>();
      transferencias?.forEach(t => {
        if (t.receptora_id && t.data_te) {
          const existing = ultimaTE.get(t.receptora_id);
          if (!existing || t.data_te > existing) {
            ultimaTE.set(t.receptora_id, t.data_te);
          }
        }
      });

      const hoje = new Date();
      let totalReceptoras = 0;
      let totalPrenhes = 0;
      let totalProtocolosPasso2 = 0;
      let totalDG = 0;
      let totalSexagem = 0;
      let totalPartoProximo = 0;

      const protocolosPorFazenda = new Map<string, number>();
      protocolos?.forEach(p => {
        protocolosPorFazenda.set(p.fazenda_id, (protocolosPorFazenda.get(p.fazenda_id) || 0) + 1);
        totalProtocolosPasso2++;
      });

      const fazendasProcessadas: FazendaComServicos[] = [];

      for (const fazenda of (fazendas || [])) {
        const receptoras = receptorasPorFazenda.get(fazenda.id) || [];
        totalReceptoras += receptoras.length;

        let fazendaDG = 0;
        let fazendaSexagem = 0;
        let fazendaPartoProximo = 0;

        receptoras.forEach(r => {
          const status = r.status_reprodutivo || 'VAZIA';

          if (status.includes('PRENHE')) totalPrenhes++;

          if (status === 'SERVIDA') {
            const dataTE = ultimaTE.get(r.id);
            if (dataTE && differenceInDays(hoje, new Date(dataTE)) >= 27) {
              fazendaDG++;
              totalDG++;
            }
          }

          if (status === 'PRENHE' || status === 'PRENHE_RETOQUE') {
            const dataTE = ultimaTE.get(r.id);
            if (dataTE && differenceInDays(hoje, new Date(dataTE)) >= 54) {
              fazendaSexagem++;
              totalSexagem++;
            }
          }

          if (r.data_provavel_parto && status.includes('PRENHE')) {
            const diasParto = differenceInDays(new Date(r.data_provavel_parto), hoje);
            if (diasParto >= 0 && diasParto <= 30) {
              fazendaPartoProximo++;
              totalPartoProximo++;
            }
          }
        });

        const protocolosFazenda = protocolosPorFazenda.get(fazenda.id) || 0;
        const totalPendentes = protocolosFazenda + fazendaDG + fazendaSexagem + fazendaPartoProximo;

        if (totalPendentes > 0) {
          fazendasProcessadas.push({
            id: fazenda.id,
            nome: fazenda.nome,
            cliente_nome: (fazenda.cliente as { nome: string })?.nome || '',
            protocolosPasso2: protocolosFazenda,
            receptorasDG: fazendaDG,
            receptorasSexagem: fazendaSexagem,
            partoProximo: fazendaPartoProximo,
            totalPendentes,
          });
        }
      }

      fazendasProcessadas.sort((a, b) => b.totalPendentes - a.totalPendentes);

      setResumo({
        totalClientes: clienteIds.length,
        totalFazendas: fazendas?.length || 0,
        totalReceptoras,
        totalPrenhes,
      });

      setServicosPendentes({
        protocolosPasso2: totalProtocolosPasso2,
        receptorasDG: totalDG,
        receptorasSexagem: totalSexagem,
        partoProximo: totalPartoProximo,
      });

      setFazendasComServicos(fazendasProcessadas.slice(0, 5)); // Limitar a 5

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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-32 rounded-xl" />
      </div>
    );
  }

  if (clienteIds.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8">
        <EmptyState
          title="Nenhum cliente vinculado"
          description="Você ainda não tem clientes vinculados. Entre em contato com o administrador."
        />
      </div>
    );
  }

  const totalPendentes = servicosPendentes.protocolosPasso2 +
    servicosPendentes.receptorasDG +
    servicosPendentes.receptorasSexagem +
    servicosPendentes.partoProximo;

  const kpiCards = [
    { label: 'Clientes', value: resumo.totalClientes, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Fazendas', value: resumo.totalFazendas, icon: Home, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Receptoras', value: resumo.totalReceptoras, icon: Beef, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { label: 'Prenhes', value: resumo.totalPrenhes, icon: Baby, color: 'text-pink-500', bg: 'bg-pink-500/10' },
  ];

  const servicosConfig = [
    { key: 'protocolosPasso2', label: '2º Passo', icon: Syringe, color: 'text-yellow-600', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
    { key: 'receptorasDG', label: 'DG (≥27d)', icon: Stethoscope, color: 'text-purple-600', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
    { key: 'receptorasSexagem', label: 'Sexagem (≥54d)', icon: Dna, color: 'text-pink-600', bg: 'bg-pink-500/10', border: 'border-pink-500/20' },
    { key: 'partoProximo', label: 'Parto ≤30d', icon: Calendar, color: 'text-green-600', bg: 'bg-green-500/10', border: 'border-green-500/20' },
  ];

  return (
    <div className="space-y-4">
      {/* KPIs Premium */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-border/50">
          {kpiCards.map((kpi) => (
            <div key={kpi.label} className="p-4 hover:bg-muted/30 transition-colors group">
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

      {/* Serviços Pendentes */}
      {totalPendentes > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/5 via-card to-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h3 className="font-semibold text-foreground">Serviços Pendentes</h3>
            <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 ml-auto">
              {totalPendentes} total
            </Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {servicosConfig.map((servico) => {
              const count = servicosPendentes[servico.key as keyof ServicosPendentes];
              if (count === 0) return null;
              return (
                <div key={servico.key} className={`flex items-center gap-3 p-3 rounded-lg ${servico.bg} border ${servico.border}`}>
                  <servico.icon className={`w-5 h-5 ${servico.color}`} />
                  <div>
                    <p className="text-lg font-bold">{count}</p>
                    <p className="text-xs text-muted-foreground">{servico.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Fazendas com Pendências */}
      {fazendasComServicos.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-muted/50 to-transparent">
            <h3 className="font-semibold text-sm">Próximos Serviços por Fazenda</h3>
          </div>
          <div className="divide-y divide-border/50">
            {fazendasComServicos.map((fazenda) => (
              <div
                key={fazenda.id}
                onClick={() => navigate(`/fazendas/${fazenda.id}`)}
                className="flex items-center justify-between p-3 hover:bg-muted/30 cursor-pointer group transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">{fazenda.nome}</p>
                  <p className="text-xs text-muted-foreground truncate">{fazenda.cliente_nome}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex flex-wrap gap-1">
                    {fazenda.protocolosPasso2 > 0 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-yellow-500/10 text-yellow-700 border-yellow-500/30">
                        {fazenda.protocolosPasso2} 2ºP
                      </Badge>
                    )}
                    {fazenda.receptorasDG > 0 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-purple-500/10 text-purple-700 border-purple-500/30">
                        {fazenda.receptorasDG} DG
                      </Badge>
                    )}
                    {fazenda.receptorasSexagem > 0 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-pink-500/10 text-pink-700 border-pink-500/30">
                        {fazenda.receptorasSexagem} Sex
                      </Badge>
                    )}
                    {fazenda.partoProximo > 0 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-green-500/10 text-green-700 border-green-500/30">
                        {fazenda.partoProximo} Parto
                      </Badge>
                    )}
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quando não tem pendências */}
      {totalPendentes === 0 && fazendasComServicos.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
            <Calendar className="w-6 h-6 text-green-600" />
          </div>
          <p className="font-medium text-foreground">Tudo em dia!</p>
          <p className="text-sm text-muted-foreground">Não há serviços pendentes no momento</p>
        </div>
      )}
    </div>
  );
}
