import { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { AnimalRecord } from '@/lib/types/escritorio';

interface AnimalAutocompleteProps {
  animals: AnimalRecord[];
  value: string;
  onChange: (value: string, animal?: AnimalRecord) => void;
  onTab?: () => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export default function AnimalAutocomplete({
  animals,
  value,
  onChange,
  onTab,
  placeholder = 'Registro...',
  className,
  autoFocus,
}: AnimalAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = value.length >= 2
    ? animals.filter(a => {
        const q = value.toUpperCase();
        return a.registro.toUpperCase().includes(q) ||
               (a.nome && a.nome.toUpperCase().includes(q));
      }).slice(0, 8)
    : [];

  const showDropdown = open && filtered.length > 0;

  const selectAnimal = useCallback((animal: AnimalRecord) => {
    onChange(animal.registro, animal);
    setOpen(false);
    onTab?.();
  }, [onChange, onTab]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) {
      if (e.key === 'Tab') {
        onTab?.();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlighted(h => Math.min(h + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlighted(h => Math.max(h - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filtered[highlighted]) {
          selectAnimal(filtered[highlighted]);
        }
        break;
      case 'Escape':
        setOpen(false);
        break;
      case 'Tab':
        if (filtered[highlighted]) {
          selectAnimal(filtered[highlighted]);
        }
        e.preventDefault();
        onTab?.();
        break;
    }
  };

  useEffect(() => {
    setHighlighted(0);
  }, [value]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (showDropdown && listRef.current) {
      const el = listRef.current.children[highlighted] as HTMLElement;
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlighted, showDropdown]);

  return (
    <div className={cn('relative', className)}>
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="h-8 text-sm"
      />
      {showDropdown && (
        <div
          ref={listRef}
          className="absolute z-50 top-full left-0 right-0 mt-1 max-h-48 overflow-auto rounded-md border border-border bg-popover shadow-md"
        >
          {filtered.map((animal, i) => (
            <button
              key={animal.id}
              onMouseDown={(e) => { e.preventDefault(); selectAnimal(animal); }}
              className={cn(
                'w-full text-left px-3 py-2 text-sm transition-colors',
                i === highlighted ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
              )}
            >
              <span className="font-medium">{animal.registro}</span>
              {animal.nome && (
                <span className="text-muted-foreground ml-2">{animal.nome}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
