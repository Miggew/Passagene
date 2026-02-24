import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { X } from 'lucide-react';
import { cn, getQualidadeColor } from '@/lib/utils';

interface ClassificacoesCicloInlineProps {
  ciclandoValue: 'CL' | 'N' | null | undefined;
  qualidadeValue: 1 | 2 | 3 | null | undefined;
  onChangeCiclando: (value: 'CL' | 'N' | null) => void;
  onChangeQualidade: (value: 1 | 2 | 3 | null) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export default function ClassificacoesCicloInline({
  ciclandoValue,
  qualidadeValue,
  onChangeCiclando,
  onChangeQualidade,
  disabled = false,
  size = 'sm',
}: ClassificacoesCicloInlineProps) {
  const sizeClasses = size === 'sm' ? 'text-xs' : 'text-sm';
  const dotSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';

  return (
    <div className="flex flex-wrap items-center gap-3 text-foreground">
      {/* Ciclo (CL/N) */}
      <div className="flex items-center gap-2">
        <span className={cn('text-muted-foreground font-medium', sizeClasses)}>Ciclo:</span>
        <ToggleGroup
          type="single"
          value={ciclandoValue ?? ''}
          onValueChange={(value) => {
            if (!disabled) {
              if (value === 'CL' || value === 'N') {
                onChangeCiclando(value);
              } else {
                onChangeCiclando(null);
              }
            }
          }}
          disabled={disabled}
          className="gap-1"
        >
          <ToggleGroupItem
            value="CL"
            aria-label="CL"
            size="sm"
            variant="outline"
            className={cn(
              'h-7 px-2 text-xs',
              ciclandoValue === 'CL' && 'bg-primary/10 text-primary border-primary/30 data-[state=on]:bg-primary/10',
              disabled && 'opacity-60'
            )}
          >
            CL
          </ToggleGroupItem>
          <ToggleGroupItem
            value="N"
            aria-label="N"
            size="sm"
            variant="outline"
            className={cn(
              'h-7 px-2 text-xs',
              ciclandoValue === 'N' && 'bg-muted text-muted-foreground border-border data-[state=on]:bg-muted',
              disabled && 'opacity-60'
            )}
          >
            N
          </ToggleGroupItem>
        </ToggleGroup>
        {ciclandoValue && !disabled && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => onChangeCiclando(null)}
            type="button"
            aria-label="Limpar ciclando"
          >
            <X className="w-3 h-3" />
          </Button>
        )}
        {!ciclandoValue && (
          <span className={cn('text-muted-foreground/50', sizeClasses)}>—</span>
        )}
      </div>

      {/* Qualidade Semáforo */}
      <div className="flex items-center gap-2">
        <span className={cn('text-muted-foreground font-medium', sizeClasses)}>Qualidade:</span>
        <div className="flex items-center gap-1.5">
          {([1, 2, 3] as const).map((num) => (
            <button
              key={num}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (!disabled) {
                  onChangeQualidade(qualidadeValue === num ? null : num);
                }
              }}
              className={cn(
                dotSize,
                'rounded-full border-2 transition-all',
                getQualidadeColor(num),
                qualidadeValue === num
                  ? 'border-foreground scale-110 ring-2 ring-muted-foreground/30'
                  : 'border-muted-foreground/30 opacity-50 hover:opacity-75 hover:scale-105',
                disabled && 'opacity-40 cursor-not-allowed',
                !disabled && 'cursor-pointer'
              )}
              title={`Qualidade ${num}`}
            />
          ))}
        </div>
        {qualidadeValue && !disabled && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => onChangeQualidade(null)}
            type="button"
            aria-label="Limpar qualidade"
          >
            <X className="w-3 h-3" />
          </Button>
        )}
        {!qualidadeValue && (
          <span className={cn('text-muted-foreground/50', sizeClasses)}>—</span>
        )}
      </div>
    </div>
  );
}
