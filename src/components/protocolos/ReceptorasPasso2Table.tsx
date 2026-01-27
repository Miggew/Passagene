/**
 * Tabela de receptoras para revisão no 2º passo
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import CiclandoBadge from '@/components/shared/CiclandoBadge';
import QualidadeSemaforo from '@/components/shared/QualidadeSemaforo';

interface ReceptoraPasso2 {
  id: string;
  identificacao: string;
  nome?: string | null;
  pr_id: string;
  pr_status: string;
  pr_motivo_inapta?: string;
  pr_ciclando_classificacao?: 'N' | 'CL' | null;
  pr_qualidade_semaforo?: 1 | 2 | 3 | null;
}

interface ReceptorasPasso2TableProps {
  receptoras: ReceptoraPasso2[];
  motivosInapta: Record<string, string>;
  isFinalized: boolean;
  onStatusChange: (receptoraId: string, status: 'APTA' | 'INAPTA' | 'INICIADA') => void;
  onMotivoChange: (receptoraId: string, motivo: string) => void;
}

export function ReceptorasPasso2Table({
  receptoras,
  motivosInapta,
  isFinalized,
  onStatusChange,
  onMotivoChange,
}: ReceptorasPasso2TableProps) {
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      'INICIADA': { label: 'Aguardando', className: 'bg-slate-100 text-slate-700 border-slate-200' },
      'APTA': { label: 'Confirmada', className: 'bg-green-100 text-green-700 border-green-200' },
      'INAPTA': { label: 'Descartada', className: 'bg-red-100 text-red-700 border-red-200' },
    };

    const config = statusMap[status] || { label: status, className: '' };
    return (
      <Badge variant="outline" className={config.className}>
        {config.label}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Receptoras para Revisão ({receptoras.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="font-semibold">Brinco</TableHead>
                <TableHead className="font-semibold">Nome</TableHead>
                <TableHead className="font-semibold">Ciclando</TableHead>
                <TableHead className="font-semibold">Qualidade</TableHead>
                <TableHead className="font-semibold">Avaliação</TableHead>
                <TableHead className="font-semibold">Motivo (se INAPTA)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receptoras.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-500 py-8">
                    Nenhuma receptora no protocolo
                  </TableCell>
                </TableRow>
              ) : (
                receptoras.map((r) => (
                  <TableRow key={r.id} className="hover:bg-slate-50/50">
                    <TableCell className="font-medium">{r.identificacao}</TableCell>
                    <TableCell className="text-slate-600">{r.nome || '-'}</TableCell>
                    <TableCell>
                      <CiclandoBadge
                        value={r.pr_ciclando_classificacao}
                        variant="display"
                        disabled={true}
                      />
                    </TableCell>
                    <TableCell>
                      <QualidadeSemaforo
                        value={r.pr_qualidade_semaforo}
                        variant="single"
                        disabled={true}
                      />
                    </TableCell>
                    <TableCell>
                      {!isFinalized ? (
                        <div className="flex items-center gap-4">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`apta-${r.id}`}
                              checked={r.pr_status === 'APTA'}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  onStatusChange(r.id, 'APTA');
                                } else {
                                  onStatusChange(r.id, 'INICIADA');
                                }
                              }}
                              className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                            />
                            <Label
                              htmlFor={`apta-${r.id}`}
                              className="text-sm font-medium cursor-pointer text-green-700"
                            >
                              APTA
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id={`inapta-${r.id}`}
                              checked={r.pr_status === 'INAPTA'}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  onStatusChange(r.id, 'INAPTA');
                                } else {
                                  onStatusChange(r.id, 'INICIADA');
                                }
                              }}
                              className="data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
                            />
                            <Label
                              htmlFor={`inapta-${r.id}`}
                              className="text-sm font-medium cursor-pointer text-red-700"
                            >
                              INAPTA
                            </Label>
                          </div>
                        </div>
                      ) : (
                        getStatusBadge(r.pr_status)
                      )}
                    </TableCell>
                    <TableCell>
                      {r.pr_status === 'INAPTA' && !isFinalized ? (
                        <Input
                          type="text"
                          placeholder="Justificativa (opcional)"
                          value={motivosInapta[r.id] || r.pr_motivo_inapta || ''}
                          onChange={(e) => onMotivoChange(r.id, e.target.value)}
                          className="w-full max-w-[200px]"
                        />
                      ) : (
                        <span className="text-slate-500 text-sm">
                          {r.pr_motivo_inapta || '-'}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
