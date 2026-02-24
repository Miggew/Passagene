/**
 * Dialog para criar novo Lote FIV
 * Extraído de LotesFIV.tsx para melhor organização
 */

import { useState, useEffect } from 'react';
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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Plus, Check, ChevronsUpDown, X } from 'lucide-react';
import { formatDate, cn } from '@/lib/utils';
import { addDays } from '@/lib/dateUtils';

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
  const [touroComboboxOpen, setTouroComboboxOpen] = useState(false);
  const [touroSelecionadoId, setTouroSelecionadoId] = useState<string>('');

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

  // Auto-select quando há apenas 1 proprietário para o touro selecionado
  useEffect(() => {
    if (!touroSelecionadoId || doses.length === 0) return;

    const dosesDoTouro = doses.filter((d) => (d.touro_id || 'sem-touro') === touroSelecionadoId);
    if (dosesDoTouro.length === 1) {
      const doseId = dosesDoTouro[0].id;
      if (!formData.doses_selecionadas.includes(doseId)) {
        setFormData((prev) => ({
          ...prev,
          doses_selecionadas: [...prev.doses_selecionadas, doseId],
        }));
      }
    }
  }, [touroSelecionadoId, doses]); // eslint-disable-line react-hooks/exhaustive-deps

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

    if (formData.doses_selecionadas.length === 0) {
      toast({
        title: 'Atenção',
        description: 'Nenhuma dose de sêmen selecionada. Selecione ao menos uma dose ou continue sem.',
      });
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

      // Preparar dados do lote (sem doses_selecionadas — campo pode não existir na tabela)
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
      doses_selecionadas: [],
    });
    setSelectedPacote(null);
    setAspiracoesDoadoras([]);
    setDoadoras([]);
    setDoses([]);
    setTouroSelecionadoId('');
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
            <Label>Doses de Sêmen Disponíveis no Lote</Label>
            {doses.length === 0 ? (
              <div className="border rounded-lg p-4 bg-muted">
                <p className="text-sm text-muted-foreground">
                  {selectedPacote ? 'Carregando doses...' : 'Selecione um pacote primeiro'}
                </p>
              </div>
            ) : (
              <>
                {/* Seleção em cascata: Touro -> Proprietário */}
                {(() => {
                  // Agrupar doses por touro
                  const dosesPorTouro = doses.reduce((acc, dose) => {
                    const touroId = dose.touro_id || 'sem-touro';
                    if (!acc[touroId]) {
                      acc[touroId] = [];
                    }
                    acc[touroId].push(dose);
                    return acc;
                  }, {} as Record<string, DoseSemen[]>);

                  // Lista única de touros
                  const tourosUnicos = Object.entries(dosesPorTouro).map(([touroId, dosesDoTouro]) => ({
                    id: touroId,
                    nome: dosesDoTouro[0].touro?.nome || 'Touro desconhecido',
                    registro: dosesDoTouro[0].touro?.registro,
                    doses: dosesDoTouro,
                  }));

                  // Touro selecionado
                  const touroAtual = tourosUnicos.find((t) => t.id === touroSelecionadoId);
                  const dosesDoTouro = touroAtual?.doses || [];

                  return (
                    <div className="space-y-3">
                      {/* Passo 1: Buscar Touro */}
                      <div className="space-y-1.5">
                        <span className="text-xs text-muted-foreground">1. Buscar touro</span>
                        <Popover open={touroComboboxOpen} onOpenChange={setTouroComboboxOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={touroComboboxOpen}
                              className="w-full justify-between font-normal"
                            >
                              {touroAtual ? (
                                <span className="truncate">
                                  {touroAtual.nome}
                                  {touroAtual.registro && ` (${touroAtual.registro})`}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">Buscar touro por nome ou registro...</span>
                              )}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[400px] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Buscar touro por nome ou registro..." />
                              <CommandList>
                                <CommandEmpty>Nenhum touro encontrado.</CommandEmpty>
                                <CommandGroup>
                                  {tourosUnicos.map((touro) => (
                                    <CommandItem
                                      key={touro.id}
                                      value={`${touro.nome} ${touro.registro || ''}`}
                                      onSelect={() => {
                                        setTouroSelecionadoId(touro.id);
                                        setTouroComboboxOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          touroSelecionadoId === touro.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <span className="truncate">
                                        {touro.nome}
                                        {touro.registro && (
                                          <span className="text-muted-foreground ml-1">({touro.registro})</span>
                                        )}
                                      </span>
                                      <span className="ml-auto text-xs text-muted-foreground">
                                        {touro.doses.length} {touro.doses.length === 1 ? 'dose' : 'doses'}
                                      </span>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Passo 2: Selecionar proprietário do sêmen (checkboxes) */}
                      {touroSelecionadoId && dosesDoTouro.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-xs text-muted-foreground">
                            2. Selecionar proprietário do sêmen
                            {dosesDoTouro.length === 1 && ' (auto-selecionado)'}
                          </span>
                          <div className="border border-border rounded-lg p-3 bg-muted space-y-2">
                            {dosesDoTouro.map((dose) => {
                              const cliente = clientes.find((c) => c.id === dose.cliente_id);
                              const isSelected = formData.doses_selecionadas.includes(dose.id);
                              return (
                                <div key={dose.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`dose-${dose.id}`}
                                    checked={isSelected}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
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
                                  />
                                  <label htmlFor={`dose-${dose.id}`} className="text-sm cursor-pointer flex-1">
                                    {cliente?.nome || 'Sem cliente'}
                                  </label>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Lista de doses selecionadas */}
                {formData.doses_selecionadas.length > 0 && (
                  <div className="space-y-1.5 mt-4">
                    <span className="text-xs text-muted-foreground">
                      Doses selecionadas ({formData.doses_selecionadas.length})
                    </span>
                    <div className="border border-border rounded-lg p-3 bg-success/10 space-y-1.5 max-h-40 overflow-y-auto">
                      {formData.doses_selecionadas.map((doseId) => {
                        const dose = doses.find((d) => d.id === doseId);
                        const cliente = dose ? clientes.find((c) => c.id === dose.cliente_id) : null;
                        if (!dose) return null;
                        return (
                          <div key={doseId} className="flex items-center justify-between text-sm">
                            <span>
                              <span className="font-medium">{dose.touro?.nome || 'Touro'}</span>
                              {dose.touro?.registro && (
                                <span className="text-muted-foreground ml-1">({dose.touro.registro})</span>
                              )}
                              <span className="text-muted-foreground ml-1">- {cliente?.nome || 'Sem cliente'}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setFormData({
                                  ...formData,
                                  doses_selecionadas: formData.doses_selecionadas.filter((id) => id !== doseId),
                                });
                              }}
                              className="text-danger hover:text-danger/80 p-1"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
            <p className="text-xs text-muted-foreground">
              Busque o touro e selecione o proprietário do sêmen para este lote
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
