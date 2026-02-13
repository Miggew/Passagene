/**
 * Dashboard AI do Cliente — Resumo Diário do Gene
 */

import { Sparkles, RefreshCw, Loader2 } from 'lucide-react';
import { useDailySummary } from '@/hooks/cliente/useDailySummary';
import { useClientePreferences } from '@/hooks/cliente/useClientePreferences';

interface Props {
  clienteId: string;
  clienteNome?: string;
}

function formatDateBR(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}/${m}/${date.getFullYear()}`;
}

export default function HomeDashboardClienteAI({ clienteId, clienteNome }: Props) {
  const { data, isLoading, isFetching, error, regenerate } = useDailySummary(clienteId, clienteNome);
  const { preferences } = useClientePreferences(clienteId);

  const isLargeFont = preferences?.font_size === 'grande';
  const textSize = isLargeFont ? 'text-xl' : 'text-[17px]';
  const hoje = new Date();

  // Texto a exibir
  const hasError = !!error && !data?.summary;
  const showLoading = isLoading || (isFetching && !data?.summary);

  const errorText = 'Hoje não consegui preparar seu resumo. Mas fique tranquilo, amanhã volto com as novidades! 🐄';
  const summaryText = hasError ? errorText : (data?.summary || '');

  // Separar por qualquer quebra de linha (simples ou dupla)
  const paragraphs = summaryText
    .split(/\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  return (
    <div className="flex flex-col gap-3 flex-1">
      {/* Header Gene */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/20 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-base font-display font-bold tracking-tight text-foreground">Gene</p>
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">Seu resumo de hoje</p>
        </div>
        <p className="text-[11px] font-mono text-muted-foreground mr-1 opacity-70">{formatDateBR(hoje)}</p>
        <button
          onClick={regenerate}
          disabled={isFetching}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted/50 transition-all active:scale-95 disabled:opacity-40"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Card do resumo */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm flex-1 overflow-y-auto">
        {showLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Gene está preparando seu resumo...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {paragraphs.map((p, i) => (
              <p key={i} className={`${textSize} leading-relaxed text-foreground`}>
                {p}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
