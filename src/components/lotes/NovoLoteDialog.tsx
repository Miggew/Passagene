/**
 * Dialog para criar novo Lote FIV
 * Extraído de LotesFIV.tsx para melhor organização
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Fazenda } from '@/lib/types';
import { PacoteComNomes } from '@/lib/types/lotesFiv';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { addDays } from '@/lib/dateUtils';

interface NovoLoteDialogProps {
  pacotes: PacoteComNomes[];
  clientes: never[];
  fazendas: Fazenda[];
}

interface FormData {
  pacote_aspiracao_id: string;
  observacoes: string;
}

export function NovoLoteDialog({ pacotes, fazendas }: NovoLoteDialogProps) {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [showDialog, setShowDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    pacote_aspiracao_id: '',
    observacoes: '',
  });
  const [selectedPacote, setSelectedPacote] = useState<PacoteComNomes | null>(null);

  const handlePacoteChange = (pacoteId: string) => {
    setFormData({ ...formData, pacote_aspiracao_id: pacoteId });
    const pacote = pacotes.find((p) => p.id === pacoteId);
    setSelectedPacote(pacote || null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.pacote_aspiracao_id) {
      toast({
        title: 'Erro de validação',
        description: 'Pacote de aspiração é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedPacote) {
      toast({
        title: 'Erro de validação',
        description: 'Pacote selecionado não encontrado',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      // Verificar se o pacote existe antes de criar o lote
      const { data: pacoteVerificado, error: pacoteError } = await supabase
        .from('pacotes_aspiracao')
        .select('id, status')
        .eq('id', formData.pacote_aspiracao_id)
        .single();

      if (pacoteError || !pacoteVerificado) {
        toast({
          title: 'Erro de validação',
          description: 'Pacote de aspiração não encontrado ou inválido',
          variant: 'destructive',
        });
        return;
      }

      if (pacoteVerificado.status !== 'FINALIZADO') {
        toast({
          title: 'Erro de validação',
          description: 'Apenas pacotes FINALIZADOS podem ser usados para criar lotes FIV',
          variant: 'destructive',
        });
        return;
      }

      // Calcular data_abertura = data do pacote + 1 dia
      const dataAbertura = addDays(selectedPacote.data_aspiracao, 1);

      const loteDataToInsert = {
        pacote_aspiracao_id: formData.pacote_aspiracao_id,
        data_abertura: dataAbertura,
        data_fecundacao: dataAbertura,
        status: 'ABERTO',
        observacoes: formData.observacoes || null,
      };

      const { data: loteData, error: loteError } = await supabase
        .from('lotes_fiv')
        .insert([loteDataToInsert])
        .select()
        .single();

      if (loteError) {
        throw loteError;
      }

      // Inserir fazendas destino do pacote no lote
      const fazendasDestinoIds = selectedPacote.fazendas_destino_nomes
        ?.map((nome) => {
          const fazenda = fazendas.find((f) => f.nome === nome);
          return fazenda?.id;
        })
        .filter((id): id is string => !!id);

      if (fazendasDestinoIds && fazendasDestinoIds.length > 0) {
        const { error: fazendasError } = await supabase.from('lote_fiv_fazendas_destino').insert(
          fazendasDestinoIds.map((fazendaId) => ({
            lote_fiv_id: loteData.id,
            fazenda_id: fazendaId,
          }))
        );

        if (fazendasError) throw fazendasError;
      }

      // Marcar pacote como usado em lote FIV
      try {
        await supabase
          .from('pacotes_aspiracao')
          .update({ usado_em_lote_fiv: true })
          .eq('id', formData.pacote_aspiracao_id);
      } catch {
        // Se o campo não existir, apenas ignorar
      }

      toast({
        title: 'Lote FIV criado',
        description: 'Lote FIV criado com sucesso. Agora você pode adicionar acasalamentos.',
      });

      // Resetar estado
      setShowDialog(false);
      resetForm();

      // Navegar para o detalhe do lote
      navigate(`/lotes-fiv/${loteData.id}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao criar lote',
        description: errorMessage.includes('RLS') || errorMessage.includes('policy')
          ? 'RLS está bloqueando escrita. Configure políticas anon no Supabase.'
          : errorMessage,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      pacote_aspiracao_id: '',
      observacoes: '',
    });
    setSelectedPacote(null);
  };

  const handleCancel = () => {
    setShowDialog(false);
    resetForm();
  };

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Novo Lote
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Novo Lote FIV</DialogTitle>
          <DialogDescription>
            Selecione um pacote de aspiração FINALIZADO para criar o lote
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pacote_aspiracao_id">Pacote de Aspiração *</Label>
            {pacotes.length === 0 ? (
              <div className="border rounded-lg p-4 bg-warning/10 border-warning/30">
                <p className="text-sm font-medium mb-2">
                  Nenhum pacote disponível
                </p>
                <p className="text-sm text-muted-foreground">
                  Verifique se o pacote de aspiração está com status <strong>FINALIZADO</strong> e ainda não foi usado para criar um lote FIV.
                </p>
              </div>
            ) : (
              <Select
                value={formData.pacote_aspiracao_id}
                onValueChange={handlePacoteChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o pacote" />
                </SelectTrigger>
                <SelectContent>
                  {pacotes.map((pacote) => (
                    <SelectItem key={pacote.id} value={pacote.id}>
                      {formatDate(pacote.data_aspiracao)} - {pacote.fazenda_nome} ({pacote.quantidade_doadoras} doadoras)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {selectedPacote && (
              <div className="text-sm text-muted-foreground space-y-1 mt-2 p-3 bg-muted rounded-lg">
                <p>
                  <strong className="text-foreground">Data do Pacote:</strong> {formatDate(selectedPacote.data_aspiracao)}
                </p>
                <p>
                  <strong className="text-foreground">Data de Fecundação do Lote:</strong>{' '}
                  {formatDate(addDays(selectedPacote.data_aspiracao, 1))}
                </p>
                <p>
                  <strong className="text-foreground">Fazendas Destino:</strong>{' '}
                  {selectedPacote.fazendas_destino_nomes?.join(', ') || 'Nenhuma'}
                </p>
                <p>
                  <strong className="text-foreground">Quantidade de Doadoras:</strong> {selectedPacote.quantidade_doadoras || 0}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              placeholder="Observações sobre o lote"
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="submit"
              className="flex-1"
              disabled={submitting}
            >
              {submitting ? 'Criando...' : 'Criar Lote'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={submitting}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
