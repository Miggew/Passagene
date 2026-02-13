/**
 * BiologistClassButtons — 7 botões de classificação (BE/BN/BX/BL/BI/Mo/Dg).
 *
 * A sugestão da IA é destacada com ring-primary/20.
 * Ao confirmar, chama onClassify(classification).
 * Botão "Desfazer" disponível se a classificação foi feita nos últimos 5 minutos.
 */

import { useState } from 'react';
import type { ClassificacaoEmbriao } from '@/lib/types';
import { Check, Undo2 } from 'lucide-react';

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
  /** Sugestão da IA (combined_classification) */
  aiSuggestion?: string | null;
  /** Classificação já confirmada pelo biólogo */
  currentClassification?: string | null;
  /** Callback ao classificar */
  onClassify: (classification: ClassificacaoEmbriao) => void;
  /** Callback ao desfazer */
  onUndo?: () => void;
  /** Se pode desfazer (dentro de 5 min) */
  canUndo?: boolean;
  /** Se mutation está em progresso */
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

  // Already classified — show result + undo
  if (isConfirmed) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
          <Check className="w-4 h-4 text-primary" />
          <span className="font-mono text-lg font-bold text-primary">{currentClassification}</span>
        </div>
        {canUndo && onUndo && (
          <button
            onClick={onUndo}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
          >
            <Undo2 className="w-3.5 h-3.5" />
            Desfazer
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Classification buttons */}
      <div className="flex flex-wrap gap-2">
        {CLASSES.map((cls) => {
          const isAiSuggestion = aiSuggestion === cls.value;
          const isSelected = selected === cls.value;

          return (
            <button
              key={cls.value}
              onClick={() => handleSelect(cls.value)}
              disabled={isLoading}
              className={`
                relative flex flex-col items-center justify-center rounded-lg p-3 h-auto min-w-[60px]
                border transition-all duration-150 disabled:opacity-50
                ${isSelected
                  ? 'border-primary bg-primary/15 shadow-sm shadow-primary/25'
                  : isAiSuggestion
                    ? 'border-primary/30 bg-primary/5 ring-1 ring-primary/20'
                    : 'border-border bg-card hover:border-primary/20 hover:bg-muted/40'
                }
              `}
            >
              <span className={`font-mono text-lg font-bold ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                {cls.label}
              </span>
              <span className="text-[10px] text-muted-foreground mt-0.5">{cls.description}</span>
              {isAiSuggestion && (
                <span className="absolute -top-1.5 -right-1.5 text-[9px] bg-primary/15 text-primary px-1 rounded-full">
                  IA
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Confirm button */}
      {selected && (
        <button
          onClick={handleConfirm}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary-dark text-white font-medium text-sm shadow-sm shadow-primary/25 transition-colors disabled:opacity-50"
        >
          <Check className="w-4 h-4" />
          Confirmar {selected} → próximo
        </button>
      )}
    </div>
  );
}
