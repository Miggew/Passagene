/**
 * Dialog para criar novo Lote FIV
 * Extraído de LotesFIV.tsx para melhor organização
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { DoseSemen, Fazenda, Cliente, AspiracaoDoadora, Doadora, LoteFIV } from '@/lib/types';
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

interface NovoLoteDialogProps {
  pacotes: PacoteComNomes[];
  clientes: Cliente[];
  fazendas: Fazenda[];
}

interface FormData {
  pacote_aspiracao_id: string;
  observacoes: string;
  doses_selecionadas: string[];
}

export function NovoLoteDialog({ pacotes, clientes, fazendas }: NovoLoteDialogProps) {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [showDialog, setShowDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    pacote_aspiracao_id: '',
    observacoes: '',
    doses_selecionadas: [],
  });
  const [selectedPacote, setSelectedPacote] = useState<PacoteComNomes | null>(null);
  const [doses, setDoses] = useState<DoseSemen[]>([]);
  const [aspiracoesDoadoras, setAspiracoesDoadoras] = useState<AspiracaoDoadora[]>([]);
  const [doadoras, setDoadoras] = useState<Doadora[]>([]);

  const handlePacoteChange = async (pacoteId: string) => {
    setFormData({ ...formData, pacote_aspiracao_id: pacoteId });
    const pacote = pacotes.find((p) => p.id === pacoteId);
    setSelectedPacote(pacote || null);

    if (pacote) {
      // Load aspirações doadoras do pacote
      const { data: aspiracoesData, error: aspiracoesError } = await supabase
        .from('aspiracoes_doadoras')
        .select('id, doadora_id, viaveis')
        .eq('pacote_aspiracao_id', pacoteId);

      if (aspiracoesError) {
        return;
      }

      setAspiracoesDoadoras(aspiracoesData || []);

      // Load doadoras
      const doadoraIds = [...new Set(aspiracoesData?.map((a) => a.doadora_id) || [])];
      if (doadoraIds.length > 0) {
        const { data: doadorasData, error: doadorasError } = await supabase
          .from('doadoras')
          .select('id, nome, registro')
          .in('id', doadoraIds);

        if (doadorasError) {
          return;
        }

        setDoadoras(doadorasData || []);
      }

      // Load doses com join com touros para obter nome do touro
      const { data: dosesData, error: dosesError } = await supabase
        .from('doses_semen')
        .select('id, cliente_id, touro_id, tipo_semen, quantidade, touro:touros(id, nome, registro, raca)')
        .order('created_at', { ascending: false });

      if (dosesError) {
        return;
      }

      setDoses(dosesData || []);
    }
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
      const dataPacote = new Date(selectedPacote.data_aspiracao);
      dataPacote.setDate(dataPacote.getDate() + 1);
      const dataAbertura = dataPacote.toISOString().split('T')[0];

      // Preparar dados do lote
      const loteDataToInsert: {
        pacote_aspiracao_id: string;
        data_abertura: string;
        data_fecundacao: string;
        status: string;
        observacoes: string | null;
        doses_selecionadas?: string[];
      } = {
        pacote_aspiracao_id: formData.pacote_aspiracao_id,
        data_abertura: dataAbertura,
        data_fecundacao: dataAbertura,
        status: 'ABERTO',
        observacoes: formData.observacoes || null,
      };

      // Tentar adicionar doses_selecionadas apenas se houver doses selecionadas
      if (formData.doses_selecionadas && formData.doses_selecionadas.length > 0) {
        try {
          loteDataToInsert.doses_selecionadas = formData.doses_selecionadas;
        } catch {
          // Campo doses_selecionadas não disponível
        }
      }

      let loteData: LoteFIV;
      const { data: loteDataInsert, error: loteError } = await supabase
        .from('lotes_fiv')
        .insert([loteDataToInsert])
        .select()
        .single();

      if (loteError) {
        // Se o erro for relacionado ao campo doses_selecionadas, tentar novamente sem ele
        if (loteError.message?.includes('doses_selecionadas') || loteError.code === '42703') {
          delete loteDataToInsert.doses_selecionadas;

          const { data: loteDataRetry, error: loteErrorRetry } = await supabase
            .from('lotes_fiv')
            .insert([loteDataToInsert])
            .select()
            .single();

          if (loteErrorRetry) {
            throw loteErrorRetry;
          }

          loteData = loteDataRetry;
        } else {
          throw loteError;
        }
      } else {
        loteData = loteDataInsert;
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
      doses_selecionadas: [],
    });
    setSelectedPacote(null);
    setAspiracoesDoadoras([]);
    setDoadoras([]);
    setDoses([]);
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
              <div className="border rounded-lg p-4 bg-yellow-50 border-yellow-200">
                <p className="text-sm text-yellow-800 font-medium mb-2">
                  Nenhum pacote disponível
                </p>
                <p className="text-sm text-yellow-700">
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
              <div className="text-sm text-slate-600 space-y-1 mt-2 p-3 bg-slate-50 rounded-lg">
                <p>
                  <strong>Data do Pacote:</strong> {formatDate(selectedPacote.data_aspiracao)}
                </p>
                <p>
                  <strong>Data de Fecundação do Lote:</strong>{' '}
                  {(() => {
                    const dataPacote = new Date(selectedPacote.data_aspiracao);
                    dataPacote.setDate(dataPacote.getDate() + 1);
                    return formatDate(dataPacote.toISOString().split('T')[0]);
                  })()}
                </p>
                <p>
                  <strong>Fazendas Destino:</strong>{' '}
                  {selectedPacote.fazendas_destino_nomes?.join(', ') || 'Nenhuma'}
                </p>
                <p>
                  <strong>Quantidade de Doadoras:</strong> {selectedPacote.quantidade_doadoras || 0}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Doses de Sêmen Disponíveis no Lote *</Label>
            <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
              {doses.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {selectedPacote ? 'Carregando doses...' : 'Selecione um pacote primeiro'}
                </p>
              ) : (
                <div className="space-y-2">
                  {doses.map((dose) => {
                    const cliente = clientes.find((c) => c.id === dose.cliente_id);
                    const isSelected = formData.doses_selecionadas.includes(dose.id);
                    return (
                      <div key={dose.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`dose-${dose.id}`}
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                doses_selecionadas: [...formData.doses_selecionadas, dose.id],
                              });
                            } else {
                              setFormData({
                                ...formData,
                                doses_selecionadas: formData.doses_selecionadas.filter((id) => id !== dose.id),
                              });
                            }
                          }}
                          className="rounded"
                        />
                        <label htmlFor={`dose-${dose.id}`} className="text-sm cursor-pointer flex-1">
                          <span className="font-medium">{dose.touro?.nome || 'Touro desconhecido'}</span>
                          {dose.touro?.registro && <span className="text-slate-500 ml-2">({dose.touro.registro})</span>}
                          {cliente && <span className="text-slate-500 ml-2">- {cliente.nome}</span>}
                        </label>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Selecione as doses de sêmen que estarão disponíveis para uso neste lote
            </p>
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
