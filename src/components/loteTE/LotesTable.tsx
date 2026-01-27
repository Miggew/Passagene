import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import type { LoteTEBase } from '@/lib/gestacao';

interface LotesTableProps<T extends LoteTEBase> {
  title: string;
  emptyTitle: string;
  emptyDescription: string;
  lotesTE: T[];
  loteSelecionado: T | null;
  loading: boolean;
  veterinarioLabel: string;
  tecnicoLabel: string;
  getVeterinario: (lote: T) => string | undefined;
  getTecnico: (lote: T) => string | undefined;
  onSelectLote: (lote: T) => void;
}

export function LotesTable<T extends LoteTEBase>({
  title,
  emptyTitle,
  emptyDescription,
  lotesTE,
  loteSelecionado,
  loading,
  veterinarioLabel,
  tecnicoLabel,
  getVeterinario,
  getTecnico,
  onSelectLote,
}: LotesTableProps<T>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <LoadingSpinner />
        ) : lotesTE.length === 0 ? (
          <EmptyState
            title={emptyTitle}
            description={emptyDescription}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data TE</TableHead>
                <TableHead>Quantidade</TableHead>
                <TableHead>{veterinarioLabel}</TableHead>
                <TableHead>{tecnicoLabel}</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lotesTE.map((lote) => (
                <TableRow
                  key={lote.id}
                  className={loteSelecionado?.id === lote.id ? 'bg-blue-50' : ''}
                >
                  <TableCell className="font-medium">
                    {new Date(lote.data_te).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell>{lote.quantidade_receptoras} receptoras</TableCell>
                  <TableCell>{getVeterinario(lote) || '-'}</TableCell>
                  <TableCell>{getTecnico(lote) || '-'}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      onClick={() => onSelectLote(lote)}
                      variant={loteSelecionado?.id === lote.id ? 'default' : 'outline'}
                    >
                      {loteSelecionado?.id === lote.id ? 'Selecionado' : 'Selecionar'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
