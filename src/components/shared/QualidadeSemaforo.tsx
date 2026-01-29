import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Check, X } from 'lucide-react';
import { cn, getQualidadeColor } from '@/lib/utils';

interface QualidadeSemaforoProps {
  value: 1 | 2 | 3 | null | undefined;
  onChange?: (value: 1 | 2 | 3 | null) => void;
  disabled?: boolean;
  variant?: 'single' | 'row';
}

export default function QualidadeSemaforo({
  value,
  onChange,
  disabled = false,
  variant = 'single'
}: QualidadeSemaforoProps) {
  const isEditable = variant === 'row' && onChange && !disabled;

  // Renderizar uma única bolinha
  const renderSingleDot = (num: 1 | 2 | 3, isSelected: boolean) => (
    <div
      className={cn(
        'w-6 h-6 rounded-full border-2 transition-all',
        getQualidadeColor(num),
        isSelected ? 'border-foreground scale-110' : 'border-border',
        isEditable && !disabled && 'cursor-pointer hover:scale-125'
      )}
      onClick={() => isEditable && onChange?.(num)}
      title={`Qualidade ${num}`}
    />
  );

  // Display mode (single) - mostra só a bolinha correspondente
  if (variant === 'single') {
    if (!value) {
      return <span className="text-muted-foreground/50 text-xs">—</span>;
    }
    return (
      <div className="flex items-center gap-1.5">
        <div
          className={cn(
            'w-4 h-4 rounded-full border-2',
            getQualidadeColor(value),
            'border-border'
          )}
          title={`Qualidade ${value}`}
        />
      </div>
    );
  }

  // Row mode (editable) - mostra 3 bolinhas clicáveis
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-3 min-w-[90px]"
          disabled={disabled}
        >
          <div className="flex items-center gap-1">
            {value ? (
              <>
                {renderSingleDot(value, false)}
                <span className="text-sm text-foreground ml-1">{value}</span>
              </>
            ) : (
              <span className="text-muted-foreground text-sm">Selecionar</span>
            )}
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start" sideOffset={4}>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            {([1, 2, 3] as const).map((num) => (
              <button
                key={num}
                type="button"
                className={cn(
                  'flex items-center gap-2 p-2 rounded-md transition-all',
                  'hover:bg-muted',
                  value === num && 'bg-muted'
                )}
                onClick={() => onChange!(num)}
                disabled={disabled}
              >
                {renderSingleDot(num, value === num)}
                <span className="text-sm text-foreground">{num}</span>
                {value === num && <Check className="w-4 h-4 text-primary" />}
              </button>
            ))}
          </div>
          {value && (
            <Button
              variant="ghost"
              size="sm"
              className="justify-start text-muted-foreground"
              onClick={() => onChange!(null)}
              disabled={disabled}
            >
              <X className="w-4 h-4 mr-2" />
              Limpar
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
