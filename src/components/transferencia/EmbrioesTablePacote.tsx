/**
 * Tabela de embriões do pacote (frescos) para seleção na transferência
 * Extraído de TransferenciaEmbrioes.tsx para melhor organização
 */

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertTriangle } from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';
import { formatDate } from '@/lib/utils';
import { EmbrioCompleto, PacoteEmbrioes } from '@/lib/types/transferenciaEmbrioes';

const PAGE_SIZE = 20;

interface EmbrioesTablePacoteProps {
  pacote: PacoteEmbrioes;
  embrioes: EmbrioCompleto[];
  numerosFixosMap: Map<string, number>;
  selectedEmbriaoId: string;
  embrioesPage: number;
  hasD8Limite: boolean;
  onSelectEmbriao: (embriaoId: string) => void;
  onPageChange: (page: number) => void;
}

export default function EmbrioesTablePacote({
  pacote,
  embrioes,
  numerosFixosMap,
  selectedEmbriaoId,
  embrioesPage,
  hasD8Limite,
  onSelectEmbriao,
  onPageChange,
}: EmbrioesTablePacoteProps) {
  // Ordenar embriões
  const embrioesOrdenados = [...embrioes].sort((a, b) => {
    const idA = a.identificacao || '';
    const idB = b.identificacao || '';
    if (idA && idB) return idA.localeCompare(idB);
    if (idA && !idB) return -1;
    if (!idA && idB) return 1;
    const numeroA = numerosFixosMap.get(a.id) || 9999;
    const numeroB = numerosFixosMap.get(b.id) || 9999;
    return numeroA - numeroB;
  });

  const totalPaginas = Math.max(1, Math.ceil(embrioesOrdenados.length / PAGE_SIZE));
  const paginaAtual = Math.min(embrioesPage, totalPaginas);
  const inicio = (paginaAtual - 1) * PAGE_SIZE;
  const embrioesPagina = embrioesOrdenados.slice(inicio, inicio + PAGE_SIZE);

  return (
    <div className="space-y-4">
      <Label>7. Selecionar Embrião do Pacote *</Label>
      <div className="border rounded-lg p-4">
        <div className="mb-4">
          <h3 className="font-semibold text-slate-900">Pacote selecionado</h3>
          <p className="text-sm text-slate-600">
            Data Despacho: {formatDate(pacote.data_despacho)} | Total: {pacote.total} embrião(ões)
          </p>
          {hasD8Limite && (
            <div className="mt-2 flex items-center gap-2 text-sm text-amber-700">
              <AlertTriangle className="w-4 h-4" />
              Embriões em D8: transferir ou congelar hoje. No D9 serão descartados automaticamente.
            </div>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead className="text-center w-28">Código</TableHead>
                <TableHead>Doadora</TableHead>
                <TableHead>Touro</TableHead>
                <TableHead>Classificação</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {embrioesPagina.map((embriao) => {
                const numeroFixo = numerosFixosMap.get(embriao.id) || 0;

                return (
                  <TableRow
                    key={embriao.id}
                    className={selectedEmbriaoId === embriao.id ? 'bg-green-50' : 'cursor-pointer hover:bg-slate-50'}
                    onClick={() => onSelectEmbriao(embriao.id)}
                  >
                    <TableCell>
                      <input
                        type="radio"
                        name="embriao"
                        value={embriao.id}
                        checked={selectedEmbriaoId === embriao.id}
                        onChange={() => onSelectEmbriao(embriao.id)}
                        className="w-4 h-4"
                      />
                    </TableCell>
                    <TableCell className="text-center font-medium font-mono text-xs">
                      {embriao.identificacao || `#${numeroFixo}`}
                    </TableCell>
                    <TableCell>{embriao.doadora_registro || '-'}</TableCell>
                    <TableCell>{embriao.touro_nome || '-'}</TableCell>
                    <TableCell>
                      {embriao.classificacao ? <Badge variant="outline">{embriao.classificacao}</Badge> : <span className="text-slate-400">-</span>}
                    </TableCell>
                    <TableCell><StatusBadge status={embriao.status_atual} /></TableCell>
                    <TableCell>
                      {embriao.d8_limite ? (
                        <Badge variant="destructive">D8</Badge>
                      ) : embriao.d7_pronto ? (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">D7</Badge>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
            <div>{embrioes.length} embrião(ões) disponíveis</div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onPageChange(Math.max(1, embrioesPage - 1))}
                disabled={embrioesPage === 1}
              >
                Anterior
              </Button>
              <span>
                Página {paginaAtual} de {totalPaginas}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onPageChange(Math.min(totalPaginas, embrioesPage + 1))}
                disabled={embrioesPage >= totalPaginas}
              >
                Próxima
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
