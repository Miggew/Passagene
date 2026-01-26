/**
 * Dialog para registrar nascimento de bezerro
 */

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import DatePickerBR from '@/components/shared/DatePickerBR';
import type { NascimentoFormData, NascimentoEmbriaoInfo } from '@/hooks/receptoras/useNascimento';

interface NascimentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nascimentoForm: NascimentoFormData;
  onFormChange: (form: NascimentoFormData) => void;
  nascimentoEmbrioes: NascimentoEmbriaoInfo[];
  nascimentoLoading: boolean;
  submitting: boolean;
  onRegistrar: () => void;
  onCancelar: () => void;
}

export function NascimentoDialog({
  open,
  onOpenChange,
  nascimentoForm,
  onFormChange,
  nascimentoEmbrioes,
  nascimentoLoading,
  submitting,
  onRegistrar,
  onCancelar,
}: NascimentoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Registrar nascimento</DialogTitle>
          <DialogDescription>
            Crie os animais a partir da prenhez desta receptora.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data de nascimento *</Label>
              <DatePickerBR
                value={nascimentoForm.data_nascimento}
                onChange={(value) => onFormChange({ ...nascimentoForm, data_nascimento: value || '' })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Sexo *</Label>
              <Select
                value={nascimentoForm.sexo}
                onValueChange={(value) => onFormChange({ ...nascimentoForm, sexo: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o sexo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FEMEA">Fêmea</SelectItem>
                  <SelectItem value="MACHO">Macho</SelectItem>
                  <SelectItem value="SEM_SEXO">Sem sexo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={nascimentoForm.observacoes}
              onChange={(e) => onFormChange({ ...nascimentoForm, observacoes: e.target.value })}
              placeholder="Observações sobre o nascimento"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Embriões vinculados</Label>
            {nascimentoLoading && (
              <div className="text-sm text-slate-500">Carregando dados...</div>
            )}
            {!nascimentoLoading && nascimentoEmbrioes.length === 0 && (
              <div className="text-sm text-slate-500">Nenhum embrião disponível para registro.</div>
            )}
            {!nascimentoLoading && nascimentoEmbrioes.length > 0 && (
              <div className="border rounded-lg p-3">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Embrião</TableHead>
                      <TableHead>Doadora</TableHead>
                      <TableHead>Touro</TableHead>
                      <TableHead>Raça</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {nascimentoEmbrioes.map((e) => (
                      <TableRow key={e.embriao_id}>
                        <TableCell className="font-medium">{e.embriao_id.substring(0, 8)}</TableCell>
                        <TableCell>{e.doadora_registro || '-'}</TableCell>
                        <TableCell>{e.touro_nome || '-'}</TableCell>
                        <TableCell>{e.raca || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onCancelar}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={onRegistrar}
            disabled={submitting}
          >
            Registrar nascimento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default NascimentoDialog;
