/**
 * ReceptorasTable - Tabela de receptoras com acoes
 */

import { memo } from 'react';
import type { Receptora, ReceptoraComStatus } from '@/lib/types';
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
import { TableSkeleton } from '@/components/shared/TableSkeleton';
import StatusBadge from '@/components/shared/StatusBadge';
import { Edit, History, Baby } from 'lucide-react';
import { formatDateBR } from '@/lib/dateUtils';

export interface ReceptorasTableProps {
  receptoras: ReceptoraComStatus[];
  loading: boolean;
  searchTerm: string;
  onEdit: (receptora: Receptora) => void;
  onHistorico: (receptoraId: string) => void;
  onNascimento: (receptora: ReceptoraComStatus) => void;
}

export function ReceptorasTable({
  receptoras,
  loading,
  searchTerm,
  onEdit,
  onHistorico,
  onNascimento,
}: ReceptorasTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lista de Receptoras ({receptoras.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <TableSkeleton
            columns={5}
            rows={8}
            headers={['Brinco', 'Nome', 'Status Atual', 'Data de parto', 'Acoes']}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Brinco</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Status Atual</TableHead>
                <TableHead>Data de parto</TableHead>
                <TableHead className="text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receptoras.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-500">
                    {searchTerm
                      ? 'Nenhuma receptora encontrada'
                      : 'Nenhuma receptora cadastrada nesta fazenda'}
                  </TableCell>
                </TableRow>
              ) : (
                receptoras.map((receptora) => (
                  <ReceptoraRow
                    key={receptora.id}
                    receptora={receptora}
                    onEdit={onEdit}
                    onHistorico={onHistorico}
                    onNascimento={onNascimento}
                  />
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// Sub-component for table row - memoized to prevent unnecessary re-renders
interface ReceptoraRowProps {
  receptora: ReceptoraComStatus;
  onEdit: (receptora: Receptora) => void;
  onHistorico: (receptoraId: string) => void;
  onNascimento: (receptora: ReceptoraComStatus) => void;
}

const ReceptoraRow = memo(function ReceptoraRow({
  receptora,
  onEdit,
  onHistorico,
  onNascimento,
}: ReceptoraRowProps) {
  const shouldShowBirthButton = () => {
    if (!receptora.status_calculado.includes('PRENHE') || !receptora.data_provavel_parto) {
      return false;
    }
    const partoDate = new Date(receptora.data_provavel_parto);
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + 20);
    return partoDate <= threshold;
  };

  return (
    <TableRow>
      <TableCell className="font-medium">{receptora.identificacao}</TableCell>
      <TableCell>{receptora.nome || '-'}</TableCell>
      <TableCell>
        <StatusBadge status={receptora.status_calculado} count={receptora.numero_gestacoes} />
      </TableCell>
      <TableCell>
        {receptora.status_calculado.includes('PRENHE') && receptora.data_provavel_parto
          ? formatDateBR(receptora.data_provavel_parto)
          : '-'}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex gap-1 justify-end">
          {shouldShowBirthButton() && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNascimento(receptora)}
              title="Registrar nascimento"
            >
              <Baby className="w-4 h-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(receptora as Receptora)}
            title="Editar"
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onHistorico(receptora.id)}
            title="Ver historico"
          >
            <History className="w-4 h-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
});

export default ReceptorasTable;
