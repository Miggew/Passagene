import { useEffect, useState, useMemo } from 'react';
import { format } from 'date-fns';
import { todayISO as getTodayDateString, addDays } from '@/lib/dateUtils';
import { Card, CardContent } from '@/components/ui/card';
import {
  Users,
  Dna,
  Calendar,
  Activity,
  Target,
  Stethoscope,
} from 'lucide-react';
import { CowIcon } from '@/components/icons/CowIcon';
import { EmbryoIcon } from '@/components/icons/EmbryoIcon';
import { supabase } from '@/lib/supabase';
import { useClienteFilter } from '@/hooks/useClienteFilter';
import PageHeader from '@/components/shared/PageHeader';
import {
  KPICard,
  TrendLineChart,
  HorizontalBarChart,
  PeriodSelector,
  gerarPeriodo,
} from '@/components/charts';
import type { PeriodoTipo } from '@/components/charts';
import { useKPIData } from '@/hooks/useKPIData';

interface DashboardStats {
  protocolos: number;
  aspiracoes: number;
  receptoras: number;
  doadoras: number;
  embrioes: number;
  dosesSemen: number;
}

export default function RelatoriosHome() {
  const { clienteIdFilter, userContext } = useClienteFilter();

  // Estado dos cards de resumo (30 dias)
  const [stats, setStats] = useState<DashboardStats>({
    protocolos: 0,
    aspiracoes: 0,
    receptoras: 0,
    doadoras: 0,
    embrioes: 0,
    dosesSemen: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  // Estado do período para KPIs
  const [periodoTipo, setPeriodoTipo] = useState<PeriodoTipo>('trimestre');
  const [periodoValor, setPeriodoValor] = useState(() => {
    const agora = new Date();
    const t = Math.ceil((agora.getMonth() + 1) / 3);
    return `${agora.getFullYear()}-T${t}`;
  });

  // Gerar período completo
  const periodo = useMemo(() => gerarPeriodo(periodoTipo, periodoValor), [periodoTipo, periodoValor]);

  // Buscar dados de KPIs
  const {
    data: kpiData,
    loading: loadingKPI,
    anoAtual,
    anoAnterior,
    temDadosAnoAnterior,
  } = useKPIData({
    periodo,
    clienteId: clienteIdFilter ?? undefined,
  });

  // Carregar estatísticas de 30 dias
  useEffect(() => {
    loadStats();
  }, [clienteIdFilter]);

  const loadStats = async () => {
    try {
      setLoadingStats(true);

      // Buscar fazendas do cliente (se filtro ativo)
      let fazendaIds: string[] = [];
      if (clienteIdFilter) {
        const { data: fazendas } = await supabase
          .from('fazendas')
          .select('id')
          .eq('cliente_id', clienteIdFilter);
        fazendaIds = fazendas?.map(f => f.id) ?? [];
      }

      const dataLimite = addDays(getTodayDateString(), -30);

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
            .gte('data_inicio', dataLimite)
          : supabase
            .from('protocolos_sincronizacao')
            .select('id', { count: 'exact', head: true })
            .gte('data_inicio', dataLimite),

        // Aspirações dos últimos 30 dias
        clienteIdFilter && fazendaIds.length > 0
          ? supabase
            .from('pacotes_aspiracao')
            .select('id', { count: 'exact', head: true })
            .in('fazenda_id', fazendaIds)
            .gte('data_aspiracao', dataLimite)
          : supabase
            .from('pacotes_aspiracao')
            .select('id', { count: 'exact', head: true })
            .gte('data_aspiracao', dataLimite),

        // Total de receptoras
        clienteIdFilter && fazendaIds.length > 0
          ? supabase
            .from('receptoras')
            .select('id', { count: 'exact', head: true })
            .in('fazenda_atual_id', fazendaIds)
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
      setLoadingStats(false);
    }
  };

  // Preparar comparativo para KPICard
  const getComparativo = (kpi: typeof kpiData.taxaPrenhez) => {
    if (kpi.anterior === null) return undefined;
    return {
      valorAnterior: kpi.anterior,
      labelAnterior: periodo.labelAnterior,
      delta: kpi.delta ?? 0,
      deltaPercent: kpi.deltaPercent ?? 0,
    };
  };

  const getSemComparativo = () => {
    if (temDadosAnoAnterior) return undefined;
    return {
      mensagem: `Comparativo disponível quando houver dados de ${anoAnterior}`,
    };
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Visão Geral"
        description={
          userContext.isCliente
            ? 'Análise de performance da sua conta'
            : 'Análise de performance e indicadores do sistema'
        }
      />

      {/* Seletor de Período */}
      <div className="rounded-xl border border-border bg-gradient-to-r from-card via-card to-muted/30 p-4">
        <PeriodSelector
          tipo={periodoTipo}
          valor={periodoValor}
          onTipoChange={setPeriodoTipo}
          onValorChange={setPeriodoValor}
        />
      </div>

      {/* KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Taxa de Prenhez"
          value={loadingKPI ? '...' : `${kpiData.taxaPrenhez.atual.toFixed(1)}%`}
          subtitle={`${kpiData.taxaPrenhez.total} diagnósticos`}
          icon={<Target className="w-5 h-5 text-emerald-600" />}
          iconBgColor="bg-emerald-500/10"
          comparativo={getComparativo(kpiData.taxaPrenhez)}
          semComparativo={getSemComparativo()}
          loading={loadingKPI}
        />

        <KPICard
          title="Taxa de Virada"
          value={loadingKPI ? '...' : `${kpiData.taxaVirada.atual.toFixed(1)}%`}
          subtitle={`${kpiData.taxaVirada.total} embriões`}
          icon={<EmbryoIcon className="w-5 h-5 text-cyan-600" />}
          iconBgColor="bg-cyan-500/10"
          comparativo={getComparativo(kpiData.taxaVirada)}
          semComparativo={getSemComparativo()}
          loading={loadingKPI}
        />

        <KPICard
          title="Total de TEs"
          value={loadingKPI ? '...' : kpiData.totalTEs.toLocaleString()}
          subtitle="transferências realizadas"
          icon={<Activity className="w-5 h-5 text-violet-600" />}
          iconBgColor="bg-violet-500/10"
          loading={loadingKPI}
        />

        <KPICard
          title="Total de DGs"
          value={loadingKPI ? '...' : kpiData.totalDGs.toLocaleString()}
          subtitle="diagnósticos realizados"
          icon={<Stethoscope className="w-5 h-5 text-amber-600" />}
          iconBgColor="bg-amber-500/10"
          loading={loadingKPI}
        />
      </div>

      {/* Cards de Resumo Rápido (30 dias) */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground px-1">Resumo dos últimos 30 dias</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Activity className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {loadingStats ? '...' : stats.protocolos}
                  </p>
                  <p className="text-xs text-muted-foreground">Protocolos</p>
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
                    {loadingStats ? '...' : stats.aspiracoes}
                  </p>
                  <p className="text-xs text-muted-foreground">Aspirações</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <CowIcon className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {loadingStats ? '...' : stats.receptoras}
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
                    {loadingStats ? '...' : stats.doadoras}
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
                    {loadingStats ? '...' : stats.embrioes}
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
                    {loadingStats ? '...' : stats.dosesSemen}
                  </p>
                  <p className="text-xs text-muted-foreground">Doses Sêmen</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Gráfico de Tendência */}
      <TrendLineChart
        title="Tendência da Taxa de Prenhez"
        description={`Evolução mensal - ${periodo.label}`}
        data={kpiData.tendenciaPrenhez}
        anoAtual={anoAtual}
        anoAnterior={temDadosAnoAnterior ? anoAnterior : undefined}
        loading={loadingKPI}
      />

      {/* Rankings - Primeira Linha */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HorizontalBarChart
          title="Taxa de Virada por Touro"
          description="Ranking de touros por conversão de oócitos em embriões"
          data={kpiData.rankingTouros}
          loading={loadingKPI}
          showMeta
          metaValue={40}
          barColor="hsl(var(--primary))"
          maxItems={8}
        />

        <HorizontalBarChart
          title="Eficiência por Fazenda"
          description="Ranking de fazendas por taxa de prenhez"
          data={kpiData.rankingFazendas}
          loading={loadingKPI}
          showMeta
          metaValue={50}
          barColor="hsl(180, 70%, 45%)"
          maxItems={8}
        />
      </div>

      {/* Rankings - Segunda Linha */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <HorizontalBarChart
          title="Top 10 Doadoras"
          description="Por taxa de virada de embriões"
          data={kpiData.rankingDoadoras}
          loading={loadingKPI}
          showMeta
          metaValue={35}
          barColor="hsl(280, 60%, 55%)"
          maxItems={10}
        />

        <HorizontalBarChart
          title="Eficiência dos Veterinários"
          description="Taxa de prenhez por veterinário"
          data={kpiData.rankingVeterinarios}
          loading={loadingKPI}
          showMeta
          metaValue={50}
          barColor="hsl(210, 70%, 50%)"
          maxItems={8}
        />

        <HorizontalBarChart
          title="Eficiência dos Técnicos"
          description="Taxa de prenhez por técnico"
          data={kpiData.rankingTecnicos}
          loading={loadingKPI}
          showMeta
          metaValue={50}
          barColor="hsl(25, 80%, 55%)"
          maxItems={8}
        />
      </div>

      {/* Legenda de cores */}
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <div className="flex flex-wrap items-center gap-6 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Legenda:</span>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-emerald-600" />
            <span>Acima da meta</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-amber-500" />
            <span>Próximo da meta (80%+)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-red-500" />
            <span>Abaixo da meta</span>
          </div>
          {temDadosAnoAnterior && (
            <div className="ml-auto flex items-center gap-2">
              <div className="w-6 h-0.5 bg-muted-foreground opacity-50" />
              <span>Período anterior</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
