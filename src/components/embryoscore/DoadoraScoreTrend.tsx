import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Brain } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DoadoraScoreTrendProps {
  doadoraId: string;
}

interface TrendDataPoint {
  date: string;
  displayDate: string;
  score: number;
  loteId: string;
  count: number;
}

export function DoadoraScoreTrend({ doadoraId }: DoadoraScoreTrendProps) {
  const { data: trendData, isLoading } = useQuery({
    queryKey: ['doadora-score-trend', doadoraId],
    queryFn: async () => {
      // Step 1: Get aspiracoes_doadoras for this doadora
      const { data: aspiracoes, error: aspError } = await supabase
        .from('aspiracoes_doadoras')
        .select('id, aspiracao_id')
        .eq('doadora_id', doadoraId);

      if (aspError) throw aspError;
      if (!aspiracoes || aspiracoes.length === 0) return [];

      const aspIds = aspiracoes.map(a => a.id);

      // Step 2: Get lote_fiv_acasalamentos for those aspiracoes
      const { data: acasalamentos, error: acasError } = await supabase
        .from('lote_fiv_acasalamentos')
        .select('id, lote_fiv_id, aspiracao_doadora_id')
        .in('aspiracao_doadora_id', aspIds);

      if (acasError) throw acasError;
      if (!acasalamentos || acasalamentos.length === 0) return [];

      const acasIds = acasalamentos.map(a => a.id);
      const loteIds = [...new Set(acasalamentos.map(a => a.lote_fiv_id))];

      // Get lote dates for x-axis
      const { data: lotes, error: loteError } = await supabase
        .from('lotes_fiv')
        .select('id, data_abertura')
        .in('id', loteIds);

      if (loteError) throw loteError;
      if (!lotes) return [];

      const loteMap = new Map(lotes.map(l => [l.id, l.data_abertura]));

      // Step 3: Get embrioes for those acasalamentos
      const { data: embrioes, error: embError } = await supabase
        .from('embrioes')
        .select('id, lote_fiv_acasalamento_id')
        .in('lote_fiv_acasalamento_id', acasIds);

      if (embError) throw embError;
      if (!embrioes || embrioes.length === 0) return [];

      const embIds = embrioes.map(e => e.id);

      // Create map of embriao -> lote
      const embToLote = new Map<string, string>();
      embrioes.forEach(e => {
        const acas = acasalamentos.find(a => a.id === e.lote_fiv_acasalamento_id);
        if (acas) {
          embToLote.set(e.id, acas.lote_fiv_id);
        }
      });

      // Step 4: Get current embryo_scores for those embrioes
      const { data: scores, error: scoreError } = await supabase
        .from('embryo_scores')
        .select('embriao_id, embryo_score')
        .in('embriao_id', embIds)
        .eq('is_current', true);

      if (scoreError) throw scoreError;
      if (!scores || scores.length === 0) return [];

      // Group by lote and calculate averages
      const loteGroups = new Map<string, {
        scores: number[];
      }>();

      scores.forEach(s => {
        const loteId = embToLote.get(s.embriao_id);
        if (!loteId) return;

        if (!loteGroups.has(loteId)) {
          loteGroups.set(loteId, { scores: [] });
        }

        const group = loteGroups.get(loteId)!;
        if (s.embryo_score !== null) group.scores.push(s.embryo_score);
      });

      // Calculate averages per lote
      const result: TrendDataPoint[] = [];
      loteGroups.forEach((group, loteId) => {
        const date = loteMap.get(loteId);
        if (!date || group.scores.length === 0) return;

        const avgScore = group.scores.reduce((a, b) => a + b, 0) / group.scores.length;

        result.push({
          date,
          displayDate: format(new Date(date), 'dd/MMM', { locale: ptBR }),
          score: Math.round(avgScore * 10) / 10,
          loteId,
          count: group.scores.length
        });
      });

      // Sort by date
      return result.sort((a, b) => a.date.localeCompare(b.date));
    },
    enabled: !!doadoraId
  });

  // Don't render if less than 2 data points
  if (!trendData || trendData.length < 2) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <Brain className="w-4 h-4 text-primary" />
          </div>
          <h3 className="text-sm font-semibold">Tendência de Scores</h3>
        </div>
        <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground">
          Carregando...
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
          <Brain className="w-4 h-4 text-primary" />
        </div>
        <h3 className="text-sm font-semibold">Tendência de Scores</h3>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={trendData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
          <XAxis
            dataKey="displayDate"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={{ stroke: 'hsl(var(--border))' }}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={{ stroke: 'hsl(var(--border))' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '12px'
            }}
            labelStyle={{ fontWeight: 600, marginBottom: '4px' }}
            formatter={(value: number) => [`${value.toFixed(1)}`, '']}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#22c55e"
            strokeWidth={2.5}
            dot={{ fill: '#22c55e', r: 4 }}
            activeDot={{ r: 6 }}
            name="Score Geral"
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="flex items-center justify-center gap-4 mt-3">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-primary" />
          <span className="text-xs text-muted-foreground">Score Geral</span>
        </div>
      </div>
    </div>
  );
}
