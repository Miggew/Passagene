import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { AspiracaoDoadora } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/utils';

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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico de Aspirações</DialogTitle>
          <DialogDescription>
            {doadoraNome ? `Aspirações da doadora: ${doadoraNome}` : 'Histórico completo de aspirações'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="mt-4">
            {aspiracoes.length === 0 ? (
              <p className="text-center text-slate-500 py-8">
                Nenhuma aspiração registrada para esta doadora
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Quantidade de Oócitos</TableHead>
                    <TableHead>Veterinário</TableHead>
                    <TableHead>Técnico</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aspiracoes.map((aspiracao) => (
                    <TableRow key={aspiracao.id}>
                      <TableCell>{formatDate(aspiracao.data_aspiracao)}</TableCell>
                      <TableCell className="font-medium">
                        {aspiracao.total_oocitos ?? '-'}
                      </TableCell>
                      <TableCell>{aspiracao.veterinario_responsavel || '-'}</TableCell>
                      <TableCell>{aspiracao.tecnico_responsavel || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
