/**
 * FazendaSelector - Componente reutilizavel para selecao de fazenda
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface FazendaOption {
  id: string;
  nome: string;
}

export interface FazendaSelectorProps {
  fazendas: FazendaOption[];
  selectedFazendaId: string;
  onFazendaChange: (id: string) => void;
  title?: string;
  placeholder?: string;
  required?: boolean;
}

export function FazendaSelector({
  fazendas,
  selectedFazendaId,
  onFazendaChange,
  title = 'Selecione a Fazenda',
  placeholder = 'Selecione uma fazenda',
  required = false,
}: FazendaSelectorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {title}
          {required && ' *'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Select value={selectedFazendaId} onValueChange={onFazendaChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {fazendas.map((fazenda) => (
              <SelectItem key={fazenda.id} value={fazenda.id}>
                {fazenda.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}

export default FazendaSelector;
