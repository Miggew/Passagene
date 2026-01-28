/**
 * ReceptoraEditDialog - Dialog para editar receptora
 */

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowRight } from 'lucide-react';

export interface ReceptoraEditFormData {
  identificacao: string;
  nome: string;
}

export interface ReceptoraEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: ReceptoraEditFormData;
  onFormChange: (data: ReceptoraEditFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
  onMoverFazenda: () => void;
}

export function ReceptoraEditDialog({
  open,
  onOpenChange,
  formData,
  onFormChange,
  onSubmit,
  submitting,
  onMoverFazenda,
}: ReceptoraEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Receptora</DialogTitle>
          <DialogDescription>Atualizar dados da receptora</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit_identificacao">Identificacao (Brinco) *</Label>
            <Input
              id="edit_identificacao"
              value={formData.identificacao}
              onChange={(e) => onFormChange({ ...formData, identificacao: e.target.value })}
              placeholder="Numero do brinco"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit_nome">Nome</Label>
            <Input
              id="edit_nome"
              value={formData.nome}
              onChange={(e) => onFormChange({ ...formData, nome: e.target.value })}
              placeholder="Nome da receptora (opcional)"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              type="submit"
              className="flex-1"
              disabled={submitting}
            >
              {submitting ? 'Salvando...' : 'Salvar Alteracoes'}
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

        {/* Divider */}
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-slate-500">Ou</span>
          </div>
        </div>

        {/* Move to another fazenda button */}
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={onMoverFazenda}
          disabled={submitting}
        >
          <ArrowRight className="w-4 h-4 mr-2" />
          Mover para outra fazenda
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export default ReceptoraEditDialog;
