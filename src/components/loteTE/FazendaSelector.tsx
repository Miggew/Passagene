import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { Fazenda } from '@/lib/types';

interface FazendaSelectorProps {
  fazendas: Fazenda[];
  fazendaSelecionada: string;
  onFazendaChange: (fazendaId: string) => void;
}

export function FazendaSelector({
  fazendas,
  fazendaSelecionada,
  onFazendaChange,
}: FazendaSelectorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Selecionar Fazenda</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Label htmlFor="fazenda">Fazenda *</Label>
          <Select
            value={fazendaSelecionada}
            onValueChange={onFazendaChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione a fazenda" />
            </SelectTrigger>
            <SelectContent>
              {fazendas.map((fazenda) => (
                <SelectItem key={fazenda.id} value={fazenda.id}>
                  {fazenda.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
