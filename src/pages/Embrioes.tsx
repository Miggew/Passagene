import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Embriao, Fazenda } from '@/lib/types';
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
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import StatusBadge from '@/components/shared/StatusBadge';
import { useToast } from '@/hooks/use-toast';
import { Snowflake, ArrowRightLeft, Tag, MapPin, Trash2, History } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { HistoricoEmbriao } from '@/lib/types';

interface EmbrioCompleto extends Embriao {
  doadora_registro?: string;
  touro_nome?: string;
  fazenda_destino_nome?: string;
}

export default function Embrioes() {
  const navigate = useNavigate();
  const [embrioes, setEmbrioes] = useState<EmbrioCompleto[]>([]);
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCongelarDialog, setShowCongelarDialog] = useState(false);
  const [showClassificarDialog, setShowClassificarDialog] = useState(false);
  const [showDestinarDialog, setShowDestinarDialog] = useState(false);
  const [showDescartarDialog, setShowDescartarDialog] = useState(false);
  const [showHistoricoDialog, setShowHistoricoDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [congelarEmbriao, setCongelarEmbriao] = useState<Embriao | null>(null);
  const [classificarEmbriao, setClassificarEmbriao] = useState<Embriao | null>(null);
  const [destinarEmbriao, setDestinarEmbriao] = useState<Embriao | null>(null);
  const [descartarEmbriao, setDescartarEmbriao] = useState<Embriao | null>(null);
  const [historicoEmbriao, setHistoricoEmbriao] = useState<Embriao | null>(null);
  const [historico, setHistorico] = useState<HistoricoEmbriao[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const { toast } = useToast();

  const [congelarData, setCongelarData] = useState({
    data_congelamento: new Date().toISOString().split('T')[0],
    localizacao_atual: '',
  });

  const [classificarData, setClassificarData] = useState({
    classificacao: '',
  });

  const [destinarData, setDestinarData] = useState({
    fazenda_destino_id: '',
  });

  const [descartarData, setDescartarData] = useState({
    data_descarte: new Date().toISOString().split('T')[0],
    observacoes: '',
  });

  useEffect(() => {
    loadData();
    loadFazendas();
  }, []);

  const loadFazendas = async () => {
    try {
      const { data, error } = await supabase
        .from('fazendas')
        .select('id, nome')
        .order('nome', { ascending: true });

      if (error) throw error;
      setFazendas(data || []);
    } catch (error) {
      console.error('Erro ao carregar fazendas:', error);
    }
  };

  // Função auxiliar para registrar histórico
  const registrarHistorico = async (
    embriaoId: string,
    statusAnterior: string | null,
    statusNovo: string,
    tipoOperacao: 'CLASSIFICACAO' | 'DESTINACAO' | 'CONGELAMENTO' | 'DESCARTE' | 'TRANSFERENCIA',
    fazendaId?: string | null,
    observacoes?: string | null
  ) => {
    try {
      const { error } = await supabase.from('historico_embrioes').insert([
        {
          embriao_id: embriaoId,
          status_anterior: statusAnterior,
          status_novo: statusNovo,
          tipo_operacao: tipoOperacao,
          fazenda_id: fazendaId || null,
          observacoes: observacoes || null,
          data_mudanca: new Date().toISOString(),
        },
      ]);

      if (error) {
        // Não falhar a operação se o histórico falhar, apenas logar
        console.error('Erro ao registrar histórico:', error);
      }
    } catch (error) {
      // Ignorar erros de histórico
      console.error('Erro ao registrar histórico:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);

      // Load embrioes
      const { data: embrioesData, error: embrioesError } = await supabase
        .from('embrioes')
        .select('*')
        .order('created_at', { ascending: false });

      if (embrioesError) throw embrioesError;

      if (!embrioesData || embrioesData.length === 0) {
        setEmbrioes([]);
        return;
      }

      // Buscar acasalamentos
      const acasalamentoIds = [
        ...new Set(embrioesData.filter((e) => e.lote_fiv_acasalamento_id).map((e) => e.lote_fiv_acasalamento_id)),
      ] as string[];

      if (acasalamentoIds.length === 0) {
        setEmbrioes(embrioesData as EmbrioCompleto[]);
        return;
      }

      const { data: acasalamentosData, error: acasalamentosError } = await supabase
        .from('lote_fiv_acasalamentos')
        .select('id, aspiracao_doadora_id, dose_semen_id')
        .in('id', acasalamentoIds);

      if (acasalamentosError) throw acasalamentosError;

      // Buscar aspirações
      const aspiracaoIds = [
        ...new Set(acasalamentosData?.map((a) => a.aspiracao_doadora_id) || []),
      ];
      const { data: aspiracoesData, error: aspiracoesError } = await supabase
        .from('aspiracoes_doadoras')
        .select('id, doadora_id')
        .in('id', aspiracaoIds);

      if (aspiracoesError) throw aspiracoesError;

      // Buscar doadoras
      const doadoraIds = [...new Set(aspiracoesData?.map((a) => a.doadora_id) || [])];
      const { data: doadorasData, error: doadorasError } = await supabase
        .from('doadoras')
        .select('id, registro')
        .in('id', doadoraIds);

      if (doadorasError) throw doadorasError;

      // Buscar doses
      const doseIds = [...new Set(acasalamentosData?.map((a) => a.dose_semen_id) || [])];
      const { data: dosesData, error: dosesError } = await supabase
        .from('doses_semen')
        .select('id, nome')
        .in('id', doseIds);

      if (dosesError) throw dosesError;

      // Buscar fazendas destino
      const fazendaDestinoIds = [
        ...new Set(embrioesData.filter((e) => e.fazenda_destino_id).map((e) => e.fazenda_destino_id)),
      ] as string[];

      let fazendasDestinoMap = new Map<string, string>();
      if (fazendaDestinoIds.length > 0) {
        const { data: fazendasDestinoData, error: fazendasDestinoError } = await supabase
          .from('fazendas')
          .select('id, nome')
          .in('id', fazendaDestinoIds);

        if (!fazendasDestinoError && fazendasDestinoData) {
          fazendasDestinoMap = new Map(fazendasDestinoData.map((f) => [f.id, f.nome]));
        }
      }

      // Mapear dados
      const aspiracoesMap = new Map(aspiracoesData?.map((a) => [a.id, a]) || []);
      const doadorasMap = new Map(doadorasData?.map((d) => [d.id, d]) || []);
      const dosesMap = new Map(dosesData?.map((d) => [d.id, d]) || []);
      const acasalamentosMap = new Map(acasalamentosData?.map((a) => [a.id, a]) || []);

      const embrioesCompletos: EmbrioCompleto[] = embrioesData.map((embriao) => {
        const acasalamento = embriao.lote_fiv_acasalamento_id
          ? acasalamentosMap.get(embriao.lote_fiv_acasalamento_id)
          : undefined;
        const aspiracao = acasalamento
          ? aspiracoesMap.get(acasalamento.aspiracao_doadora_id)
          : undefined;
        const doadora = aspiracao ? doadorasMap.get(aspiracao.doadora_id) : undefined;
        const dose = acasalamento ? dosesMap.get(acasalamento.dose_semen_id) : undefined;

        return {
          ...embriao,
          doadora_registro: doadora?.registro,
          touro_nome: dose?.nome,
          fazenda_destino_nome: embriao.fazenda_destino_id
            ? fazendasDestinoMap.get(embriao.fazenda_destino_id)
            : undefined,
        };
      });

      setEmbrioes(embrioesCompletos);
    } catch (error) {
      toast({
        title: 'Erro ao carregar dados',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClassificar = async () => {
    if (!classificarEmbriao || !classificarData.classificacao) {
      toast({
        title: 'Erro de validação',
        description: 'Classificação é obrigatória',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const { error } = await supabase
        .from('embrioes')
        .update({
          classificacao: classificarData.classificacao,
          data_classificacao: new Date().toISOString().split('T')[0],
        })
        .eq('id', classificarEmbriao.id);

      if (error) throw error;

      toast({
        title: 'Embrião classificado',
        description: 'Classificação salva com sucesso',
      });

      setShowClassificarDialog(false);
      setClassificarEmbriao(null);
      setClassificarData({ classificacao: '' });
      loadData();
    } catch (error) {
      toast({
        title: 'Erro ao classificar embrião',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDestinar = async () => {
    if (!destinarEmbriao) {
      return;
    }

    if (!destinarEmbriao.classificacao) {
      toast({
        title: 'Erro de validação',
        description: 'É necessário classificar o embrião antes de destinar para uma fazenda',
        variant: 'destructive',
      });
      return;
    }

    if (!destinarData.fazenda_destino_id) {
      toast({
        title: 'Erro de validação',
        description: 'Selecione uma fazenda destino',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const { error } = await supabase
        .from('embrioes')
        .update({
          fazenda_destino_id: destinarData.fazenda_destino_id || null,
        })
        .eq('id', destinarEmbriao.id);

      if (error) throw error;

      toast({
        title: 'Embrião destinado',
        description: 'Fazenda destino atualizada com sucesso',
      });

      setShowDestinarDialog(false);
      setDestinarEmbriao(null);
      setDestinarData({ fazenda_destino_id: '' });
      loadData();
    } catch (error) {
      toast({
        title: 'Erro ao destinar embrião',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCongelar = async () => {
    if (!congelarEmbriao) return;

    if (!congelarData.localizacao_atual.trim()) {
      toast({
        title: 'Erro de validação',
        description: 'Localização (botijão) é obrigatória',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const { error } = await supabase
        .from('embrioes')
        .update({
          status_atual: 'CONGELADO',
          data_congelamento: congelarData.data_congelamento,
          localizacao_atual: congelarData.localizacao_atual,
        })
        .eq('id', congelarEmbriao.id);

      if (error) throw error;

      toast({
        title: 'Embrião congelado',
        description: 'Embrião congelado com sucesso',
      });

      setShowCongelarDialog(false);
      setCongelarEmbriao(null);
      setCongelarData({
        data_congelamento: new Date().toISOString().split('T')[0],
        localizacao_atual: '',
      });
      loadData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao congelar embrião',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Embriões</h1>
          <p className="text-slate-600 mt-1">Gerenciar estoque de embriões</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Estoque de Embriões</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Identificação</TableHead>
                <TableHead>Doadora</TableHead>
                <TableHead>Touro</TableHead>
                <TableHead>Classificação</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Fazenda Destino</TableHead>
                <TableHead>Localização</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {embrioes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-slate-500">
                    Nenhum embrião cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                embrioes.map((embriao) => (
                  <TableRow key={embriao.id}>
                    <TableCell className="font-medium">
                      {embriao.identificacao || embriao.id.slice(0, 8)}
                    </TableCell>
                    <TableCell>{embriao.doadora_registro || '-'}</TableCell>
                    <TableCell>{embriao.touro_nome || '-'}</TableCell>
                    <TableCell>{embriao.classificacao || '-'}</TableCell>
                    <TableCell>
                      <StatusBadge status={embriao.status_atual} />
                    </TableCell>
                    <TableCell>{embriao.fazenda_destino_nome || '-'}</TableCell>
                    <TableCell>{embriao.localizacao_atual || '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        {!embriao.classificacao && embriao.status_atual === 'FRESCO' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setClassificarEmbriao(embriao);
                              setClassificarData({ classificacao: embriao.classificacao || '' });
                              setShowClassificarDialog(true);
                            }}
                            title="Classificar"
                          >
                            <Tag className="w-4 h-4 text-purple-600" />
                          </Button>
                        )}
                        {embriao.classificacao && embriao.status_atual === 'FRESCO' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setClassificarEmbriao(embriao);
                                setClassificarData({ classificacao: embriao.classificacao || '' });
                                setShowClassificarDialog(true);
                              }}
                              title="Editar Classificação"
                            >
                              <Tag className="w-4 h-4 text-purple-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setDestinarEmbriao(embriao);
                                setDestinarData({ fazenda_destino_id: embriao.fazenda_destino_id || '' });
                                setShowDestinarDialog(true);
                              }}
                              title="Destinar para Fazenda"
                            >
                              <MapPin className="w-4 h-4 text-orange-600" />
                            </Button>
                          </>
                        )}
                        {embriao.status_atual === 'FRESCO' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setCongelarEmbriao(embriao);
                              setShowCongelarDialog(true);
                            }}
                            title="Congelar"
                          >
                            <Snowflake className="w-4 h-4 text-blue-600" />
                          </Button>
                        )}
                        {(embriao.status_atual === 'FRESCO' ||
                          embriao.status_atual === 'CONGELADO') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate('/transferencia')}
                            title="Transferir"
                          >
                            <ArrowRightLeft className="w-4 h-4 text-green-600" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Classificar Dialog */}
      <Dialog open={showClassificarDialog} onOpenChange={setShowClassificarDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Classificar Embrião</DialogTitle>
            <DialogDescription>
              Classificar embrião {classificarEmbriao?.identificacao || 'selecionado'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="classificacao">Classificação *</Label>
              <Select
                value={classificarData.classificacao}
                onValueChange={(value) => setClassificarData({ classificacao: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a classificação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EX">EX (Excelente)</SelectItem>
                  <SelectItem value="BL">BL (Blastocisto)</SelectItem>
                  <SelectItem value="A">A</SelectItem>
                  <SelectItem value="B">B</SelectItem>
                  <SelectItem value="C">C</SelectItem>
                  <SelectItem value="D">D</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleClassificar}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
                disabled={submitting}
              >
                {submitting ? 'Salvando...' : 'Salvar Classificação'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowClassificarDialog(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Destinar Dialog */}
      <Dialog open={showDestinarDialog} onOpenChange={setShowDestinarDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Destinar Embrião para Fazenda</DialogTitle>
            <DialogDescription>
              Selecionar fazenda destino para o embrião {destinarEmbriao?.identificacao || 'selecionado'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fazenda_destino_id">Fazenda Destino *</Label>
              <Select
                value={destinarData.fazenda_destino_id}
                onValueChange={(value) => setDestinarData({ fazenda_destino_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a fazenda" />
                </SelectTrigger>
                <SelectContent>
                  {fazendas.map((fazenda) => (
                    <SelectItem key={fazenda.id} value={fazenda.id}>
                      {fazenda.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleDestinar}
                className="flex-1 bg-orange-600 hover:bg-orange-700"
                disabled={submitting}
              >
                {submitting ? 'Salvando...' : 'Salvar Destinação'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowDestinarDialog(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Congelar Dialog */}
      <Dialog open={showCongelarDialog} onOpenChange={setShowCongelarDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Congelar Embrião</DialogTitle>
            <DialogDescription>
              Registrar congelamento do embrião {congelarEmbriao?.identificacao || 'selecionado'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="data_congelamento">Data de Congelamento *</Label>
              <Input
                id="data_congelamento"
                type="date"
                value={congelarData.data_congelamento}
                onChange={(e) =>
                  setCongelarData({ ...congelarData, data_congelamento: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="localizacao_atual">Localização (Botijão) *</Label>
              <Input
                id="localizacao_atual"
                value={congelarData.localizacao_atual}
                onChange={(e) =>
                  setCongelarData({ ...congelarData, localizacao_atual: e.target.value })
                }
                placeholder="Ex: Botijão 1, Canister A"
                required
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleCongelar}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                disabled={submitting}
              >
                {submitting ? 'Congelando...' : 'Congelar'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowCongelarDialog(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
