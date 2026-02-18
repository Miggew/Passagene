import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { normalizeDateForDB } from '@/lib/dateUtils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

function isoToLocalDate(iso: string): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function dateToIso(date: Date | undefined): string {
  return normalizeDateForDB(date) || '';
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  className?: string;
};

function DatePickerBR({
  value,
  onChange,
  placeholder = 'dd/mm/aaaa',
  disabled,
  min,
  max,
  className,
  id,
  required,
}: Props & { id?: string; required?: boolean }) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => isoToLocalDate(value), [value]);

  const disabledDays = useMemo(() => {
    const before = isoToLocalDate(min || '');
    const after = isoToLocalDate(max || '');
    if (before && after) return { before, after };
    if (before) return { before };
    if (after) return { after };
    return undefined;
  }, [min, max]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          disabled={disabled}
          className={cn('w-full justify-start text-left font-normal', !value && 'text-muted-foreground', className)}
          type="button"
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selected ? format(selected, 'dd/MM/yyyy', { locale: ptBR }) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <Calendar
          mode="single"
          selected={selected ?? undefined}
          onSelect={(d) => {
            if (!d) return;
            onChange(dateToIso(d));
            setOpen(false);
          }}
          disabled={disabledDays}
          initialFocus
          locale={ptBR}
          showOutsideDays={false}
          className="rounded-md"
          classNames={{
            months: 'flex flex-col',
            month: 'space-y-1',
            caption: 'flex justify-center pt-0 relative items-center mb-1',
            caption_label: 'text-sm font-medium',
            nav: 'space-x-1 flex items-center',
            nav_button: 'h-6 w-6 bg-transparent p-0 opacity-50 hover:opacity-100',
            nav_button_previous: 'absolute left-1',
            nav_button_next: 'absolute right-1',
            table: 'w-full border-collapse',
            head_row: 'flex',
            head_cell: 'text-muted-foreground w-8 h-7 font-normal text-xs flex items-center justify-center',
            row: 'flex w-full',
            cell: 'h-8 w-8 text-center text-xs p-0 relative',
            day: 'h-8 w-8 p-0 font-normal aria-selected:opacity-100 text-xs',
            day_selected: 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
            day_today: 'bg-accent text-accent-foreground',
            day_outside: 'day-outside text-muted-foreground opacity-50',
            day_disabled: 'text-muted-foreground opacity-50',
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export default DatePickerBR;
