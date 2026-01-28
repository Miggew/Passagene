/**
 * Dialog de resumo após finalizar um passo do protocolo
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface ProtocoloResumoDialogProps {
  open: boolean;
  onClose: () => void;
  step: 1 | 2;
  fazendaNome: string;
  dataInicio: string;
  totalReceptoras: number;
  receptorasConfirmadas: number;
  receptorasDescartadas?: number;
}

export function ProtocoloResumoDialog({
  open,
  onClose,
  step,
  fazendaNome,
  dataInicio,
  totalReceptoras,
  receptorasConfirmadas,
  receptorasDescartadas = 0,
}: ProtocoloResumoDialogProps) {
  const isStep1 = step === 1;
  const title = isStep1 ? '1º Passo Concluído' : '2º Passo Concluído';
  const description = isStep1
    ? 'Protocolo criado com sucesso'
    : 'Revisão das receptoras concluída';
  const nextAction = isStep1
    ? 'As receptoras estão em sincronização'
    : 'As receptoras confirmadas estão prontas para TE';

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-6 h-6 text-green-600" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-slate-500">Fazenda</p>
              <p className="text-base text-slate-900">{fazendaNome}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Data do Protocolo</p>
              <p className="text-base text-slate-900">{formatDate(dataInicio)}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
              <p className="text-sm font-medium text-green-700 mb-1">
                {isStep1 ? 'Receptoras Adicionadas' : 'Confirmadas para TE'}
              </p>
              <p className="text-3xl font-bold text-green-600">{receptorasConfirmadas}</p>
            </div>
            {!isStep1 && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-center">
                <p className="text-sm font-medium text-red-700 mb-1">Descartadas</p>
                <p className="text-3xl font-bold text-red-600">{receptorasDescartadas}</p>
              </div>
            )}
            {isStep1 && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
                <p className="text-sm font-medium text-blue-700 mb-1">Total no Protocolo</p>
                <p className="text-3xl font-bold text-blue-600">{totalReceptoras}</p>
              </div>
            )}
          </div>

          {/* Next steps */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Próximos passos:</strong> {nextAction}
            </p>
          </div>

          <Button onClick={onClose} className="w-full">
            OK - Voltar para Protocolos
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
