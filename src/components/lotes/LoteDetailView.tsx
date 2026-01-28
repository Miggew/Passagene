/**
 * Componente para exibir detalhes de um Lote FIV
 * Extraído de LotesFIV.tsx para melhor organização
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { DoseSemen, Doadora, Cliente } from '@/lib/types';
import {
  LoteFIVComNomes,
  AcasalamentoComNomes,
  AspiracaoComOocitosDisponiveis,
  HistoricoDespacho,
} from '@/lib/types/lotesFiv';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Lock, X, Users, FileText, Package, Plus } from 'lucide-react';
import { formatDate, extractDateOnly, addDays, diffDays, formatDateString, getDayOfWeekName, getTodayDateString } from '@/lib/utils';
import { getDiaCultivo } from '@/lib/lotesFivUtils';

interface LoteDetailViewProps {
  lote: LoteFIVComNomes;
  acasalamentos: AcasalamentoComNomes[];
  aspiracoesDisponiveis: AspiracaoComOocitosDisponiveis[];
  dosesDisponiveis: DoseSemen[];
  dosesDisponiveisNoLote: DoseSemen[];
  doadoras: Doadora[];
  clientes: Cliente[];
  historicoDespachos: HistoricoDespacho[];
  dataAspiracao: string;
  fazendaOrigemNome: string;
  fazendasDestinoNomes: string[];
  submitting: boolean;
  onBack: () => void;
  onAddAcasalamento: (form: AcasalamentoForm) => Promise<void>;
  onDespacharEmbrioes: () => Promise<void>;
  onUpdateQuantidadeEmbrioes: (acasalamentoId: string, quantidade: string) => void;
  editQuantidadeEmbrioes: { [key: string]: string };
  onUpdateClivados?: (acasalamentoId: string, quantidade: string) => void;
  editClivados?: { [key: string]: string };
}

export interface AcasalamentoForm {
  aspiracao_doadora_id: string;
  dose_semen_id: string;
  quantidade_fracionada: string;
  quantidade_oocitos: string;
  observacoes: string;
}

/**
 * Função local para nome do dia (usa nomes simplificados)
 */
function getNomeDiaDetalhe(dia: number): string {
  const nomes: { [key: number]: string } = {
    [-1]: 'Aspiração',
    0: 'Fecundação',
    1: 'Zigoto',
    2: '2 Células',
    3: '4 Células',
    4: '8 Células',
    5: 'Mórula',
    6: 'Blastocisto',
    7: 'Blastocisto Expandido',
    8: 'Blastocisto Expandido',
  };
  return nomes[dia] || `D${dia}`;
}

export function LoteDetailView({
  lote,
  acasalamentos,
  aspiracoesDisponiveis,
  dosesDisponiveis,
  dosesDisponiveisNoLote,
  doadoras,
  clientes,
  historicoDespachos,
  dataAspiracao,
  fazendaOrigemNome,
  fazendasDestinoNomes,
  submitting,
  onBack,
  onAddAcasalamento,
  onDespacharEmbrioes,
  onUpdateQuantidadeEmbrioes,
  editQuantidadeEmbrioes,
  onUpdateClivados,
  editClivados = {},
}: LoteDetailViewProps) {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Estados locais do componente
  const [showAddAcasalamento, setShowAddAcasalamento] = useState(false);
  const [showRelatorioDialog, setShowRelatorioDialog] = useState(false);
  const [recomendacaoAspiracaoSelecionada, setRecomendacaoAspiracaoSelecionada] = useState('');
  const [acasalamentoForm, setAcasalamentoForm] = useState<AcasalamentoForm>({
    aspiracao_doadora_id: '',
    dose_semen_id: '',
    quantidade_fracionada: '1.0',
    quantidade_oocitos: '',
    observacoes: '',
  });

  // Calcular data da aspiração
  let dataAspiracaoStr = extractDateOnly(dataAspiracao || lote.pacote_data || null);

  if (!dataAspiracaoStr) {
    const dataAberturaStr = extractDateOnly(lote.data_abertura);
    if (dataAberturaStr) {
      const [year, month, day] = dataAberturaStr.split('-').map(Number);
      const dataAberturaDate = new Date(year, month - 1, day);
      dataAberturaDate.setDate(dataAberturaDate.getDate() - 1);
      dataAspiracaoStr = `${dataAberturaDate.getFullYear()}-${String(dataAberturaDate.getMonth() + 1).padStart(2, '0')}-${String(dataAberturaDate.getDate()).padStart(2, '0')}`;
    }
  }

  if (!dataAspiracaoStr) {
    return <div>Erro: Data de aspiração não encontrada</div>;
  }

  const hojeStr = getTodayDateString();
  const diaAtual = Math.max(0, diffDays(dataAspiracaoStr, hojeStr));
  const diaCultivo = getDiaCultivo(diaAtual);
  const dataD7Str = addDays(dataAspiracaoStr, 8);
  const dataD7Formatada = formatDateString(dataD7Str);
  const diaSemanaD7 = getDayOfWeekName(dataD7Str);

  const handleAddAcasalamentoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!acasalamentoForm.aspiracao_doadora_id) {
      toast({
        title: 'Erro de validação',
        description: 'Doadora é obrigatória',
        variant: 'destructive',
      });
      return;
    }

    if (!acasalamentoForm.dose_semen_id) {
      toast({
        title: 'Erro de validação',
        description: 'Selecione uma dose de sêmen',
        variant: 'destructive',
      });
      return;
    }

    const quantidadeFracionada = parseFloat(acasalamentoForm.quantidade_fracionada) || 0;
    if (quantidadeFracionada <= 0) {
      toast({
        title: 'Erro de validação',
        description: 'Quantidade fracionada deve ser maior que zero',
        variant: 'destructive',
      });
      return;
    }

    try {
      await onAddAcasalamento(acasalamentoForm);
      setShowAddAcasalamento(false);
      setAcasalamentoForm({
        aspiracao_doadora_id: '',
        dose_semen_id: '',
        quantidade_fracionada: '1.0',
        quantidade_oocitos: '',
        observacoes: '',
      });
      setRecomendacaoAspiracaoSelecionada('');
    } catch (error) {
      // Erro tratado pelo pai
    }
  };

  const handleBackClick = () => {
    onBack();
    navigate('/lotes-fiv');
  };

  // Encontrar doadora pelo ID da aspiração
  const getDoadoraByAspiracaoId = (aspiracaoId: string) => {
    const aspiracao = aspiracoesDisponiveis.find((a) => a.id === aspiracaoId);
    if (!aspiracao) return null;
    return doadoras.find((d) => d.id === aspiracao.doadora_id);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={handleBackClick}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Detalhes do Lote FIV</h1>
          <div className="text-slate-600 mt-1 flex items-center gap-2">
            <span>
              Data de fecundação (D0): {formatDate(lote.data_abertura)} |
              {dataAspiracaoStr && ` Data aspiração (D-1): ${formatDateString(dataAspiracaoStr)} |`}
              {(() => {
                return diaCultivo === -1
                  ? ` D-1 - ${getNomeDiaDetalhe(diaCultivo)} |`
                  : ` D${diaCultivo} - ${getNomeDiaDetalhe(diaCultivo)} |`;
              })()}
              {' '}Status:
            </span>
            <Badge variant={lote.status === 'FECHADO' ? 'default' : 'secondary'}>
              {lote.status}
            </Badge>
          </div>
        </div>
      </div>

      {/* Card de informações */}
      <Card>
        <CardHeader>
          <CardTitle>Informações do Lote</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Dia Atual</Label>
              <p className="text-2xl font-bold">
                {diaCultivo === -1 ? (
                  <>D-1 <span className="text-lg font-normal text-slate-600">- {getNomeDiaDetalhe(diaCultivo)}</span></>
                ) : (
                  <>D{diaCultivo} <span className="text-lg font-normal text-slate-600">- {getNomeDiaDetalhe(diaCultivo)}</span></>
                )}
              </p>
            </div>
            <div>
              <Label>Data da TE</Label>
              {diaAtual < 7 ? (
                <div>
                  <p className="text-2xl font-bold text-orange-600">{dataD7Formatada}</p>
                  <p className="text-sm text-slate-500">{diaSemanaD7}</p>
                </div>
              ) : (
                <p className="text-2xl font-bold text-green-600">Hoje ou passou</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Fazenda de Origem</Label>
              <p className="font-medium">{fazendaOrigemNome || lote.pacote_nome || '-'}</p>
            </div>
            <div>
              <Label>Fazendas de Destino</Label>
              <p className="font-medium">
                {fazendasDestinoNomes.length > 0
                  ? fazendasDestinoNomes.join(', ')
                  : lote.fazendas_destino_nomes?.join(', ') || '-'}
              </p>
            </div>
          </div>

          {lote.observacoes && (
            <div>
              <Label>Observações</Label>
              <p className="text-slate-600">{lote.observacoes}</p>
            </div>
          )}

          {/* Alerta D6 */}
          {lote.status === 'ABERTO' && diaAtual === 7 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <p className="text-blue-800 font-medium">
                  📊 Este lote está no D6 ({getNomeDiaDetalhe(6)}). Você pode preencher a quantidade de embriões (prévia) e gerar um relatório.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRelatorioDialog(true)}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Gerar Relatório de Prévia
                </Button>
              </div>
            </div>
          )}

          {/* Alerta D7/D8 */}
          {((lote.status === 'ABERTO' && (diaAtual === 8 || diaAtual === 9)) || (lote.status === 'FECHADO' && diaAtual === 9)) && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <p className="text-orange-800 font-medium">
                  ⚠️ Este lote está no {diaAtual === 8 ? 'D7' : 'D8'} ({getNomeDiaDetalhe(diaAtual === 8 ? 7 : 8)}). {diaAtual === 8 ? 'Informe a quantidade de embriões para cada acasalamento e despache os embriões.' : 'Período de emergência (D8). Você pode adicionar novos acasalamentos e despachar os embriões imediatamente.'}
                </p>
                <Button
                  variant="default"
                  size="sm"
                  onClick={onDespacharEmbrioes}
                  disabled={submitting}
                >
                  <Package className="w-4 h-4 mr-2" />
                  {submitting ? 'Despachando...' : 'Despachar Todos os Embriões'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabela de acasalamentos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Acasalamentos ({acasalamentos.length})
            </CardTitle>
            {lote.status === 'ABERTO' && (
              <Button
                size="sm"
                onClick={() => setShowAddAcasalamento(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Acasalamento
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {acasalamentos.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Nenhum acasalamento cadastrado</p>
              {lote.status === 'ABERTO' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => setShowAddAcasalamento(true)}
                >
                  Adicionar primeiro acasalamento
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Doadora</TableHead>
                  <TableHead>Touro</TableHead>
                  <TableHead className="text-center">Oócitos</TableHead>
                  <TableHead className="text-center">D3 Clivados</TableHead>
                  <TableHead className="text-center">Qtd. Embriões</TableHead>
                  <TableHead className="text-center">%</TableHead>
                  <TableHead>Observações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {acasalamentos.map((acasalamento) => {
                  const quantidadeOocitos = acasalamento.viaveis || 0;
                  // Clivados: usa valor editado, ou valor salvo, ou vazio
                  const clivadosEditado = editClivados[acasalamento.id];
                  const clivadosSalvo = acasalamento.embrioes_clivados_d3;
                  const clivadosValor = clivadosEditado !== undefined ? clivadosEditado : (clivadosSalvo?.toString() ?? '');
                  const clivadosNumero = parseInt(clivadosValor) || 0;

                  // Limite para embriões: usa clivados se preenchido, senão oócitos
                  const limiteEmbrioes = clivadosNumero > 0 ? clivadosNumero : quantidadeOocitos;

                  const quantidadeEmbrioes =
                    editQuantidadeEmbrioes[acasalamento.id] !== undefined
                      ? parseInt(editQuantidadeEmbrioes[acasalamento.id]) || 0
                      : acasalamento.total_embrioes_produzidos || 0;

                  // Percentual sobre oócitos (original)
                  const percentual = quantidadeOocitos > 0 ? ((quantidadeEmbrioes / quantidadeOocitos) * 100).toFixed(1) : '0.0';

                  return (
                    <TableRow key={acasalamento.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{acasalamento.doadora_registro || '-'}</p>
                          {acasalamento.doadora_nome && (
                            <p className="text-sm text-slate-500">{acasalamento.doadora_nome}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{acasalamento.dose_nome || '-'}</TableCell>
                      <TableCell className="text-center">{quantidadeOocitos}</TableCell>
                      <TableCell className="text-center">
                        {lote.status === 'ABERTO' && diaCultivo >= 3 && onUpdateClivados ? (
                          <Input
                            type="number"
                            min="0"
                            max={quantidadeOocitos}
                            className="w-20 text-center"
                            value={clivadosValor}
                            onChange={(e) => onUpdateClivados(acasalamento.id, e.target.value)}
                            placeholder="-"
                          />
                        ) : (
                          <span>{clivadosNumero > 0 ? clivadosNumero : '-'}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {lote.status === 'ABERTO' && diaAtual >= 7 ? (
                          <Input
                            type="number"
                            min="0"
                            max={limiteEmbrioes}
                            className="w-20 text-center"
                            value={editQuantidadeEmbrioes[acasalamento.id] ?? acasalamento.total_embrioes_produzidos ?? ''}
                            onChange={(e) => onUpdateQuantidadeEmbrioes(acasalamento.id, e.target.value)}
                            placeholder="0"
                          />
                        ) : (
                          <span>{quantidadeEmbrioes}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={parseFloat(percentual) >= 30 ? 'default' : 'secondary'}>
                          {percentual}%
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {acasalamento.observacoes || '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Histórico de despachos */}
      {historicoDespachos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Histórico de Despachos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {historicoDespachos.map((despacho) => (
                <div key={despacho.id} className="border rounded-lg p-4">
                  <p className="font-medium mb-2">
                    Despacho em {formatDateString(despacho.data_despacho)}
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {despacho.acasalamentos.map((ac, idx) => (
                      <div key={idx} className="text-sm bg-slate-50 rounded p-2">
                        <span className="font-medium">{ac.doadora}</span>
                        <span className="text-slate-500"> x {ac.dose}</span>
                        <span className="ml-2 text-green-600 font-medium">({ac.quantidade})</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog: Adicionar Acasalamento */}
      <Dialog open={showAddAcasalamento} onOpenChange={setShowAddAcasalamento}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar Acasalamento</DialogTitle>
            <DialogDescription>
              Selecione a doadora e a dose de sêmen para o acasalamento
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddAcasalamentoSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Doadora *</Label>
              <Select
                value={acasalamentoForm.aspiracao_doadora_id}
                onValueChange={(value) => {
                  setAcasalamentoForm({ ...acasalamentoForm, aspiracao_doadora_id: value });
                  const aspiracao = aspiracoesDisponiveis.find((a) => a.id === value);
                  if (aspiracao) {
                    setAcasalamentoForm((prev) => ({
                      ...prev,
                      aspiracao_doadora_id: value,
                      quantidade_oocitos: String(aspiracao.oocitos_disponiveis || aspiracao.viaveis || 0),
                    }));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a doadora" />
                </SelectTrigger>
                <SelectContent>
                  {aspiracoesDisponiveis.map((aspiracao) => {
                    const doadora = doadoras.find((d) => d.id === aspiracao.doadora_id);
                    return (
                      <SelectItem key={aspiracao.id} value={aspiracao.id}>
                        {doadora?.registro || doadora?.nome || 'Doadora'} - {aspiracao.oocitos_disponiveis ?? aspiracao.viaveis ?? 0} oócitos disponíveis
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Dose de Sêmen *</Label>
              <Select
                value={acasalamentoForm.dose_semen_id}
                onValueChange={(value) => setAcasalamentoForm({ ...acasalamentoForm, dose_semen_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a dose" />
                </SelectTrigger>
                <SelectContent>
                  {(dosesDisponiveisNoLote.length > 0 ? dosesDisponiveisNoLote : dosesDisponiveis).map((dose) => {
                    const cliente = clientes.find((c) => c.id === dose.cliente_id);
                    return (
                      <SelectItem key={dose.id} value={dose.id}>
                        {dose.touro?.nome || 'Touro desconhecido'}
                        {dose.touro?.registro && ` (${dose.touro.registro})`}
                        {cliente && ` - ${cliente.nome}`}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Qtd. Fracionada</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={acasalamentoForm.quantidade_fracionada}
                  onChange={(e) => setAcasalamentoForm({ ...acasalamentoForm, quantidade_fracionada: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Qtd. Oócitos</Label>
                <Input
                  type="number"
                  min="0"
                  value={acasalamentoForm.quantidade_oocitos}
                  onChange={(e) => setAcasalamentoForm({ ...acasalamentoForm, quantidade_oocitos: e.target.value })}
                  placeholder="Auto"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={acasalamentoForm.observacoes}
                onChange={(e) => setAcasalamentoForm({ ...acasalamentoForm, observacoes: e.target.value })}
                placeholder="Observações sobre o acasalamento"
                rows={2}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1" disabled={submitting}>
                {submitting ? 'Adicionando...' : 'Adicionar'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAddAcasalamento(false);
                  setAcasalamentoForm({
                    aspiracao_doadora_id: '',
                    dose_semen_id: '',
                    quantidade_fracionada: '1.0',
                    quantidade_oocitos: '',
                    observacoes: '',
                  });
                }}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Relatório de Prévia */}
      <Dialog open={showRelatorioDialog} onOpenChange={setShowRelatorioDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Relatório de Prévia - D6</DialogTitle>
            <DialogDescription>
              Resumo dos acasalamentos e embriões previstos
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border rounded-lg p-4 bg-slate-50">
              <h4 className="font-medium mb-2">Informações do Lote</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <p><span className="text-slate-500">Fazenda Origem:</span> {fazendaOrigemNome || lote.pacote_nome}</p>
                <p><span className="text-slate-500">Fazendas Destino:</span> {fazendasDestinoNomes.join(', ') || '-'}</p>
                <p><span className="text-slate-500">Data TE prevista:</span> {dataD7Formatada}</p>
                <p><span className="text-slate-500">Total Acasalamentos:</span> {acasalamentos.length}</p>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Doadora</TableHead>
                  <TableHead>Touro</TableHead>
                  <TableHead className="text-center">Oócitos</TableHead>
                  <TableHead className="text-center">Embriões (prev.)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {acasalamentos.map((ac) => (
                  <TableRow key={ac.id}>
                    <TableCell>{ac.doadora_registro || '-'}</TableCell>
                    <TableCell>{ac.dose_nome || '-'}</TableCell>
                    <TableCell className="text-center">{ac.viaveis || 0}</TableCell>
                    <TableCell className="text-center">
                      {editQuantidadeEmbrioes[ac.id] ?? ac.total_embrioes_produzidos ?? '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex justify-end">
              <Button onClick={() => setShowRelatorioDialog(false)}>Fechar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
