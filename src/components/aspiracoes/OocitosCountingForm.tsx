import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { calculateTotalOocitos, type OocitosData } from '@/lib/oocitos';

interface OocitosCountingFormProps {
  data: OocitosData;
  onChange: (field: keyof OocitosData, value: string) => void;
  disabled?: boolean;
}

export function OocitosCountingForm({ data, onChange, disabled }: OocitosCountingFormProps) {
  const total = calculateTotalOocitos(data);

  return (
    <div className="border-t pt-4">
      <h3 className="font-semibold mb-3">Contagem de Oócitos</h3>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Atrésicos</Label>
          <Input
            type="number"
            min="0"
            value={data.atresicos}
            onChange={(e) => onChange('atresicos', e.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label>Degenerados</Label>
          <Input
            type="number"
            min="0"
            value={data.degenerados}
            onChange={(e) => onChange('degenerados', e.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label>Expandidos</Label>
          <Input
            type="number"
            min="0"
            value={data.expandidos}
            onChange={(e) => onChange('expandidos', e.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label>Desnudos</Label>
          <Input
            type="number"
            min="0"
            value={data.desnudos}
            onChange={(e) => onChange('desnudos', e.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label>Viáveis</Label>
          <Input
            type="number"
            min="0"
            value={data.viaveis}
            onChange={(e) => onChange('viaveis', e.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label>Total</Label>
          <Input value={total} disabled />
        </div>
      </div>
    </div>
  );
}
