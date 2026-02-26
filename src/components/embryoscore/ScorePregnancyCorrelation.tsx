/**
 * Dashboard de correlação EmbryoScore × Taxa de Prenhez
 *
 * Scatter plot mostrando score do embrião (eixo X) vs resultado DG (eixo Y).
 * Dados: embryo_scores → transferencias_embrioes → diagnosticos_gestacao
 *
 * Usa Recharts (já instalado no projeto).
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import { TrendingUp, Brain, Info, Eye } from 'lucide-react';
import { getScoreColor } from './EmbryoScoreBadge';

interface CorrelationDataPoint {
  embryo_score: number;
  classification: string;
  prenhe: boolean;
  resultado_dg: string;
  embriao_id: string;
  identificacao: string;
}

interface AggregatedBucket {
  faixa: string;
  min: number;
  max: number;
  total: number;
  prenhes: number;
  taxa: number;
}

function useScorePregnancyData() {
  return useQuery<CorrelationDataPoint[]>({
    queryKey: ['score-pregnancy-correlation'],
    queryFn: async () => {
      // 1. Buscar scores atuais (apenas is_current para reduzir volume)
      const { data: scores, error: scoresError } = await supabase
        .from('embryo_scores')
        .select('embriao_id, embryo_score, classification')
        .eq('is_current', true);

      if (scoresError) throw scoresError;
      if (!scores?.length) return [];

      // 2. Buscar transferências que tenham embrião com score
      // Abordagem inversa: buscar TEs primeiro (tabela menor) e depois filtrar
      const { data: transferencias, error: teError } = await supabase
        .from('transferencias_embrioes')
        .select('embriao_id, receptora_id')
        .not('embriao_id', 'is', null);

      if (teError) throw teError;
      if (!transferencias?.length) return [];

      // Filtrar apenas TEs cujo embrião tem score
      const scoreMap = new Map(scores.map(s => [s.embriao_id, s]));
      const relevantTEs = transferencias.filter(t => scoreMap.has(t.embriao_id));
      if (!relevantTEs.length) return [];

      const receptoraIds = [...new Set(relevantTEs.map(t => t.receptora_id))];

      // 3. Buscar DGs dessas receptoras (em batches para evitar URL limit)
      const BATCH_SIZE = 200;
      const allDgs: { receptora_id: string; resultado: string }[] = [];
      for (let i = 0; i < receptoraIds.length; i += BATCH_SIZE) {
        const batch = receptoraIds.slice(i, i + BATCH_SIZE);
        const { data: dgs, error: dgError } = await supabase
          .from('diagnosticos_gestacao')
          .select('receptora_id, resultado')
          .in('receptora_id', batch);
        if (dgError) throw dgError;
        if (dgs) allDgs.push(...dgs);
      }

      if (!allDgs.length) return [];

      // Montar mapas
      const dgMap = new Map<string, string>();
      for (const dg of allDgs) {
        dgMap.set(dg.receptora_id, dg.resultado);
      }

      const embriaoReceptoraMap = new Map<string, string>();
      for (const te of relevantTEs) {
        embriaoReceptoraMap.set(te.embriao_id, te.receptora_id);
      }

      // 4. Buscar identificações dos embriões relevantes
      const relevantEmbriaoIds = relevantTEs.map(t => t.embriao_id);
      const allEmbrioes: { id: string; identificacao: string | null }[] = [];
      for (let i = 0; i < relevantEmbriaoIds.length; i += BATCH_SIZE) {
        const batch = relevantEmbriaoIds.slice(i, i + BATCH_SIZE);
        const { data: embrioes } = await supabase
          .from('embrioes')
          .select('id, identificacao')
          .in('id', batch);
        if (embrioes) allEmbrioes.push(...embrioes);
      }

      const embriaoMap = new Map(allEmbrioes.map(e => [e.id, e.identificacao || 'Sem código']));

      // Correlacionar
      const result: CorrelationDataPoint[] = [];
      for (const [embriaoId, score] of scoreMap) {
        const receptoraId = embriaoReceptoraMap.get(embriaoId);
        if (!receptoraId) continue;

        const resultado = dgMap.get(receptoraId);
        if (!resultado) continue;

        result.push({
          embryo_score: score.embryo_score,
          classification: score.classification,
          prenhe: resultado.startsWith('PRENHE'),
          resultado_dg: resultado,
          embriao_id: embriaoId,
          identificacao: embriaoMap.get(embriaoId) || 'Sem código',
        });
      }

      return result;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null;
  const data = payload[0].payload as CorrelationDataPoint;
  const colors = getScoreColor(data.embryo_score);

  return (
    <div className="glass-panel border border-border rounded-lg shadow-lg p-3 text-xs">
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`w-6 h-6 rounded ${colors.bg} flex items-center justify-center`}>
          <span className={`text-[10px] font-bold ${colors.text}`}>{Math.round(data.embryo_score)}</span>
        </div>
        <span className="font-semibold text-foreground">{data.identificacao}</span>
      </div>
      <div className="space-y-0.5 text-muted-foreground">
        <div>IA: {data.classification}</div>
        <div>
          DG:{' '}
          <span className={data.prenhe ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-red-600 dark:text-red-400 font-semibold'}>
            {data.resultado_dg.replace('_', ' ')}
          </span>
        </div>
      </div>
    </div>
  );
}

export function ScorePregnancyCorrelation() {
  const { data: correlationData = [], isLoading, isError } = useScorePregnancyData();
  const [viewMode, setViewMode] = useState<'scatter' | 'buckets'>('buckets');

  // Agregar por faixas de score
  const buckets = useMemo<AggregatedBucket[]>(() => {
    const ranges = [
      { faixa: '0-19', min: 0, max: 19 },
      { faixa: '20-39', min: 20, max: 39 },
      { faixa: '40-59', min: 40, max: 59 },
      { faixa: '60-79', min: 60, max: 79 },
      { faixa: '80-100', min: 80, max: 100 },
    ];

    return ranges.map(r => {
      const inRange = correlationData.filter(
        d => d.embryo_score >= r.min && d.embryo_score <= r.max
      );
      const prenhes = inRange.filter(d => d.prenhe).length;
      return {
        ...r,
        total: inRange.length,
        prenhes,
        taxa: inRange.length > 0 ? (prenhes / inRange.length) * 100 : 0,
      };
    });
  }, [correlationData]);

  // Estatísticas gerais
  const stats = useMemo(() => {
    if (!correlationData.length) return null;
    const prenhes = correlationData.filter(d => d.prenhe);
    const vazias = correlationData.filter(d => !d.prenhe);

    const avg = (arr: CorrelationDataPoint[]) =>
      arr.length > 0 ? arr.reduce((s, d) => s + d.embryo_score, 0) / arr.length : 0;

    return {
      total: correlationData.length,
      prenhes: prenhes.length,
      vazias: vazias.length,
      taxaGeral: (prenhes.length / correlationData.length) * 100,
      avgScorePrenhe: avg(prenhes),
      avgScoreVazia: avg(vazias),
    };
  }, [correlationData]);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border/60 glass-panel p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-muted rounded w-48" />
          <div className="h-[250px] bg-muted/50 rounded-lg" />
        </div>
      </div>
    );
  }

  if (isError || !correlationData.length) {
    return (
      <div className="rounded-xl border border-border/60 glass-panel overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-muted/60 to-transparent border-b border-border/50">
          <div className="w-1 h-5 rounded-full bg-primary/50" />
          <TrendingUp className="w-4 h-4 text-primary/60" />
          <span className="text-sm font-semibold text-foreground">Score × Prenhez</span>
        </div>
        <div className="p-8 text-center">
          <Info className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Ainda sem dados para correlação
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1 max-w-md mx-auto">
            Este gráfico cruza o score da IA com o resultado do DG. Para aparecer, embriões analisados precisam ter sido transferidos (TE) e a receptora precisa ter resultado de DG registrado.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 glass-panel overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-muted/60 to-transparent border-b border-border/50">
        <div className="w-1 h-5 rounded-full bg-primary/50" />
        <TrendingUp className="w-4 h-4 text-primary/60" />
        <span className="text-sm font-semibold text-foreground">Correlação Score × Prenhez</span>
        <span className="text-xs text-muted-foreground ml-auto">{correlationData.length} embriões</span>
      </div>

      <div className="p-4 space-y-4">
        {/* Stats rápidos */}
        {stats && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-2 rounded-lg bg-muted/30">
                <div className="text-lg font-bold text-foreground">{stats.total}</div>
                <div className="text-[10px] text-muted-foreground">Total analisados</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-emerald-500/10">
                <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{stats.taxaGeral.toFixed(1)}%</div>
                <div className="text-[10px] text-muted-foreground">Taxa prenhez geral</div>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted/30">
                <div className="text-lg font-bold text-foreground">{stats.prenhes}/{stats.vazias}</div>
                <div className="text-[10px] text-muted-foreground">Prenhes / Vazias</div>
              </div>
            </div>

            {/* Score Comparação */}
            <div className="rounded-lg border border-border/50 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Eye className="w-3.5 h-3.5 text-primary/60" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Score Médio</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-center">
                  <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{Math.round(stats.avgScorePrenhe)}</div>
                  <div className="text-[9px] text-muted-foreground">Prenhes</div>
                </div>
                <div className="text-[10px] text-muted-foreground">vs</div>
                <div className="text-center">
                  <div className="text-sm font-bold text-red-700 dark:text-red-400">{Math.round(stats.avgScoreVazia)}</div>
                  <div className="text-[9px] text-muted-foreground">Vazias</div>
                </div>
                <div className="text-center border-l border-border/50 pl-3">
                  <div className={`text-sm font-bold ${stats.avgScorePrenhe - stats.avgScoreVazia > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {stats.avgScorePrenhe - stats.avgScoreVazia > 0 ? '+' : ''}{Math.round(stats.avgScorePrenhe - stats.avgScoreVazia)}
                  </div>
                  <div className="text-[9px] text-muted-foreground">Diff</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Toggles */}
        <div className="flex items-center justify-end gap-3">
          {/* View mode */}
          <div className="flex gap-1 rounded-lg border border-border p-0.5">
            <button
              onClick={() => setViewMode('buckets')}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${viewMode === 'buckets'
                  ? 'bg-muted text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              Por faixa
            </button>
            <button
              onClick={() => setViewMode('scatter')}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${viewMode === 'scatter'
                  ? 'bg-muted text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              Scatter
            </button>
          </div>
        </div>

        {/* Gráfico */}
        {viewMode === 'scatter' ? (
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis
                  type="number"
                  dataKey="embryo_score"
                  domain={[0, 100]}
                  name="Score"
                  tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                  label={{ value: 'Embryo Score', position: 'bottom', offset: 5, style: { fontSize: 10, fill: 'var(--muted-foreground)' } }}
                />
                <YAxis
                  type="number"
                  dataKey={(d: CorrelationDataPoint) => d.prenhe ? 1 : 0}
                  domain={[-0.2, 1.2]}
                  ticks={[0, 1]}
                  tickFormatter={(v) => v === 1 ? 'Prenhe' : 'Vazia'}
                  tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                  width={50}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={0.5} strokeDasharray="3 3" className="stroke-border" />
                <Scatter data={correlationData} fill="#2ECC71">
                  {correlationData.map((entry, index) => {
                    const colors = getScoreColor(entry.embryo_score);
                    const fillColor = entry.prenhe ? '#38a169' : '#e53e3e';
                    return <Cell key={index} fill={fillColor} opacity={0.7} />;
                  })}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        ) : (
          /* Visualização por faixas */
          <div className="space-y-2">
            {buckets.map((bucket) => {
              const colors = getScoreColor(bucket.min + 10);
              return (
                <div key={bucket.faixa} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/20">
                  <div className={`w-12 text-center px-2 py-1 rounded ${colors.bg}`}>
                    <span className={`text-xs font-bold ${colors.text}`}>{bucket.faixa}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500/80 to-emerald-500 rounded-full transition-all"
                          style={{ width: `${bucket.taxa}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-foreground w-12 text-right">
                        {bucket.total > 0 ? `${bucket.taxa.toFixed(0)}%` : '-'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">
                        {bucket.prenhes} prenhes / {bucket.total} total
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Legenda */}
        <div className="flex items-center gap-4 pt-2 border-t border-border/30">
          <Brain className="w-3.5 h-3.5 text-muted-foreground" />
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Prenhe
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            Vazia
          </div>
        </div>
      </div>
    </div>
  );
}
