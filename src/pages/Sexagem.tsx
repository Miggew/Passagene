import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { DiagnosticoGestacao } from '@/lib/types';
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
import StatusBadge from '@/components/shared/StatusBadge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Baby } from 'lucide-react';

interface SexagemWithNames extends DiagnosticoGestacao {
  receptora_brinco?: string;
}

interface ReceptoraComTE {
  receptora_id: string;
  brinco: string;
  data_te: string;
}

export default function Sexagem() {
  const [sexagens, setSexagens] = useState<SexagemWithNames[]>([]);
  const [receptoras, setReceptoras] = useState<ReceptoraComTE[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    receptora_id: '',
    data_te: '',
    data_diagnostico: new Date().toISOString().split('T')[0],
    resultado: 'PRENHE',
    sexagem: '',
    numero_gestacoes: '',
    observacoes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load receptoras com TE
      const { data: teData, error: teError } = await supabase
        .from('transferencias_embrioes')
        .select('receptora_id, data_te')
        .eq('status_te', 'REALIZADA')
        .order('data_te', { ascending: false });

      if (teError) throw teError;

      // Get receptora details
      const receptoraIds = [...new Set(teData?.map((t) => t.receptora_id))];
      
      if (receptoraIds.length > 0) {
        const { data: receptorasData, error: receptorasError } = await supabase
          .from('receptoras')
          .select('id, identificacao')
          .in('id', receptoraIds);

        if (receptorasError) throw receptorasError;

        const receptorasMap = new Map(receptorasData?.map((r) => [r.id, r.identificacao]));

        const receptorasComTE = teData?.map((t) => ({
          receptora_id: t.receptora_id,
          brinco: receptorasMap.get(t.receptora_id) || '',
          data_te: t.data_te,
        })) || [];

        setReceptoras(receptorasComTE);
      }

      // Load sexagens
      const { data: sexagemData, error: sexagemError } = await supabase
        .from('diagnosticos_gestacao')
        .select('*')
        .eq('tipo_diagnostico', 'SEXAGEM')
        .order('data_diagnostico', { ascending: false });

      if (sexagemError) throw sexagemError;

      // Get receptora names
      const sexagemReceptoraIds = [...new Set(sexagemData?.map((d) => d.receptora_id))];
      
      if (sexagemReceptoraIds.length > 0) {
        const { data: receptorasData, error: receptorasError } = await supabase
          .from('receptoras')
          .select('id, identificacao')
          .in('id', sexagemReceptoraIds);

        if (receptorasError) throw receptorasError;

        const receptorasMap = new Map(receptorasData?.map((r) => [r.id, r.identificacao]));

        const sexagemWithNames = sexagemData?.map((s) => ({
          ...s,
          receptora_brinco: receptorasMap.get(s.receptora_id),
        }));

        setSexagens(sexagemWithNames || []);
      } else {
        setSexagens([]);
      }
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

  const handleReceptoraChange = (receptoraId: string) => {
    const receptora = receptoras.find((r) => r.receptora_id === receptoraId);
    setFormData({
      ...formData,
      receptora_id: receptoraId,
      data_te: receptora?.data_te || '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.receptora_id || !formData.data_te || !formData.data_diagnostico) {
      toast({
        title: 'Erro de validação',
        description: 'Receptora, data da TE e data do diagnóstico são obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    if (formData.resultado === 'PRENHE' && !formData.sexagem) {
      toast({
        title: 'Erro de validação',
        description: 'Sexagem é obrigatória quando resultado é PRENHE',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const insertData: Record<string, string | number | null> = {
        receptora_id: formData.receptora_id,
        data_te: formData.data_te,
        tipo_diagnostico: 'SEXAGEM',
        data_diagnostico: formData.data_diagnostico,
        resultado: formData.resultado,
        sexagem: formData.sexagem || null,
        numero_gestacoes: formData.numero_gestacoes ? parseInt(formData.numero_gestacoes) : null,
        observacoes: formData.observacoes || null,
      };

      const { error } = await supabase.from('diagnosticos_gestacao').insert([insertData]);

      if (error) throw error;

      toast({
        title: 'Sexagem registrada',
        description: 'Sexagem registrada com sucesso',
      });

      setShowDialog(false);
      setFormData({
        receptora_id: '',
        data_te: '',
        data_diagnostico: new Date().toISOString().split('T')[0],
        resultado: 'PRENHE',
        sexagem: '',
        numero_gestacoes: '',
        observacoes: '',
      });
      loadData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao registrar sexagem',
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
          <h1 className="text-3xl font-bold text-slate-900">Sexagem</h1>
          <p className="text-slate-600 mt-1">Registrar sexagem fetal</p>
        </div>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button className="bg-green-600 hover:bg-green-700">
              <Plus className="w-4 h-4 mr-2" />
              Nova Sexagem
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Baby className="w-5 h-5" />
                Registrar Sexagem
              </DialogTitle>
              <DialogDescription>
                Preencha os dados da sexagem (pode ser feita sem DG prévio)
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="receptora_id">Receptora com TE *</Label>
                <Select value={formData.receptora_id} onValueChange={handleReceptoraChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a receptora" />
                  </SelectTrigger>
                  <SelectContent>
                    {receptoras.length === 0 ? (
                      <div className="p-2 text-sm text-slate-500">
                        Nenhuma receptora com TE registrada
                      </div>
                    ) : (
                      receptoras.map((receptora) => (
                        <SelectItem key={receptora.receptora_id} value={receptora.receptora_id}>
                          {receptora.brinco} - TE em{' '}
                          {new Date(receptora.data_te).toLocaleDateString('pt-BR')}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="data_diagnostico">Data da Sexagem *</Label>
                <Input
                  id="data_diagnostico"
                  type="date"
                  value={formData.data_diagnostico}
                  onChange={(e) => setFormData({ ...formData, data_diagnostico: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="resultado">Resultado</Label>
                <Select
                  value={formData.resultado}
                  onValueChange={(value) => setFormData({ ...formData, resultado: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRENHE">PRENHE</SelectItem>
                    <SelectItem value="RETOQUE">RETOQUE</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.resultado === 'PRENHE' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="sexagem">Sexo do Feto *</Label>
                    <Select
                      value={formData.sexagem}
                      onValueChange={(value) => setFormData({ ...formData, sexagem: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o sexo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FEMEA">FÊMEA</SelectItem>
                        <SelectItem value="MACHO">MACHO</SelectItem>
                        <SelectItem value="PRENHE">PRENHE (sem sexo visível)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="numero_gestacoes">Número de Gestações</Label>
                    <Input
                      id="numero_gestacoes"
                      type="number"
                      min="1"
                      max="3"
                      value={formData.numero_gestacoes}
                      onChange={(e) =>
                        setFormData({ ...formData, numero_gestacoes: e.target.value })
                      }
                      placeholder="1, 2 ou 3 (gemelar)"
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Observações sobre a sexagem"
                  rows={3}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="submit"
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={submitting}
                >
                  {submitting ? 'Salvando...' : 'Registrar'}
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
          <CardTitle>Histórico de Sexagens</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data Sexagem</TableHead>
                <TableHead>Receptora</TableHead>
                <TableHead>Data TE</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead>Sexo</TableHead>
                <TableHead>Nº Gestações</TableHead>
                <TableHead>Observações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sexagens.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-500">
                    Nenhuma sexagem registrada
                  </TableCell>
                </TableRow>
              ) : (
                sexagens.map((sexagem) => (
                  <TableRow key={sexagem.id}>
                    <TableCell>
                      {new Date(sexagem.data_diagnostico).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="font-medium">
                      {sexagem.receptora_brinco || '-'}
                    </TableCell>
                    <TableCell>{new Date(sexagem.data_te).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>
                      <StatusBadge status={sexagem.resultado} />
                    </TableCell>
                    <TableCell>
                      {sexagem.sexagem ? <StatusBadge status={sexagem.sexagem} /> : '-'}
                    </TableCell>
                    <TableCell>{sexagem.numero_gestacoes || '-'}</TableCell>
                    <TableCell>{sexagem.observacoes || '-'}</TableCell>
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