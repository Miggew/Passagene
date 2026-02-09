/**
 * Feedback do biólogo sobre o score da IA.
 *
 * O biólogo pode concordar/discordar e anotar observações.
 * Salva biologo_concorda (boolean) e biologo_nota (text) na embryo_scores.
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { ThumbsUp, ThumbsDown, MessageSquare, Loader2, Check } from 'lucide-react';
import type { EmbryoScore } from '@/lib/types';

interface BiologistFeedbackProps {
  score: EmbryoScore;
}

export function BiologistFeedback({ score }: BiologistFeedbackProps) {
  const queryClient = useQueryClient();
  const [showNota, setShowNota] = useState(false);
  const [nota, setNota] = useState(score.biologo_nota || '');

  const mutation = useMutation({
    mutationFn: async ({ concorda, notaText }: { concorda: boolean; notaText?: string }) => {
      const { error } = await supabase
        .from('embryo_scores')
        .update({
          biologo_concorda: concorda,
          biologo_nota: notaText || null,
        })
        .eq('id', score.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['embryo-score'] });
      queryClient.invalidateQueries({ queryKey: ['embryo-scores-batch'] });
      queryClient.invalidateQueries({ queryKey: ['acasalamento-scores'] });
      setShowNota(false);
    },
  });

  const handleConcordar = () => {
    mutation.mutate({ concorda: true, notaText: nota || undefined });
  };

  const handleDiscordar = () => {
    if (!showNota) {
      setShowNota(true);
      return;
    }
    mutation.mutate({ concorda: false, notaText: nota || undefined });
  };

  const handleSaveNota = () => {
    mutation.mutate({
      concorda: score.biologo_concorda ?? true,
      notaText: nota || undefined,
    });
  };

  // Se já deu feedback, mostrar estado salvo
  if (score.biologo_concorda != null && !showNota) {
    return (
      <div className="flex items-center gap-2 pt-2 border-t border-border/30">
        {score.biologo_concorda ? (
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
            <ThumbsUp className="w-3 h-3" />
            <span>Biólogo concordou</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
            <ThumbsDown className="w-3 h-3" />
            <span>Biólogo discordou</span>
          </div>
        )}
        {score.biologo_nota && (
          <span className="text-[10px] text-muted-foreground italic truncate max-w-[200px]" title={score.biologo_nota}>
            — {score.biologo_nota}
          </span>
        )}
        <button
          onClick={() => setShowNota(true)}
          className="ml-auto text-[10px] text-muted-foreground hover:text-foreground underline"
        >
          Editar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 pt-2 border-t border-border/30">
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground">Você concorda com esta análise?</span>
        <div className="flex items-center gap-1 ml-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleConcordar}
            disabled={mutation.isPending}
            className="h-7 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
          >
            {mutation.isPending && score.biologo_concorda === true ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ThumbsUp className="w-3.5 h-3.5" />
            )}
            <span className="ml-1 text-[11px]">Sim</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDiscordar}
            disabled={mutation.isPending}
            className="h-7 px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
          >
            {mutation.isPending && score.biologo_concorda === false ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ThumbsDown className="w-3.5 h-3.5" />
            )}
            <span className="ml-1 text-[11px]">Não</span>
          </Button>
        </div>
      </div>

      {showNota && (
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <MessageSquare className="w-3.5 h-3.5 text-muted-foreground mt-1.5 shrink-0" />
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Observações (opcional)..."
              rows={2}
              className="flex-1 text-xs bg-background border border-border rounded-md px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowNota(false)}
              className="h-7 px-2 text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={score.biologo_concorda == null ? handleDiscordar : handleSaveNota}
              disabled={mutation.isPending}
              className="h-7 px-3 text-xs bg-primary hover:bg-primary-dark"
            >
              {mutation.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
              ) : (
                <Check className="w-3 h-3 mr-1" />
              )}
              Salvar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
