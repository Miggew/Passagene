/**
 * Card com formulário de dados do 2º passo
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import DatePickerBR from '@/components/shared/DatePickerBR';

interface Passo2FormCardProps {
  data: string;
  tecnico: string;
  onDataChange: (value: string) => void;
  onTecnicoChange: (value: string) => void;
}

export function Passo2FormCard({
  data,
  tecnico,
  onDataChange,
  onTecnicoChange,
}: Passo2FormCardProps) {
  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-blue-900">Dados do 2º Passo</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="passo2_data" className="text-blue-900">
              Data de Realização *
            </Label>
            <DatePickerBR
              id="passo2_data"
              value={data}
              onChange={(value) => onDataChange(value || '')}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="passo2_tecnico" className="text-blue-900">
              Responsável *
            </Label>
            <Input
              id="passo2_tecnico"
              value={tecnico}
              onChange={(e) => onTecnicoChange(e.target.value)}
              placeholder="Nome do responsável"
              required
              className="bg-white"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
