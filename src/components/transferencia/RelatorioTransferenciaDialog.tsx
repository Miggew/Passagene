/**
 * Dialog para exibir relatório de transferências de embriões da sessão
 * Extraído de TransferenciaEmbrioes.tsx para melhor organização
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FileText } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { RelatorioTransferenciaItem } from '@/lib/types/transferenciaEmbrioes';

interface RelatorioTransferenciaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  relatorioData: RelatorioTransferenciaItem[];
  fazendaNome: string;
  dataTe: string;
  veterinarioResponsavel: string;
  tecnicoResponsavel: string;
  isVisualizacaoApenas: boolean;
  submitting: boolean;
  onFechar: () => void;
  onConfirmarEncerrar: () => Promise<void>;
}

export default function RelatorioTransferenciaDialog({
  open,
  onOpenChange,
  relatorioData,
  fazendaNome,
  dataTe,
  veterinarioResponsavel,
  tecnicoResponsavel,
  isVisualizacaoApenas,
  submitting,
  onFechar,
  onConfirmarEncerrar,
}: RelatorioTransferenciaDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Relatório da Sessão de Transferência de Embriões
          </DialogTitle>
          <DialogDescription>
            Fazenda: {fazendaNome || 'N/A'} |
            Data da TE: {dataTe ? formatDate(dataTe) : 'N/A'} |
            Total: {relatorioData.length} transferência(s)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><strong>Veterinário Responsável:</strong> {veterinarioResponsavel || 'N/A'}</div>
            <div><strong>Técnico Responsável:</strong> {tecnicoResponsavel || 'N/A'}</div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">Código</TableHead>
                  <TableHead>Doadora</TableHead>
                  <TableHead>Touro</TableHead>
                  <TableHead>Classificação</TableHead>
                  <TableHead>Receptora (Brinco)</TableHead>
                  <TableHead>Receptora (Nome)</TableHead>
                  <TableHead>Data TE</TableHead>
                  <TableHead>Observações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {relatorioData.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="text-center font-semibold">{item.numero_embriao}</TableCell>
                    <TableCell>{item.doadora}</TableCell>
                    <TableCell>{item.touro}</TableCell>
                    <TableCell>{item.classificacao}</TableCell>
                    <TableCell className="font-semibold">{item.receptora_brinco}</TableCell>
                    <TableCell>{item.receptora_nome}</TableCell>
                    <TableCell>{item.data_te ? formatDate(item.data_te) : 'N/A'}</TableCell>
                    <TableCell className="text-sm text-slate-600">{item.observacoes || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onFechar}
          >
            Fechar
          </Button>
          {!isVisualizacaoApenas && (
            <Button
              type="button"
              onClick={async () => {
                onFechar();
                await onConfirmarEncerrar();
              }}
              disabled={submitting}
            >
              {submitting ? 'Encerrando...' : 'Confirmar e Encerrar Sessão'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
