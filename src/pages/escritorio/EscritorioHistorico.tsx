import { useState } from 'react';
import { toast } from 'sonner';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { History, RotateCcw, Image, AlertTriangle } from 'lucide-react';
import { useReportImports } from '@/hooks/escritorio/useReportImports';
import type { ReportImport } from '@/lib/types/escritorio';
import { cn } from '@/lib/utils';

const typeLabels: Record<string, string> = {
  dg: 'Diagnóstico (DG)',
  sexagem: 'Sexagem',
  p1: 'Protocolo P1',
  p2: 'Protocolo P2',
  te: 'Transferência (TE)',
  aspiracao: 'Aspiração',
};

const statusStyles: Record<string, string> = {
  processing: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  review: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  completed: 'bg-green-500/10 text-green-600 border-green-500/30',
  reverted: 'bg-red-500/10 text-red-600 border-red-500/30',
};

const statusLabels: Record<string, string> = {
  processing: 'Processando',
  review: 'Em revisão',
  completed: 'Completo',
  reverted: 'Desfeito',
};

export default function EscritorioHistorico() {
  const { imports, isLoading, revertImport, isReverting } = useReportImports();
  const [confirmRevert, setConfirmRevert] = useState<string | null>(null);

  const handleRevert = async (importId: string) => {
    try {
      await revertImport(importId);
      toast.success('Importação revertida com sucesso');
      setConfirmRevert(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao reverter');
    }
  };

  const canRevert = (imp: ReportImport) => {
    if (imp.status !== 'completed' || !imp.completed_at) return false;
    const completedAt = new Date(imp.completed_at);
    const now = new Date();
    const hoursAgo = (now.getTime() - completedAt.getTime()) / (1000 * 60 * 60);
    return hoursAgo <= 48;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const getRowCount = (imp: ReportImport): number => {
    const fd = imp.final_data as { resultados?: unknown[]; transferencias?: unknown[]; doadoras?: unknown[]; rows?: unknown[] } | null;
    if (!fd) return 0;
    if (fd.resultados) return fd.resultados.length;
    if (fd.transferencias) return fd.transferencias.length;
    if (fd.doadoras) return fd.doadoras.length;
    if (fd.rows) return fd.rows.length;
    return 0;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader
        title="Histórico de Importações"
        description="Relatórios cadastrados via escritório — visualizar, filtrar e desfazer"
        icon={History}
      />

      {isLoading ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Carregando histórico...
          </CardContent>
        </Card>
      ) : imports.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12">
            <History className="w-10 h-10 text-muted-foreground/40" />
            <p className="text-muted-foreground">Nenhuma importação registrada ainda</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {imports.map(imp => (
            <Card key={imp.id} className={cn(imp.status === 'reverted' && 'opacity-60')}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Tipo + Data */}
                    <div>
                      <p className="font-medium text-sm">{typeLabels[imp.report_type] || imp.report_type}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(imp.created_at)}</p>
                    </div>

                    {/* Contagem */}
                    <div className="text-sm text-muted-foreground">
                      {getRowCount(imp)} registros
                    </div>

                    {/* Status badge */}
                    <span className={cn(
                      'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border',
                      statusStyles[imp.status] || 'bg-muted text-muted-foreground border-border',
                    )}>
                      {statusLabels[imp.status] || imp.status}
                    </span>

                    {/* Foto indicator */}
                    {imp.image_path && (
                      <span className="text-muted-foreground" title="Importado via OCR">
                        <Image className="w-4 h-4" />
                      </span>
                    )}
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-2">
                    {canRevert(imp) && confirmRevert !== imp.id && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmRevert(imp.id)}
                        disabled={isReverting}
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1" />
                        Desfazer
                      </Button>
                    )}
                    {confirmRevert === imp.id && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-amber-600 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Certeza?
                        </span>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRevert(imp.id)}
                          disabled={isReverting}
                        >
                          {isReverting ? 'Revertendo...' : 'Confirmar'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmRevert(null)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
