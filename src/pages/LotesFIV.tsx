import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { LoteFIV } from '@/lib/types';
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
import { Textarea } from '@/components/ui/textarea';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { Plus } from 'lucide-react';

interface LoteWithNames extends LoteFIV {
  doadora_nome?: string;
  dose_nome?: string;
  fazenda_nome?: string;
  viaveis_aspiracao?: number;
}

interface Aspiracao {
  id: string;
  data_aspiracao: string;
  doadora_id: string;
  viaveis?: number;
}

interface DoseSemen {
  id: string;
  nome: string;
}

interface Fazenda {
  id: string;
  nome: string;
}

export default function LotesFIV() {
  const [lotes, setLotes] = useState<LoteWithNames[]>([]);
  const [aspiracoes, setAspiracoes] = useState<Aspiracao[]>([]);
  const [doses, setDoses] = useState<DoseSemen[]>([]);
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    aspiracao_id: '',
    dose_semen_id: '',
    fazenda_destino_id: '',
    oocitos_utilizados: '',
    data_avaliacao: '',
    observacoes: '',
  });

  const [selectedAspiracao, setSelectedAspiracao] = useState<Aspiracao | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load aspiracoes
      const { data: aspiracoesData, error: aspiracoesError } = await supabase
        .from('aspiracoes_doadoras')
        .select('id, data_aspiracao, doadora_id, viaveis')
        .order('data_aspiracao', { ascending: false });

      if (aspiracoesError) throw aspiracoesError;
      setAspiracoes(aspiracoesData || []);

      // Load doses
      const { data: dosesData, error: dosesError } = await supabase
        .from('doses_semen')
        .select('id, nome')
        .order('nome', { ascending: true });

      if (dosesError) throw dosesError;
      setDoses(dosesData || []);

      // Load fazendas
      const { data: fazendasData, error: fazendasError } = await supabase
        .from('fazendas')
        .select('id, nome')
        .order('nome', { ascending: true });

      if (fazendasError) throw fazendasError;
      setFazendas(fazendasData || []);

      // Load lotes
      const { data: lotesData, error: lotesError } = await supabase
        .from('lotes_fiv')
        .select('*')
        .order('data_fecundacao', { ascending: false });

      if (lotesError) throw lotesError;

      // Load doadoras for aspiracoes
      const { data: doadorasData, error: doadorasError } = await supabase
        .from('doadoras')
        .select('id, nome, registro');

      if (doadorasError) throw doadorasError;

      const doadorasMap = new Map(doadorasData?.map((d) => [d.id, d.nome || d.registro]));
      const dosesMap = new Map(dosesData?.map((d) => [d.id, d.nome]));
      const fazendasMap = new Map(fazendasData?.map((f) => [f.id, f.nome]));
      const aspiracoesMap = new Map(aspiracoesData?.map((a) => [a.id, a]));

      const lotesWithNames = lotesData?.map((l) => {
        const aspiracao = aspiracoesMap.get(l.aspiracao_id);
        return {
          ...l,
          doadora_nome: aspiracao ? doadorasMap.get(aspiracao.doadora_id) : undefined,
          dose_nome: dosesMap.get(l.dose_semen_id),
          fazenda_nome: l.fazenda_destino_id ? fazendasMap.get(l.fazenda_destino_id) : undefined,
          viaveis_aspiracao: aspiracao?.viaveis,
        };
      });

      setLotes(lotesWithNames || []);
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

  const handleAspiracaoChange = (aspiracaoId: string) => {
    setFormData({ ...formData, aspiracao_id: aspiracaoId });
    const aspiracao = aspiracoes.find((a) => a.id === aspiracaoId);
    setSelectedAspiracao(aspiracao || null);

    // Calculate data_fecundacao = data_aspiracao + 1
    if (aspiracao) {
      const dataAspiracao = new Date(aspiracao.data_aspiracao);
      dataAspiracao.setDate(dataAspiracao.getDate() + 1);
      // Data fecundacao is auto-calculated by trigger, but we show it
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.aspiracao_id || !formData.dose_semen_id) {
      toast({
        title: 'Erro de validação',
        description: 'Aspiração e dose de sêmen são obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    const oocitosUtilizados = parseInt(formData.oocitos_utilizados) || 0;
    const viaveisAspiracao = selectedAspiracao?.viaveis || 0;

    if (oocitosUtilizados > viaveisAspiracao) {
      toast({
        title: 'Erro de validação',
        description: `Oócitos utilizados (${oocitosUtilizados}) não pode ser maior que viáveis da aspiração (${viaveisAspiracao})`,
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const insertData: Record<string, string | number | null> = {
        aspiracao_id: formData.aspiracao_id,
        dose_semen_id: formData.dose_semen_id,
        fazenda_destino_id: formData.fazenda_destino_id || null,
        oocitos_utilizados: oocitosUtilizados || null,
        data_avaliacao: formData.data_avaliacao || null,
        observacoes: formData.observacoes || null,
      };

      // data_fecundacao is auto-calculated by trigger (data_aspiracao + 1)

      const { error } = await supabase.from('lotes_fiv').insert([insertData]);

      if (error) throw error;

      toast({
        title: 'Lote FIV criado',
        description: 'Lote FIV criado com sucesso',
      });

      setShowDialog(false);
      setFormData({
        aspiracao_id: '',
        dose_semen_id: '',
        fazenda_destino_id: '',
        oocitos_utilizados: '',
        data_avaliacao: '',
        observacoes: '',
      });
      setSelectedAspiracao(null);
      loadData();
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

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Lotes FIV</h1>
          <p className="text-slate-600 mt-1">Gerenciar lotes de fecundação in vitro</p>
        </div>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button className="bg-green-600 hover:bg-green-700">
              <Plus className="w-4 h-4 mr-2" />
              Novo Lote
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Criar Novo Lote FIV</DialogTitle>
              <DialogDescription>
                Selecione aspiração e dose de sêmen para criar o lote
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="aspiracao_id">Aspiração *</Label>
                <Select value={formData.aspiracao_id} onValueChange={handleAspiracaoChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a aspiração" />
                  </SelectTrigger>
                  <SelectContent>
                    {aspiracoes.map((aspiracao) => (
                      <SelectItem key={aspiracao.id} value={aspiracao.id}>
                        {new Date(aspiracao.data_aspiracao).toLocaleDateString('pt-BR')} - Viáveis:{' '}
                        {aspiracao.viaveis || 0}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedAspiracao && (
                  <p className="text-xs text-slate-500">
                    Oócitos viáveis disponíveis: {selectedAspiracao.viaveis || 0}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="dose_semen_id">Dose de Sêmen *</Label>
                <Select
                  value={formData.dose_semen_id}
                  onValueChange={(value) => setFormData({ ...formData, dose_semen_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a dose" />
                  </SelectTrigger>
                  <SelectContent>
                    {doses.map((dose) => (
                      <SelectItem key={dose.id} value={dose.id}>
                        {dose.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fazenda_destino_id">Fazenda Destino</Label>
                <Select
                  value={formData.fazenda_destino_id}
                  onValueChange={(value) => setFormData({ ...formData, fazenda_destino_id: value })}
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

              <div className="space-y-2">
                <Label htmlFor="oocitos_utilizados">Oócitos Utilizados</Label>
                <Input
                  id="oocitos_utilizados"
                  type="number"
                  min="0"
                  max={selectedAspiracao?.viaveis || 999}
                  value={formData.oocitos_utilizados}
                  onChange={(e) =>
                    setFormData({ ...formData, oocitos_utilizados: e.target.value })
                  }
                  placeholder="Quantidade de oócitos"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="data_avaliacao">Data de Avaliação</Label>
                <Input
                  id="data_avaliacao"
                  type="date"
                  value={formData.data_avaliacao}
                  onChange={(e) => setFormData({ ...formData, data_avaliacao: e.target.value })}
                />
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
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={submitting}
                >
                  {submitting ? 'Salvando...' : 'Criar Lote'}
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
          <CardTitle>Lista de Lotes FIV</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data Fecundação</TableHead>
                <TableHead>Doadora</TableHead>
                <TableHead>Dose Sêmen</TableHead>
                <TableHead>Fazenda Destino</TableHead>
                <TableHead>Oócitos Utilizados</TableHead>
                <TableHead>Data Avaliação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-500">
                    Nenhum lote cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                lotes.map((lote) => (
                  <TableRow key={lote.id}>
                    <TableCell>
                      {lote.data_fecundacao
                        ? new Date(lote.data_fecundacao).toLocaleDateString('pt-BR')
                        : '-'}
                    </TableCell>
                    <TableCell>{lote.doadora_nome || '-'}</TableCell>
                    <TableCell>{lote.dose_nome || '-'}</TableCell>
                    <TableCell>{lote.fazenda_nome || '-'}</TableCell>
                    <TableCell>{lote.oocitos_utilizados || '-'}</TableCell>
                    <TableCell>
                      {lote.data_avaliacao
                        ? new Date(lote.data_avaliacao).toLocaleDateString('pt-BR')
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}