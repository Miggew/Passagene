import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { AspiracaoDoadora } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import CountBadge from '@/components/shared/CountBadge';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/utils';
import { DataTable } from '@/components/shared/DataTable';

interface DoadoraHistoricoAspiracoesProps {
  doadoraId: string;
  doadoraNome?: string;
  open: boolean;
  onClose: () => void;
}

export default function DoadoraHistoricoAspiracoes({
  doadoraId,
  doadoraNome,
  open,
  onClose,
}: DoadoraHistoricoAspiracoesProps) {
  const [aspiracoes, setAspiracoes] = useState<AspiracaoDoadora[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && doadoraId) {
      loadAspiracoes();
    }
  }, [open, doadoraId]);

  const loadAspiracoes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('aspiracoes_doadoras')
        .select('*')
        .eq('doadora_id', doadoraId)
        .order('data_aspiracao', { ascending: false });

      if (error) throw error;
      setAspiracoes(data || []);
    } catch (error) {
      toast({
        title: 'Erro ao carregar histórico',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Calcular estatísticas
  const stats = useMemo(() => {
    const total = aspiracoes.length;
    const totalOocitos = aspiracoes.reduce((sum, a) => sum + (a.total_oocitos || 0), 0);
    const mediaOocitos = total > 0 ? Math.round(totalOocitos / total) : 0;
    return { total, totalOocitos, mediaOocitos };
  }, [aspiracoes]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-base">
            Histórico de Aspirações {doadoraNome && `— ${doadoraNome}`}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="space-y-3">
            {/* Resumo inline */}
            <div className="flex items-center gap-4 pb-2 border-b border-border">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Total Aspirações:</span>
                <CountBadge value={stats.total} variant="default" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Total Oócitos:</span>
                <CountBadge value={stats.totalOocitos} variant="primary" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Média/Aspiração:</span>
                <CountBadge value={stats.mediaOocitos} variant="info" />
              </div>
            </div>

            <DataTable<AspiracaoDoadora>
              data={aspiracoes}
              rowKey="id"
              rowNumber
              emptyMessage="Nenhuma aspiração registrada para esta doadora"
              columns={[
                { key: 'data_aspiracao', label: 'Data' },
                { key: 'total_oocitos', label: 'Oócitos', align: 'center' },
                { key: 'veterinario_responsavel', label: 'Veterinário' },
                { key: 'tecnico_responsavel', label: 'Técnico' },
              ]}
              renderCell={(row, column) => {
                switch (column.key) {
                  case 'data_aspiracao':
                    return <span className="text-foreground">{formatDate(row.data_aspiracao)}</span>;
                  case 'total_oocitos':
                    return <CountBadge value={row.total_oocitos ?? 0} variant="primary" />;
                  case 'veterinario_responsavel':
                    return <span className="text-xs text-muted-foreground">{row.veterinario_responsavel || '—'}</span>;
                  case 'tecnico_responsavel':
                    return <span className="text-xs text-muted-foreground">{row.tecnico_responsavel || '—'}</span>;
                  default:
                    return null;
                }
              }}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
