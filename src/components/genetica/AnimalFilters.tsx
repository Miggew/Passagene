/**
 * Barra de filtros para o catálogo genético - Design Premium
 */

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Filter, X } from 'lucide-react';

interface AnimalFiltersProps {
  onFilter: (filters: { busca?: string; raca?: string }) => void;
  racas?: string[];
  placeholder?: string;
}

export function AnimalFilters({ onFilter, racas = [], placeholder = 'Buscar por nome ou registro...' }: AnimalFiltersProps) {
  const [busca, setBusca] = useState('');
  const [raca, setRaca] = useState<string>('');

  const handleSearch = () => {
    onFilter({
      busca: busca || undefined,
      raca: raca || undefined,
    });
  };

  const handleClear = () => {
    setBusca('');
    setRaca('');
    onFilter({});
  };

  const hasFilters = busca || raca;

  return (
    <div className="rounded-xl border border-border bg-gradient-to-r from-card via-card to-muted/30 p-4">
      <div className="flex flex-wrap items-end gap-4">
        {/* Busca */}
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-1 h-5 rounded-full bg-primary/40" />
            <span className="text-xs font-medium text-muted-foreground">Buscar</span>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={placeholder}
              className="pl-9 h-10 bg-background"
            />
          </div>
        </div>

        {/* Raça */}
        {racas.length > 0 && (
          <div className="w-[180px]">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-1 h-5 rounded-full bg-blue-500/40" />
              <span className="text-xs font-medium text-muted-foreground">Raça</span>
            </div>
            <Select value={raca} onValueChange={setRaca}>
              <SelectTrigger className="h-10 bg-background">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas</SelectItem>
                {racas.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Ações */}
        <div className="flex items-center gap-2">
          <Button onClick={handleSearch} className="h-10 bg-primary hover:bg-primary/90">
            <Filter className="w-4 h-4 mr-2" />
            Filtrar
          </Button>
          {hasFilters && (
            <Button variant="outline" onClick={handleClear} className="h-10">
              <X className="w-4 h-4 mr-2" />
              Limpar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default AnimalFilters;
