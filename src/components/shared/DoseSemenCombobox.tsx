import { useState, useMemo } from 'react';
import { DoseSemenComTouro, Cliente } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DoseSemenComboboxProps {
  doses: DoseSemenComTouro[];
  clientes: Cliente[];
  value: string;
  onValueChange: (value: string) => void;
  /** IDs of doses already used in this lote (shown in "Usados neste lote" section) */
  recentDoseIds?: string[];
  placeholder?: string;
}

interface DoseGroup {
  touroNome: string;
  touroRegistro?: string;
  doses: (DoseSemenComTouro & { clienteNome: string })[];
}

export function DoseSemenCombobox({
  doses,
  clientes,
  value,
  onValueChange,
  recentDoseIds = [],
  placeholder = 'Buscar dose de sêmen...',
}: DoseSemenComboboxProps) {
  const [open, setOpen] = useState(false);

  const clientesMap = useMemo(() => new Map(clientes.map((c) => [c.id, c.nome])), [clientes]);

  const selected = doses.find((d) => d.id === value);
  const selectedLabel = selected
    ? `${selected.touro?.nome || 'Touro'} - ${clientesMap.get(selected.cliente_id) || 'Cliente'}`
    : null;

  const { recentGroups, otherGroups } = useMemo(() => {
    const recentSet = new Set(recentDoseIds);

    // Enrich doses with cliente name
    const enriched = doses.map((d) => ({
      ...d,
      clienteNome: clientesMap.get(d.cliente_id) || 'Sem cliente',
    }));

    // Split into recent and other
    const recent = enriched.filter((d) => recentSet.has(d.id));
    const other = enriched.filter((d) => !recentSet.has(d.id));

    function groupByTouro(items: typeof enriched): DoseGroup[] {
      const map = new Map<string, DoseGroup>();
      for (const d of items) {
        const key = d.touro_id || 'sem-touro';
        if (!map.has(key)) {
          map.set(key, {
            touroNome: d.touro?.nome || 'Touro desconhecido',
            touroRegistro: d.touro?.registro,
            doses: [],
          });
        }
        map.get(key)!.doses.push(d);
      }
      return Array.from(map.values()).sort((a, b) => a.touroNome.localeCompare(b.touroNome));
    }

    return {
      recentGroups: groupByTouro(recent),
      otherGroups: groupByTouro(other),
    };
  }, [doses, clientes, recentDoseIds, clientesMap]);

  function renderDoseItem(dose: DoseSemenComTouro & { clienteNome: string }) {
    const tipoLabel = dose.tipo_semen === 'CONVENCIONAL' ? 'CONV' : dose.tipo_semen === 'SEXADO' ? 'SEX' : null;
    return (
      <CommandItem
        key={dose.id}
        value={`${dose.touro?.nome || ''} ${dose.touro?.registro || ''} ${dose.touro?.raca || ''} ${dose.clienteNome} ${dose.tipo_semen || ''}`}
        onSelect={() => {
          onValueChange(dose.id);
          setOpen(false);
        }}
        className="min-h-[44px] md:min-h-0"
      >
        <Check className={cn('mr-2 h-4 w-4 shrink-0', value === dose.id ? 'opacity-100' : 'opacity-0')} />
        <div className="flex-1 min-w-0">
          <span className="font-medium">{dose.touro?.nome || 'Touro'}</span>
          <span className="text-muted-foreground ml-1.5 text-sm">{dose.clienteNome}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {tipoLabel && (
            <Badge variant="secondary" className="text-[10px] px-1.5">
              {tipoLabel}
            </Badge>
          )}
          {dose.quantidade != null && (
            <span className="text-xs text-muted-foreground">{dose.quantidade}d</span>
          )}
        </div>
      </CommandItem>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal h-11 md:h-9"
        >
          {selectedLabel ? (
            <span className="truncate">{selectedLabel}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Touro, cliente, raça ou tipo..." />
          <CommandList className="max-h-[50vh]">
            <CommandEmpty>Nenhuma dose encontrada.</CommandEmpty>

            {recentGroups.length > 0 &&
              recentGroups.map((group) => (
                <CommandGroup
                  key={`recent-${group.touroNome}`}
                  heading={`Usados neste lote — ${group.touroNome}${group.touroRegistro ? ` (${group.touroRegistro})` : ''}`}
                >
                  {group.doses.map(renderDoseItem)}
                </CommandGroup>
              ))}

            {otherGroups.map((group) => (
              <CommandGroup
                key={group.touroNome}
                heading={`${group.touroNome}${group.touroRegistro ? ` (${group.touroRegistro})` : ''}`}
              >
                {group.doses.map(renderDoseItem)}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
