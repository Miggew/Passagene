import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Embriao } from '@/lib/types';
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
  DialogTrigger,
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
import { Plus, Snowflake, ArrowRightLeft } from 'lucide-react';

interface EmbrioWithLote extends Embriao {
  lote_data_fecundacao?: string;
}

interface LoteFIV {
  id: string;
  data_fecundacao?: string;
  aspiracao_id: string;
}

export default function Embrioes() {
  const navigate = useNavigate();
  const [embrioes, setEmbrioes] = useState<EmbrioWithLote[]>([]);
  const [lotes, setLotes] = useState<LoteFIV[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showCongelarDialog, setShowCongelarDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [congelarEmbriao, setCongelarEmbriao] = useState<Embriao | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    lote_fiv_id: '',
    identificacao: '',
    classificacao: '',
    tipo_embriao: '',
    status_atual: 'FRESCO',
  });

  const [congelarData, setCongelarData] = useState({
    data_congelamento: new Date().toISOString().split('T')[0],
    localizacao_atual: '',
  });

  const [selectedLote, setSelectedLote] = useState<LoteFIV | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load lotes
      const { data: lotesData, error: lotesError } = await supabase
        .from('lotes_fiv')
        .select('*')
        .order('data_fecundacao', { ascending: false });

      if (lotesError) throw lotesError;
      setLotes(lotesData || []);

      // Load embrioes
      const { data: embrioesData, error: embrioesError } = await supabase
        .from('embrioes')
        .select('*')
        .order('created_at', { ascending: false });

      if (embrioesError) throw embrioesError;

      const lotesMap = new Map(lotesData?.map((l) => [l.id, l]));

      const embrioesWithLote = embrioesData?.map((e) => {
        const lote = lotesMap.get(e.lote_fiv_id);
        return {
          ...e,
          lote_data_fecundacao: lote?.data_fecundacao,
        };
      });

      setEmbrioes(embrioesWithLote || []);
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

  const handleLoteChange = (loteId: string) => {
    setFormData({ ...formData, lote_fiv_id: loteId });
    const lote = lotes.find((l) => l.id === loteId);
    setSelectedLote(lote || null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.lote_fiv_id) {
      toast({
        title: 'Erro de validação',
        description: 'Lote FIV é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      // Calculate data_envase = data_fecundacao + 7
      let dataEnvase = null;
      if (selectedLote?.data_fecundacao) {
        const dataFecundacao = new Date(selectedLote.data_fecundacao);
        dataFecundacao.setDate(dataFecundacao.getDate() + 7);
        dataEnvase = dataFecundacao.toISOString().split('T')[0];
      }

      const insertData: Record<string, string | null> = {
        lote_fiv_id: formData.lote_fiv_id,
        identificacao: formData.identificacao || null,
        classificacao: formData.classificacao || null,
        tipo_embriao: formData.tipo_embriao || null,
        status_atual: formData.status_atual,
        data_envase: dataEnvase,
      };

      const { error } = await supabase.from('embrioes').insert([insertData]);

      if (error) throw error;

      toast({
        title: 'Embrião criado',
        description: 'Embrião criado com sucesso',
      });

      setShowDialog(false);
      setFormData({
        lote_fiv_id: '',
        identificacao: '',
        classificacao: '',
        tipo_embriao: '',
        status_atual: 'FRESCO',
      });
      setSelectedLote(null);
      loadData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao criar embrião',
        description: errorMessage.includes('RLS') || errorMessage.includes('policy')
          ? 'RLS está bloqueando escrita. Configure políticas anon no Supabase.'
          : errorMessage,
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
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button className="bg-green-600 hover:bg-green-700">
              <Plus className="w-4 h-4 mr-2" />
              Novo Embrião
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Criar Novo Embrião</DialogTitle>
              <DialogDescription>Registrar embrião para um lote FIV</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="lote_fiv_id">Lote FIV *</Label>
                <Select value={formData.lote_fiv_id} onValueChange={handleLoteChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o lote" />
                  </SelectTrigger>
                  <SelectContent>
                    {lotes.map((lote) => (
                      <SelectItem key={lote.id} value={lote.id}>
                        {lote.data_fecundacao
                          ? new Date(lote.data_fecundacao).toLocaleDateString('pt-BR')
                          : lote.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedLote?.data_fecundacao && (
                  <p className="text-xs text-slate-500">
                    Data de envase (D7):{' '}
                    {new Date(
                      new Date(selectedLote.data_fecundacao).getTime() + 7 * 24 * 60 * 60 * 1000
                    ).toLocaleDateString('pt-BR')}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="identificacao">Identificação</Label>
                <Input
                  id="identificacao"
                  value={formData.identificacao}
                  onChange={(e) => setFormData({ ...formData, identificacao: e.target.value })}
                  placeholder="Código do embrião"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="classificacao">Classificação</Label>
                <Select
                  value={formData.classificacao}
                  onValueChange={(value) => setFormData({ ...formData, classificacao: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a classificação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EXCELENTE">EXCELENTE</SelectItem>
                    <SelectItem value="BOM">BOM</SelectItem>
                    <SelectItem value="REGULAR">REGULAR</SelectItem>
                    <SelectItem value="RUIM">RUIM</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tipo_embriao">Tipo de Embrião</Label>
                <Select
                  value={formData.tipo_embriao}
                  onValueChange={(value) => setFormData({ ...formData, tipo_embriao: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIV">FIV</SelectItem>
                    <SelectItem value="TE">TE</SelectItem>
                    <SelectItem value="CLONADO">CLONADO</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status_atual">Status Atual</Label>
                <Select
                  value={formData.status_atual}
                  onValueChange={(value) => setFormData({ ...formData, status_atual: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FRESCO">FRESCO</SelectItem>
                    <SelectItem value="CONGELADO">CONGELADO</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="submit"
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={submitting}
                >
                  {submitting ? 'Salvando...' : 'Criar Embrião'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDialog(false)}
                  disabled={submitting}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
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
                <TableHead>Lote (Data Fecundação)</TableHead>
                <TableHead>Classificação</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Localização</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {embrioes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-500">
                    Nenhum embrião cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                embrioes.map((embriao) => (
                  <TableRow key={embriao.id}>
                    <TableCell className="font-medium">
                      {embriao.identificacao || embriao.id.slice(0, 8)}
                    </TableCell>
                    <TableCell>
                      {embriao.lote_data_fecundacao
                        ? new Date(embriao.lote_data_fecundacao).toLocaleDateString('pt-BR')
                        : '-'}
                    </TableCell>
                    <TableCell>{embriao.classificacao || '-'}</TableCell>
                    <TableCell>{embriao.tipo_embriao || '-'}</TableCell>
                    <TableCell>
                      <StatusBadge status={embriao.status_atual} />
                    </TableCell>
                    <TableCell>{embriao.localizacao_atual || '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
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