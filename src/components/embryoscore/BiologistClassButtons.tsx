/**
 * BiologistClassButtons — 7 botões de classificação (BE/BN/BX/BL/BI/Mo/Dg).
 *
 * A sugestão da IA é destacada com ring-primary/20.
 * Ao confirmar, chama onClassify(classification).
 * Botão "Desfazer" disponível se a classificação foi feita nos últimos 5 minutos.
 */

import { useState } from 'react';
import type { ClassificacaoEmbriao } from '@/lib/types';
import { Button } from '@/components/ui/mobile-atoms'; // DS v4
import { Check, Undo2, Sparkles } from 'lucide-react';

const CLASSES: { value: ClassificacaoEmbriao; label: string; description: string }[] = [
  { value: 'BE', label: 'BE', description: 'Excelente' },
  { value: 'BN', label: 'BN', description: 'Bom' },
  { value: 'BX', label: 'BX', description: 'Regular' },
  { value: 'BL', label: 'BL', description: 'Blasto' },
  { value: 'BI', label: 'BI', description: 'Inicial' },
  { value: 'Mo', label: 'Mo', description: 'Mórula' },
  { value: 'Dg', label: 'Dg', description: 'Degenerado' },
];

interface BiologistClassButtonsProps {
  aiSuggestion?: string | null;
  currentClassification?: string | null;
  onClassify: (classification: ClassificacaoEmbriao) => void;
  onUndo?: () => void;
  canUndo?: boolean;
  isLoading?: boolean;
}

export function BiologistClassButtons({
  aiSuggestion,
  currentClassification,
  onClassify,
  onUndo,
  canUndo,
  isLoading,
}: BiologistClassButtonsProps) {
  const [selected, setSelected] = useState<ClassificacaoEmbriao | null>(null);
  const isConfirmed = !!currentClassification;

  const handleSelect = (cls: ClassificacaoEmbriao) => {
    if (isConfirmed || isLoading) return;
    setSelected(cls);
  };

  const handleConfirm = () => {
    if (!selected || isLoading) return;
    onClassify(selected);
    setSelected(null);
  };

  if (isConfirmed) {
    return (
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-primary/10 border border-primary/20 shadow-glow">
          <Check className="w-4 h-4 text-primary" />
          <span className="font-display font-black text-xl text-primary tracking-tightest">{currentClassification}</span>
        </div>
        {canUndo && onUndo && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onUndo}
            disabled={isLoading}
            className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            <Undo2 className="w-3.5 h-3.5 mr-1.5" />
            Desfazer
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Classification grid */}
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
        {CLASSES.map((cls) => {
          const isAiSuggestion = aiSuggestion === cls.value;
          const isSelected = selected === cls.value;

          return (
            <button
              key={cls.value}
              onClick={() => handleSelect(cls.value)}
              disabled={isLoading}
              className={`
                relative flex flex-col items-center justify-center rounded-xl p-3 h-auto
                border transition-all duration-300 disabled:opacity-50 active:scale-95
                ${isSelected
                  ? 'border-primary bg-primary/20 shadow-glow'
                  : isAiSuggestion
                    ? 'border-primary/40 bg-primary/5 shadow-[inset_0_0_12px_rgba(52,211,153,0.1)]'
                    : 'border-border/50 bg-muted/20 hover:border-primary/30 hover:bg-muted/40'
                }
              `}
            >
              <span className={`font-display font-black text-lg tracking-tightest ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                {cls.label}
              </span>
              <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-muted-foreground mt-1">{cls.description}</span>
              
              {isAiSuggestion && !isSelected && (
                <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center shadow-lg animate-bounce">
                  <Sparkles className="w-2.5 h-2.5 text-black" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Confirm action */}
      {selected && (
        <Button 
          onClick={handleConfirm} 
          loading={isLoading} 
          fullWidth
          size="lg"
          className="shadow-glow shadow-primary/30 h-14 rounded-xl"
        >
          <Check className="w-5 h-5 mr-2" />
          Confirmar {selected} → Próximo
        </Button>
      )}
    </div>
  );
}
