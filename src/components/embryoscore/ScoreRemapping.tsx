/**
 * Remapeamento manual de scores para embriões.
 *
 * Quando a IA detecta N embriões diferente de M no banco,
 * o biólogo pode remapear manualmente qual score pertence a qual embrião.
 *
 * Interface: lista de scores com select dropdown para vincular a embriões disponíveis.
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowRightLeft, Save, Loader2, AlertTriangle, Check } from 'lucide-react';
import { getScoreColor } from './EmbryoScoreBadge';
import type { EmbryoScore } from '@/lib/types';

interface EmbriaoOption {
  id: string;
  identificacao: string;
}

interface ScoreRemappingProps {
  scores: EmbryoScore[];
  embrioes: EmbriaoOption[];
  onClose: () => void;
}

export function ScoreRemapping({ scores, embrioes, onClose }: ScoreRemappingProps) {
  const queryClient = useQueryClient();

  // Mapeamento: score_id → embriao_id
  const [mapping, setMapping] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const score of scores) {
      initial[score.id] = score.embriao_id;
    }
    return initial;
  });

  const hasChanges = scores.some(s => mapping[s.id] !== s.embriao_id);

  // Verificar se há IDs duplicados (dois scores para o mesmo embrião)
  const hasDuplicates = (() => {
    const values = Object.values(mapping).filter(Boolean);
    return new Set(values).size !== values.length;
  })();

  const mutation = useMutation({
    mutationFn: async () => {
      const updates = scores
        .filter(s => mapping[s.id] !== s.embriao_id)
        .map(s => ({
          scoreId: s.id,
          newEmbriaoId: mapping[s.id],
        }));

      for (const update of updates) {
        const { error } = await supabase
          .from('embryo_scores')
          .update({ embriao_id: update.newEmbriaoId })
          .eq('id', update.scoreId);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['embryo-score'] });
      queryClient.invalidateQueries({ queryKey: ['embryo-scores-batch'] });
      queryClient.invalidateQueries({ queryKey: ['acasalamento-scores'] });
      onClose();
    },
  });

  const countMismatch = scores.length !== embrioes.length;

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-muted/60 to-transparent border-b border-border/50">
        <div className="w-1 h-5 rounded-full bg-amber-500/50" />
        <ArrowRightLeft className="w-4 h-4 text-amber-600 dark:text-amber-400" />
        <span className="text-sm font-semibold text-foreground">Remapear Scores</span>
      </div>

      <div className="p-4 space-y-4">
        {/* Aviso de contagem diferente */}
        {countMismatch && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700 dark:text-amber-300">
              A IA detectou <strong>{scores.length}</strong> embrião(ões), mas há{' '}
              <strong>{embrioes.length}</strong> no banco. Remapeie manualmente abaixo.
            </p>
          </div>
        )}

        {/* Lista de scores → embriões */}
        <div className="space-y-2">
          {scores.map((score, index) => {
            const colors = getScoreColor(score.embryo_score);
            return (
              <div key={score.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/20">
                {/* Score info */}
                <div className="flex items-center gap-2 shrink-0 w-32">
                  <div className={`w-8 h-8 rounded ${colors.bg} flex items-center justify-center`}>
                    <span className={`text-xs font-bold ${colors.text}`}>
                      {Math.round(score.embryo_score)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className={`text-xs font-medium ${colors.text}`}>{score.classification}</div>
                    <div className="text-xs text-muted-foreground">
                      {score.position_description || `Embrião ${index + 1}`}
                    </div>
                  </div>
                </div>

                {/* Arrow */}
                <ArrowRightLeft className="w-3.5 h-3.5 text-muted-foreground shrink-0" />

                {/* Select embrião */}
                <Select
                  value={mapping[score.id] || ''}
                  onValueChange={(val) =>
                    setMapping(prev => ({ ...prev, [score.id]: val }))
                  }
                >
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue placeholder="Selecionar embrião..." />
                  </SelectTrigger>
                  <SelectContent>
                    {embrioes.map(e => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.identificacao || 'Sem código'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>

        {/* Aviso de duplicatas */}
        {hasDuplicates && (
          <p className="text-[11px] text-red-600 dark:text-red-400">
            Dois ou mais scores estão atribuídos ao mesmo embrião. Corrija antes de salvar.
          </p>
        )}

        {/* Ações */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/30">
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 text-xs">
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={() => mutation.mutate()}
            disabled={!hasChanges || hasDuplicates || mutation.isPending}
            className="h-8 text-xs bg-primary hover:bg-primary-dark"
          >
            {mutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
            ) : mutation.isSuccess ? (
              <Check className="w-3.5 h-3.5 mr-1" />
            ) : (
              <Save className="w-3.5 h-3.5 mr-1" />
            )}
            Salvar mapeamento
          </Button>
        </div>
      </div>
    </div>
  );
}
