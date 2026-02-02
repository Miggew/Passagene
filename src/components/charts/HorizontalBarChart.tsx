import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BarDataItem {
  nome: string;
  valor: number;
  valorAnterior?: number;
  delta?: number;
  meta?: number;
}

interface HorizontalBarChartProps {
  title: string;
  description?: string;
  data: BarDataItem[];
  loading?: boolean;
  showDelta?: boolean;
  showMeta?: boolean;
  metaValue?: number;
  barColor?: string;
  maxItems?: number;
  formatValue?: (value: number) => string;
  onItemClick?: (item: BarDataItem) => void;
}

export function HorizontalBarChart({
  title,
  description,
  data,
  loading,
  showDelta = false,
  showMeta = false,
  metaValue = 50,
  barColor = 'hsl(var(--primary))',
  maxItems = 10,
  formatValue = (v) => `${v.toFixed(1)}%`,
  onItemClick,
}: HorizontalBarChartProps) {
  const displayData = data.slice(0, maxItems);

  const getBarColor = (value: number) => {
    if (!showMeta) return barColor;
    if (value >= metaValue) return 'hsl(142, 76%, 36%)'; // emerald-600
    if (value >= metaValue * 0.8) return 'hsl(45, 93%, 47%)'; // amber-500
    return 'hsl(0, 84%, 60%)'; // red-500
  };

  const getDeltaIcon = (delta: number) => {
    if (delta > 0.5) return <TrendingUp className="w-3.5 h-3.5" />;
    if (delta < -0.5) return <TrendingDown className="w-3.5 h-3.5" />;
    return <Minus className="w-3.5 h-3.5" />;
  };

  const getDeltaColor = (delta: number) => {
    if (delta > 0.5) return 'text-emerald-600 dark:text-emerald-400';
    if (delta < -0.5) return 'text-rose-600 dark:text-rose-400';
    return 'text-muted-foreground';
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const item = payload[0].payload as BarDataItem;

    return (
      <div className="bg-popover border border-border rounded-lg shadow-lg p-3 min-w-[180px]">
        <p className="font-medium text-sm text-foreground mb-2">{item.nome}</p>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Atual:</span>
            <span className="font-medium text-foreground">{formatValue(item.valor)}</span>
          </div>
          {item.valorAnterior !== undefined && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Anterior:</span>
              <span className="text-muted-foreground">{formatValue(item.valorAnterior)}</span>
            </div>
          )}
          {item.delta !== undefined && (
            <div className="flex items-center justify-between text-sm pt-1 border-t border-border">
              <span className="text-muted-foreground">Variação:</span>
              <span className={cn('font-medium', getDeltaColor(item.delta))}>
                {item.delta > 0 ? '+' : ''}{item.delta.toFixed(1)} pp
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-24 h-4 bg-muted animate-pulse rounded" />
                <div className="flex-1 h-6 bg-muted animate-pulse rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center">
            <div className="text-muted-foreground">Sem dados para exibir</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Altura dinâmica baseada no número de itens
  const chartHeight = Math.max(200, displayData.length * 40 + 20);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={displayData}
              layout="vertical"
              margin={{ top: 0, right: 60, left: 0, bottom: 0 }}
            >
              <XAxis
                type="number"
                domain={[0, 100]}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <YAxis
                type="category"
                dataKey="nome"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={100}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }} />

              {/* Linha de meta */}
              {showMeta && (
                <defs>
                  <line
                    id="metaLine"
                    x1={`${metaValue}%`}
                    y1="0%"
                    x2={`${metaValue}%`}
                    y2="100%"
                    stroke="hsl(var(--muted-foreground))"
                    strokeDasharray="4 4"
                    strokeWidth={1}
                  />
                </defs>
              )}

              <Bar
                dataKey="valor"
                radius={[0, 4, 4, 0]}
                cursor={onItemClick ? 'pointer' : 'default'}
                onClick={(data) => onItemClick?.(data)}
              >
                {displayData.map((entry, index) => (
                  <Cell key={index} fill={getBarColor(entry.valor)} />
                ))}
                <LabelList
                  dataKey="valor"
                  position="right"
                  formatter={(v: number) => formatValue(v)}
                  className="text-xs fill-foreground font-medium"
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legenda com deltas */}
        {showDelta && displayData.some((d) => d.delta !== undefined) && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="grid grid-cols-2 gap-2">
              {displayData.slice(0, 6).map((item, index) => (
                <div key={index} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground truncate pr-2">{item.nome}</span>
                  {item.delta !== undefined && (
                    <div className={cn('flex items-center gap-1 shrink-0', getDeltaColor(item.delta))}>
                      {getDeltaIcon(item.delta)}
                      <span>{item.delta > 0 ? '+' : ''}{item.delta.toFixed(1)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default HorizontalBarChart;
