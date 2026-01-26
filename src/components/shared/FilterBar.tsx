/**
 * FilterBar - Componente generico de barra de filtros
 *
 * Suporta:
 * - Filtros de data (range)
 * - Filtros de select (fazenda, status, raca, etc.)
 * - Campo de busca
 * - Atalhos rapidos de data
 * - Botoes de buscar/limpar
 */

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import DatePickerBR from '@/components/shared/DatePickerBR';
import { Search } from 'lucide-react';

// Opcao para selects
export interface SelectOption {
  value: string;
  label: string;
}

// Configuracao de um filtro select
export interface SelectFilterConfig {
  type: 'select';
  key: string;
  label: string;
  placeholder: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  allOptionLabel?: string; // Label para "Todos" (default: "Todos")
}

// Configuracao de um filtro de data
export interface DateFilterConfig {
  type: 'date';
  key: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}

// Configuracao de um filtro de busca
export interface SearchFilterConfig {
  type: 'search';
  key: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}

// Union type para todos os filtros
export type FilterConfig = SelectFilterConfig | DateFilterConfig | SearchFilterConfig;

// Atalho de data
export interface DateShortcut {
  label: string;
  days: number;
}

// Props do componente
export interface FilterBarProps {
  filters: FilterConfig[];
  onSearch?: () => void;
  onClear?: () => void;
  loading?: boolean;
  dateShortcuts?: DateShortcut[];
  onDateShortcut?: (days: number) => void;
  showSearchButton?: boolean;
  showClearButton?: boolean;
  columns?: 2 | 3 | 4; // Colunas no grid (default: 4)
}

const defaultDateShortcuts: DateShortcut[] = [
  { label: 'Ultimos 7 dias', days: 7 },
  { label: 'Ultimos 30 dias', days: 30 },
  { label: 'Ultimos 90 dias', days: 90 },
];

export function FilterBar({
  filters,
  onSearch,
  onClear,
  loading = false,
  dateShortcuts,
  onDateShortcut,
  showSearchButton = true,
  showClearButton = true,
  columns = 4,
}: FilterBarProps) {
  const gridCols = {
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-4',
  };

  const hasDateFilters = filters.some((f) => f.type === 'date');
  const shortcuts = dateShortcuts || (hasDateFilters ? defaultDateShortcuts : []);

  return (
    <div className="space-y-4">
      {/* Filters Grid */}
      <div className={`grid grid-cols-1 ${gridCols[columns]} gap-4`}>
        {filters.map((filter) => (
          <FilterField key={filter.key} filter={filter} />
        ))}
      </div>

      {/* Shortcuts and Buttons */}
      {(shortcuts.length > 0 || showSearchButton || showClearButton) && (
        <div className="flex flex-wrap items-end gap-4">
          {/* Date Shortcuts */}
          {shortcuts.length > 0 && onDateShortcut && (
            <div className="flex flex-wrap gap-2 flex-1">
              <Label className="w-full text-sm font-medium text-slate-700">
                Atalhos rapidos:
              </Label>
              {shortcuts.map((shortcut) => (
                <Button
                  key={shortcut.days}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onDateShortcut(shortcut.days)}
                >
                  {shortcut.label}
                </Button>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            {showClearButton && onClear && (
              <Button type="button" variant="outline" onClick={onClear} disabled={loading}>
                Limpar
              </Button>
            )}
            {showSearchButton && onSearch && (
              <Button
                type="button"
                onClick={onSearch}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Search className="w-4 h-4 mr-2" />
                Buscar
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Componente interno para renderizar cada tipo de filtro
interface FilterFieldProps {
  filter: FilterConfig;
}

function FilterField({ filter }: FilterFieldProps) {
  switch (filter.type) {
    case 'select':
      return <SelectFilter filter={filter} />;
    case 'date':
      return <DateFilter filter={filter} />;
    case 'search':
      return <SearchFilter filter={filter} />;
    default:
      return null;
  }
}

function SelectFilter({ filter }: { filter: SelectFilterConfig }) {
  const allLabel = filter.allOptionLabel || 'Todos';

  return (
    <div className="space-y-2">
      <Label>{filter.label}</Label>
      <Select
        value={filter.value || 'all'}
        onValueChange={(value) => filter.onChange(value === 'all' ? '' : value)}
      >
        <SelectTrigger>
          <SelectValue placeholder={filter.placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{allLabel}</SelectItem>
          {filter.options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function DateFilter({ filter }: { filter: DateFilterConfig }) {
  return (
    <div className="space-y-2">
      <Label>{filter.label}</Label>
      <DatePickerBR value={filter.value} onChange={filter.onChange} />
    </div>
  );
}

function SearchFilter({ filter }: { filter: SearchFilterConfig }) {
  return (
    <div className="space-y-2">
      <Label>{filter.label}</Label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
        <Input
          placeholder={filter.placeholder}
          value={filter.value}
          onChange={(e) => filter.onChange(e.target.value)}
          className="pl-10"
        />
      </div>
    </div>
  );
}

export default FilterBar;
