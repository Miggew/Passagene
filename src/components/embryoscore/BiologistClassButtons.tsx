/**
 * BiologistClassButtons — 7 botões de classificação (BE/BN/BX/BL/BI/Mo/Dg).
 *
 * A sugestão da IA é destacada com ring-primary/20.
 * Ao confirmar, chama onClassify(classification).
 * Botão "Desfazer" disponível se a classificação foi feita nos últimos 5 minutos.
 * Hotkeys: 1-7 para selecionar, Enter para confirmar, Delete/Backspace para Dg.
 */

import type { ClassificacaoEmbriao } from '@/lib/types';
import { Button } from '@/components/ui/mobile-atoms'; // DS v4
import { Check, Undo2, Sparkles } from 'lucide-react';

export const CLASSES: { value: ClassificacaoEmbriao; label: string; description: string }[] = [
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
  /** Selected class (controlled from parent for hotkey support) */
  selected: ClassificacaoEmbriao | null;
  /** Selection change callback */
  onSelect: (cls: ClassificacaoEmbriao | null) => void;
}

export function BiologistClassButtons({
  aiSuggestion,
  currentClassification,
  onClassify,
  onUndo,
  canUndo,
  isLoading,
  selected,
  onSelect,
}: BiologistClassButtonsProps) {
  const isConfirmed = !!currentClassification;

  const handleSelect = (cls: ClassificacaoEmbriao) => {
    if (isConfirmed || isLoading) return;
    onSelect(cls);
  };

  const handleConfirm = () => {
    if (!selected || isLoading) return;
    onClassify(selected);
    onSelect(null);
  };

  if (isConfirmed) {
    return (
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-primary/10 border border-primary/20">
          <Check className="w-4 h-4 text-primary" />
          <span className="font-display font-black text-xl text-primary tracking-tightest">{currentClassification}</span>
        </div>
        {canUndo && onUndo && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onUndo}
            disabled={isLoading}
            className="text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground"
          >
            <Undo2 className="w-3.5 h-3.5 mr-1.5" />
            Desfazer
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Classification buttons */}
      <div className="flex flex-wrap gap-2">
        {CLASSES.map((cls, idx) => {
          const isAiSuggestion = aiSuggestion === cls.value;
          const isSelected = selected === cls.value;
          const hotkeyLabel = cls.value === 'Dg' ? 'Del' : String(idx + 1);

          return (
            <button
              key={cls.value}
              onClick={() => handleSelect(cls.value)}
              disabled={isLoading}
              className={`
                relative flex flex-col items-center justify-center rounded-xl p-3 h-auto
                border transition-all duration-300 disabled:opacity-50 active:scale-95
                ${isSelected
                  ? 'border-primary bg-primary/20'
                  : isAiSuggestion
                    ? 'border-primary/30 bg-primary/5 ring-1 ring-primary/20'
                    : 'border-border glass-panel hover:border-primary/20 hover:bg-muted/40'
                }
              `}
            >
              <span className={`font-display font-black text-lg tracking-tightest ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                {cls.label}
              </span>
              <span className="text-[10px] text-muted-foreground mt-0.5">{cls.description}</span>
              <kbd className="mt-1 text-[9px] font-mono text-muted-foreground/60 bg-muted/60 px-1 rounded">
                {hotkeyLabel}
              </kbd>
              {isAiSuggestion && (
                <span className="absolute -top-1.5 -right-1.5 text-[9px] bg-primary/15 text-primary px-1 rounded-full">
                  IA
                </span>
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
          className="h-14 rounded-xl"
        >
          <Check className="w-4 h-4" />
          Confirmar {selected} → próximo
          <kbd className="ml-1 text-[10px] font-mono text-white/60 bg-white/10 px-1 rounded">Enter</kbd>
        </Button>
      )}
    </div>
  );
}
