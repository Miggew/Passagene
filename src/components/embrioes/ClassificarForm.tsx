import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ClassificarFormProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitting: boolean;
  buttonLabel: string;
}

export function ClassificarForm({
  value,
  onChange,
  onSubmit,
  onCancel,
  submitting,
  buttonLabel,
}: ClassificarFormProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Classificação *</Label>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="BE">BE (Blastocisto Excelente)</SelectItem>
            <SelectItem value="BN">BN (Blastocisto Normal)</SelectItem>
            <SelectItem value="BX">BX (Blastocisto Regular)</SelectItem>
            <SelectItem value="BL">BL (Blastocisto Limitado)</SelectItem>
            <SelectItem value="BI">BI (Blastocisto Irregular)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2 pt-2">
        <Button
          onClick={onSubmit}
          className="flex-1 bg-primary hover:bg-primary-dark"
          disabled={submitting}
        >
          {submitting ? 'Salvando...' : buttonLabel}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
