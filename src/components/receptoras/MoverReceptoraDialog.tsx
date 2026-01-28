/**
 * Dialog para mover receptora entre fazendas
 */

import type { Receptora, Fazenda } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface MoverReceptoraDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receptora: Receptora | null;
  fazendasDisponiveis: Fazenda[];
  novaFazendaId: string;
  onFazendaChange: (fazendaId: string) => void;
  temConflitoBrinco: boolean;
  temConflitoNome: boolean;
  novoBrincoProposto: string;
  submitting: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export function MoverReceptoraDialog({
  open,
  onOpenChange,
  receptora,
  fazendasDisponiveis,
  novaFazendaId,
  onFazendaChange,
  temConflitoBrinco,
  temConflitoNome,
  novoBrincoProposto,
  submitting,
  onConfirmar,
  onCancelar,
}: MoverReceptoraDialogProps) {
  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (!newOpen) {
      onCancelar();
    }
  };

  const canSubmit = novaFazendaId && !temConflitoNome && !(temConflitoBrinco && !novoBrincoProposto);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mover Receptora</DialogTitle>
          <DialogDescription>
            Mover {receptora?.identificacao} para outra fazenda.
            Protocolos e histórico reprodutivo não serão afetados.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nova_fazenda">Nova Fazenda *</Label>
            <Select value={novaFazendaId} onValueChange={onFazendaChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a fazenda de destino" />
              </SelectTrigger>
              <SelectContent>
                {fazendasDisponiveis.map((fazenda) => (
                  <SelectItem key={fazenda.id} value={fazenda.id}>
                    {fazenda.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {temConflitoNome && receptora?.nome && (
            <div className="space-y-2 p-3 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-start gap-2">
                <div className="text-red-800 text-sm font-medium">
                  Conflito de Nome Detectado
                </div>
              </div>
              <div className="text-red-700 text-sm">
                Já existe uma receptora com o nome "{receptora.nome.trim()}" na fazenda destino.
              </div>
              <div className="text-red-600 text-xs">
                Não é possível mover esta receptora. Edite o nome da receptora antes de movê-la.
              </div>
            </div>
          )}

          {temConflitoBrinco && novoBrincoProposto && (
            <div className="space-y-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <div className="flex items-start gap-2">
                <div className="text-yellow-800 text-sm font-medium">
                  Conflito de Brinco Detectado
                </div>
              </div>
              <div className="text-yellow-700 text-sm">
                Já existe uma receptora com o brinco "{receptora?.identificacao}" na fazenda destino.
              </div>
              <div className="space-y-1">
                <Label className="text-yellow-800 text-sm font-medium">
                  Novo Brinco Proposto:
                </Label>
                <div className="p-2 bg-white border border-yellow-300 rounded text-sm font-mono text-yellow-900">
                  {novoBrincoProposto}
                </div>
                <div className="text-yellow-600 text-xs">
                  O brinco será automaticamente atualizado para permitir a movimentação.
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              className="flex-1"
              onClick={onConfirmar}
              disabled={submitting || !canSubmit}
            >
              {submitting ? 'Movendo...' : 'Confirmar Movimentação'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onCancelar}
              disabled={submitting}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default MoverReceptoraDialog;
