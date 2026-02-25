import { useState, useMemo } from 'react';
import { Touro } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TouroComboboxProps {
  touros: Touro[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

export function TouroCombobox({ touros, value, onValueChange, placeholder = 'Buscar touro...' }: TouroComboboxProps) {
  const [open, setOpen] = useState(false);

  const selected = touros.find((t) => t.id === value);

  const grouped = useMemo(() => {
    const groups: Record<string, Touro[]> = {};
    for (const t of touros) {
      const key = t.raca || 'Outros';
      (groups[key] ??= []).push(t);
    }
    // Sort groups: named raças first, "Outros" last
    return Object.entries(groups).sort(([a], [b]) => {
      if (a === 'Outros') return 1;
      if (b === 'Outros') return -1;
      return a.localeCompare(b);
    });
  }, [touros]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal h-11 md:h-9"
        >
          {selected ? (
            <span className="truncate">
              {selected.nome}
              {selected.registro && <span className="text-muted-foreground ml-1">({selected.registro})</span>}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Nome, registro ou raça..." />
          <CommandList className="max-h-[50vh]">
            <CommandEmpty>Nenhum touro encontrado.</CommandEmpty>
            {grouped.map(([raca, items]) => (
              <CommandGroup key={raca} heading={raca}>
                {items.map((touro) => (
                  <CommandItem
                    key={touro.id}
                    value={`${touro.nome} ${touro.registro || ''} ${touro.raca || ''}`}
                    onSelect={() => {
                      onValueChange(touro.id);
                      setOpen(false);
                    }}
                    className="min-h-[44px] md:min-h-0"
                  >
                    <Check
                      className={cn('mr-2 h-4 w-4 shrink-0', value === touro.id ? 'opacity-100' : 'opacity-0')}
                    />
                    <span className="truncate">
                      {touro.nome}
                      {touro.registro && <span className="text-muted-foreground ml-1">({touro.registro})</span>}
                    </span>
                    {touro.raca && (
                      <Badge variant="outline" className="ml-auto text-[10px] shrink-0">
                        {touro.raca}
                      </Badge>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
