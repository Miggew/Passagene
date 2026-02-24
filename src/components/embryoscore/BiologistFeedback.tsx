/**
 * Feedback estruturado do biólogo sobre o score da IA.
 *
 * Permite ao biólogo:
 * - Atribuir seu próprio score (0-100) com quick buttons
 * - Marcar quais descrições morfológicas estão erradas (checkboxes)
 * - Corrigir o estágio do embrião
 * - Adicionar observações textuais
 *
 * biologo_concorda é derivado automaticamente: |biologo_score - ai_score| <= 10
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Check, ChevronRight, Pencil } from 'lucide-react';
import type { EmbryoScore } from '@/lib/types';

interface BiologistFeedbackProps {
  score: EmbryoScore;
}

const QUICK_SCORES = [0, 30, 50, 70] as const;

const ERRO_OPTIONS = [
  { id: 'MCI', label: 'MCI - Descrição errada' },
  { id: 'TE', label: 'TE - Descrição errada' },
  { id: 'ZP', label: 'ZP - Descrição errada' },
  { id: 'Fragmentação', label: 'Fragmentação - Descrição errada' },
  { id: 'Estágio', label: 'Estágio - Descrição errado' },
  { id: 'Reasoning', label: 'Reasoning geral errado' },
] as const;

const ESTAGIOS = [
  'Mórula compacta (Mc)',
  'Blastocisto inicial (Bi, código 5)',
  'Blastocisto (Bl, código 6)',
  'Blastocisto expandido (Bx, código 7)',
  'Blastocisto em eclosão (Bh, código 8)',
  'Blastocisto eclodido (Be, código 9)',
  'Degenerado',
] as const;

export function BiologistFeedback({ score }: BiologistFeedbackProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [biologoScore, setBiologoScore] = useState<number | ''>(score.biologo_score ?? '');
  const [nota, setNota] = useState(score.biologo_nota || '');
  const [erros, setErros] = useState<string[]>(score.biologo_descricao_erros || []);
  const [estagio, setEstagio] = useState(score.biologo_estagio || '');
  const [detailsOpen, setDetailsOpen] = useState(false);

  const aiScore = score.embryo_score;

  const mutation = useMutation({
    mutationFn: async (data: {
      biologo_score: number;
      biologo_nota: string | null;
      biologo_estagio: string | null;
      biologo_descricao_erros: string[] | null;
    }) => {
      const concorda = Math.abs(data.biologo_score - aiScore) <= 10;
      const { error } = await supabase
        .from('embryo_scores')
        .update({
          biologo_concorda: concorda,
          biologo_score: data.biologo_score,
          biologo_nota: data.biologo_nota,
          biologo_estagio: data.biologo_estagio,
          biologo_descricao_erros: data.biologo_descricao_erros,
          // V2 training columns — retroalimenta o Atlas KNN
          biologist_agreed: concorda,
          biologist_classification: score.knn_classification ?? null,
        })
        .eq('id', score.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['embryo-score'] });
      queryClient.invalidateQueries({ queryKey: ['embryo-scores-batch'] });
      queryClient.invalidateQueries({ queryKey: ['acasalamento-scores'] });
      setEditing(false);
    },
  });

  const handleSave = () => {
    if (biologoScore === '') return;
    mutation.mutate({
      biologo_score: biologoScore,
      biologo_nota: nota || null,
      biologo_estagio: estagio || null,
      biologo_descricao_erros: erros.length > 0 ? erros : null,
    });
  };

  const toggleErro = (erroId: string) => {
    setErros(prev =>
      prev.includes(erroId) ? prev.filter(e => e !== erroId) : [...prev, erroId]
    );
  };

  const handleQuickScore = (value: number) => {
    setBiologoScore(value);
  };

  // Estado salvo — mostrar resumo compacto
  if (score.biologo_score != null && !editing) {
    const concorda = Math.abs(score.biologo_score - aiScore) <= 10;
    return (
      <div className="flex items-start gap-2 pt-2 border-t border-border/30">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Check className={`w-3.5 h-3.5 shrink-0 ${concorda ? 'text-emerald-500' : 'text-amber-500'}`} />
            <span className="text-xs font-medium text-foreground">
              Biólogo: {score.biologo_score}/100
            </span>
            <span className="text-xs text-muted-foreground">
              (IA deu {aiScore})
            </span>
          </div>
          {(score.biologo_descricao_erros && score.biologo_descricao_erros.length > 0 || score.biologo_nota) && (
            <div className="mt-0.5 text-xs text-muted-foreground truncate">
              {score.biologo_descricao_erros && score.biologo_descricao_erros.length > 0 && (
                <span>Erros: {score.biologo_descricao_erros.join(', ')}</span>
              )}
              {score.biologo_nota && (
                <span className="italic"> — {score.biologo_nota}</span>
              )}
            </div>
          )}
        </div>
        <button
          onClick={() => setEditing(true)}
          className="shrink-0 text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5"
        >
          <Pencil className="w-3 h-3" />
          Editar
        </button>
      </div>
    );
  }

  // Formulário de feedback
  return (
    <div className="space-y-3 pt-2 border-t border-border/30">
      <div className="text-xs font-medium text-foreground">Avaliação do Biólogo</div>

      {/* Score input + quick buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={0}
            max={100}
            value={biologoScore}
            onChange={(e) => {
              const v = e.target.value;
              setBiologoScore(v === '' ? '' : Math.max(0, Math.min(100, Number(v))));
            }}
            placeholder="0-100"
            className="w-16 h-9 md:h-8 text-sm text-center bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
          <span className="text-xs text-muted-foreground">/100</span>
        </div>
        <div className="flex items-center gap-1">
          {QUICK_SCORES.map((qs) => (
            <button
              key={qs}
              type="button"
              onClick={() => handleQuickScore(qs)}
              className={`h-9 md:h-8 px-2.5 text-xs rounded-md border transition-colors ${
                biologoScore === qs
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
              }`}
            >
              {qs}
            </button>
          ))}
        </div>
      </div>

      {/* Correções detalhadas (collapsible) */}
      <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
        <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${detailsOpen ? 'rotate-90' : ''}`} />
          Correções detalhadas (opcional)
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 space-y-2.5">
          {/* Checkboxes de erros */}
          <div className="space-y-1.5 pl-1">
            {ERRO_OPTIONS.map((opt) => (
              <label key={opt.id} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={erros.includes(opt.id)}
                  onCheckedChange={() => toggleErro(opt.id)}
                />
                <span className="text-xs text-foreground">{opt.label}</span>
              </label>
            ))}
          </div>

          {/* Estágio correto — só aparece se marcou "Estágio" como erro */}
          {erros.includes('Estágio') && (
            <div className="pl-1">
              <label className="text-[11px] text-muted-foreground mb-1 block">Estágio correto:</label>
              <Select value={estagio} onValueChange={setEstagio}>
                <SelectTrigger className="h-9 md:h-8 text-xs">
                  <SelectValue placeholder="Selecione o estágio..." />
                </SelectTrigger>
                <SelectContent>
                  {ESTAGIOS.map((est) => (
                    <SelectItem key={est} value={est} className="text-xs">
                      {est}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Observações */}
      <textarea
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        placeholder="Observações (opcional)..."
        rows={2}
        className="w-full text-xs bg-background border border-border rounded-md px-2.5 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-primary/40"
      />

      {/* Ações */}
      <div className="flex justify-end gap-1.5">
        {(score.biologo_score != null || editing) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditing(false);
              setBiologoScore(score.biologo_score ?? '');
              setNota(score.biologo_nota || '');
              setErros(score.biologo_descricao_erros || []);
              setEstagio(score.biologo_estagio || '');
            }}
            className="h-9 md:h-8 px-3 text-xs"
          >
            Cancelar
          </Button>
        )}
        <Button
          size="sm"
          onClick={handleSave}
          disabled={mutation.isPending || biologoScore === ''}
          className="h-9 md:h-8 px-4 text-xs"
        >
          {mutation.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
          ) : (
            <Check className="w-3.5 h-3.5 mr-1" />
          )}
          Salvar
        </Button>
      </div>
    </div>
  );
}
