/**
 * Card de ranking de embriões para transferência.
 * Mobile-first: cards empilhados com medalhas para top 3.
 */

import { useMemo } from 'react';
import type { EmbryoScore, Embriao } from '@/lib/types';
import { getScoreColor } from './EmbryoScoreBadge';
import { Trophy, Medal, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface TransferRankingCardProps {
  scores: EmbryoScore[];
  embrioes?: Embriao[];
}

const MEDAL_COLORS = ['text-amber-500', 'text-gray-400', 'text-amber-700'];
const MEDAL_BG = ['bg-amber-500/15', 'bg-gray-400/15', 'bg-amber-700/15'];

export function TransferRankingCard({ scores, embrioes = [] }: TransferRankingCardProps) {
  const { toast } = useToast();

  const ranked = useMemo(() => {
    return [...scores]
      .filter(s => s.embriao_id)
      .sort((a, b) => b.embryo_score - a.embryo_score)
      .map((score, index) => {
        const embriao = embrioes.find(e => e.id === score.embriao_id);
        return { score, embriao, rank: index + 1 };
      });
  }, [scores, embrioes]);

  const handleCopyRanking = () => {
    const text = ranked
      .map(r => `#${r.rank} ${r.embriao?.identificacao || r.score.embriao_id} — Score: ${r.score.embryo_score} (${r.score.classification})`)
      .join('\n');
    navigator.clipboard.writeText(text);
    toast({ title: 'Ranking copiado', description: `${ranked.length} embriões` });
  };

  if (ranked.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-muted/80 via-muted/60 to-muted/80 border-b border-border">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-semibold">Ranking de Transferência</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={handleCopyRanking} className="h-8">
          <Copy className="w-3.5 h-3.5 mr-1" />
          <span className="text-xs">Copiar</span>
        </Button>
      </div>

      {/* List */}
      <div className="divide-y divide-border/50">
        {ranked.map(({ score, embriao, rank }) => (
          <div
            key={score.id}
            className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
          >
            {/* Position */}
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold
              ${rank <= 3 ? MEDAL_BG[rank - 1] : 'bg-muted/50'}`}
            >
              {rank <= 3 ? (
                <Medal className={`w-4 h-4 ${MEDAL_COLORS[rank - 1]}`} />
              ) : (
                <span className="text-muted-foreground">{rank}</span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium truncate block">
                {embriao?.identificacao || `Embrião ${score.embriao_id.substring(0, 8)}`}
              </span>
              <span className="text-xs text-muted-foreground">
                {score.stage || score.classification}
                {embriao?.classificacao && ` · ${embriao.classificacao}`}
              </span>
            </div>

            {/* Score */}
            <div className="text-right">
              <div className={`text-lg font-bold ${getScoreColor(score.embryo_score)}`}>
                {score.embryo_score}
              </div>
              <span className="text-xs text-muted-foreground">
                {score.transfer_recommendation === 'priority' ? 'Prioridade' :
                 score.transfer_recommendation === 'recommended' ? 'Recomendado' :
                 score.transfer_recommendation === 'conditional' ? 'Condicional' :
                 score.transfer_recommendation === 'second_opinion' ? '2ª Opinião' : 'Descartar'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
