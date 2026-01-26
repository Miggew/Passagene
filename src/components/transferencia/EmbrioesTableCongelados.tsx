/**
 * Tabela de embriões congelados para seleção na transferência
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
import StatusBadge from '@/components/shared/StatusBadge';
import { EmbrioCompleto } from '@/lib/types/transferenciaEmbrioes';

const PAGE_SIZE = 20;

interface EmbrioesTableCongeladosProps {
  embrioes: EmbrioCompleto[];
  selectedEmbriaoId: string;
  embrioesPage: number;
  loadingCongelados: boolean;
  filtroClienteId: string;
  filtroRaca: string;
  onSelectEmbriao: (embriaoId: string) => void;
  onPageChange: (page: number) => void;
}

export default function EmbrioesTableCongelados({
  embrioes,
  selectedEmbriaoId,
  embrioesPage,
  loadingCongelados,
  filtroClienteId,
  filtroRaca,
  onSelectEmbriao,
  onPageChange,
}: EmbrioesTableCongeladosProps) {
  const temFiltro = filtroClienteId || filtroRaca.trim();

  // Ordenar por data de criação
  const ordenados = [...embrioes].sort((a, b) => {
    const dataA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const dataB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return dataB - dataA;
  });

  const totalPaginas = Math.max(1, Math.ceil(ordenados.length / PAGE_SIZE));
  const paginaAtual = Math.min(embrioesPage, totalPaginas);
  const inicio = (paginaAtual - 1) * PAGE_SIZE;
  const embrioesPagina = ordenados.slice(inicio, inicio + PAGE_SIZE);

  return (
    <div className="space-y-4">
      <Label>7. Selecionar Embrião Congelado *</Label>
      <div className="border rounded-lg p-4">
        {!temFiltro && (
          <div className="text-sm text-slate-500">
            Selecione um cliente ou informe a raça para listar embriões congelados.
          </div>
        )}
        {loadingCongelados && (
          <div className="text-sm text-slate-500">Carregando embriões congelados...</div>
        )}
        {!loadingCongelados && embrioes.length === 0 && temFiltro && (
          <div className="text-sm text-slate-500">
            Nenhum embrião congelado encontrado para os filtros aplicados.
          </div>
        )}
        {!loadingCongelados && embrioes.length > 0 && (
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Doadora</TableHead>
                  <TableHead>Touro</TableHead>
                  <TableHead>Classificação</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {embrioesPagina.map((embriao) => (
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
                    <TableCell className="font-mono text-xs">{embriao.identificacao || embriao.id.substring(0, 8)}</TableCell>
                    <TableCell>{embriao.doadora_registro || '-'}</TableCell>
                    <TableCell>{embriao.touro_nome || '-'}</TableCell>
                    <TableCell>
                      {embriao.classificacao ? <Badge variant="outline">{embriao.classificacao}</Badge> : <span className="text-slate-400">-</span>}
                    </TableCell>
                    <TableCell><StatusBadge status={embriao.status_atual} /></TableCell>
                  </TableRow>
                ))}
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
        )}
      </div>
    </div>
  );
}
