/**
 * ReceptoraFormDialog - Dialog para criar nova receptora
 */

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';

export interface ReceptoraFormData {
  identificacao: string;
  nome: string;
}

export interface ReceptoraFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: ReceptoraFormData;
  onFormChange: (data: ReceptoraFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
}

export function ReceptoraFormDialog({
  open,
  onOpenChange,
  formData,
  onFormChange,
  onSubmit,
  submitting,
}: ReceptoraFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="bg-green-600 hover:bg-green-700">
          <Plus className="w-4 h-4 mr-2" />
          Nova Receptora
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Nova Receptora</DialogTitle>
          <DialogDescription>Criar receptora na fazenda selecionada</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="identificacao">Identificacao (Brinco) *</Label>
            <Input
              id="identificacao"
              value={formData.identificacao}
              onChange={(e) => onFormChange({ ...formData, identificacao: e.target.value })}
              placeholder="Numero do brinco"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nome">Nome</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => onFormChange({ ...formData, nome: e.target.value })}
              placeholder="Nome da receptora (opcional)"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              type="submit"
              className="flex-1 bg-green-600 hover:bg-green-700"
              disabled={submitting}
            >
              {submitting ? 'Salvando...' : 'Salvar'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default ReceptoraFormDialog;
