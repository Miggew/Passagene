/**
 * Dialog para registrar cio livre
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import DatePickerBR from '@/components/shared/DatePickerBR';
import StatusBadge from '@/components/shared/StatusBadge';
import type { Receptora } from '@/lib/types';
import { todayISO as getTodayDateString } from '@/lib/dateUtils';

interface CioLivreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receptora: Receptora | null;
  cioLivreForm: { data_cio: string };
  setCioLivreForm: React.Dispatch<React.SetStateAction<{ data_cio: string }>>;
  submitting: boolean;
  onSubmit: () => void;
}

export function CioLivreDialog({
  open,
  onOpenChange,
  receptora,
  cioLivreForm,
  setCioLivreForm,
  submitting,
  onSubmit,
}: CioLivreDialogProps) {
  const statusAtual = receptora?.status_reprodutivo || 'VAZIA';

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (isOpen) {
      setCioLivreForm({ data_cio: getTodayDateString() });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar Cio Livre</DialogTitle>
          <DialogDescription>
            Registre a data do cio livre. A confirmação ocorrerá automaticamente após a TE.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span>Receptora</span>
              <span className="font-medium">
                {receptora?.identificacao} {receptora?.nome ? `- ${receptora.nome}` : ''}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span>Status atual</span>
              <StatusBadge status={statusAtual} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Data do cio *</Label>
            <DatePickerBR
              value={cioLivreForm.data_cio}
              onChange={(value) => setCioLivreForm((prev) => ({ ...prev, data_cio: value || '' }))}
              required
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={onSubmit} disabled={submitting}>
            Registrar Cio Livre
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
