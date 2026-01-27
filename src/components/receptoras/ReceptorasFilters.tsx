/**
 * ReceptorasFilters - Filtros para lista de receptoras
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import SearchInput from '@/components/shared/SearchInput';
import { formatStatusLabel } from '@/lib/statusLabels';

export interface ReceptorasFiltersProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  filtroStatus: string;
  onStatusChange: (status: string) => void;
  statusDisponiveis: string[];
}

export function ReceptorasFilters({
  searchTerm,
  onSearchChange,
  filtroStatus,
  onStatusChange,
  statusDisponiveis,
}: ReceptorasFiltersProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Filtros</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 max-w-md">
            <Label htmlFor="filtro-status">Status</Label>
            <Select value={filtroStatus} onValueChange={onStatusChange}>
              <SelectTrigger id="filtro-status">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {statusDisponiveis.map((status) => (
                  <SelectItem key={status} value={status}>
                    {formatStatusLabel(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 max-w-md">
            <SearchInput
              value={searchTerm}
              onChange={onSearchChange}
              placeholder="Buscar por brinco ou nome..."
              label="Buscar por brinco ou nome"
              id="busca"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ReceptorasFilters;
