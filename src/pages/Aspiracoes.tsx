import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { AspiracaoDoadora } from '@/lib/types';
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
import { Plus, Edit } from 'lucide-react';

interface AspiracaoWithNames extends AspiracaoDoadora {
  doadora_nome?: string;
  fazenda_nome?: string;
}

interface Doadora {
  id: string;
  nome?: string;
  registro?: string;
}

interface Fazenda {
  id: string;
  nome: string;
}

export default function Aspiracoes() {
  const [aspiracoes, setAspiracoes] = useState<AspiracaoWithNames[]>([]);
  const [doadoras, setDoadoras] = useState<Doadora[]>([]);
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingAspiracao, setEditingAspiracao] = useState<AspiracaoDoadora | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    doadora_id: '',
    fazenda_id: '',
    data_aspiracao: new Date().toISOString().split('T')[0],
    horario_aspiracao: '',
    atresicos: '',
    degenerados: '',
    expandidos: '',
    desnudos: '',
    viaveis: '',
    total_oocitos: '',
    veterinario_responsavel: '',
    tecnico_responsavel: '',
    observacoes: '',
  });

  const [editFormData, setEditFormData] = useState({
    doadora_id: '',
    fazenda_id: '',
    data_aspiracao: '',
    horario_aspiracao: '',
    atresicos: '',
    degenerados: '',
    expandidos: '',
    desnudos: '',
    viaveis: '',
    total_oocitos: '',
    veterinario_responsavel: '',
    tecnico_responsavel: '',
    observacoes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load doadoras
      const { data: doadorasData, error: doadorasError } = await supabase
        .from('doadoras')
        .select('*')
        .order('nome', { ascending: true });

      if (doadorasError) throw doadorasError;
      setDoadoras(doadorasData || []);

      // Load fazendas
      const { data: fazendasData, error: fazendasError } = await supabase
        .from('fazendas')
        .select('id, nome')
        .order('nome', { ascending: true });

      if (fazendasError) throw fazendasError;
      setFazendas(fazendasData || []);

      // Load aspiracoes
      const { data: aspiracoesData, error: aspiracoesError } = await supabase
        .from('aspiracoes_doadoras')
        .select('*')
        .order('data_aspiracao', { ascending: false });

      if (aspiracoesError) throw aspiracoesError;

      const doadorasMap = new Map(doadorasData?.map((d) => [d.id, d.nome || d.registro]));
      const fazendasMap = new Map(fazendasData?.map((f) => [f.id, f.nome]));

      const aspiracoesWithNames = aspiracoesData?.map((a) => ({
        ...a,
        doadora_nome: doadorasMap.get(a.doadora_id),
        fazenda_nome: fazendasMap.get(a.fazenda_id),
      }));

      setAspiracoes(aspiracoesWithNames || []);
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

  const calculateTotal = (data: typeof formData | typeof editFormData) => {
    const atresicos = parseInt(data.atresicos) || 0;
    const degenerados = parseInt(data.degenerados) || 0;
    const expandidos = parseInt(data.expandidos) || 0;
    const desnudos = parseInt(data.desnudos) || 0;
    const viaveis = parseInt(data.viaveis) || 0;
    return atresicos + degenerados + expandidos + desnudos + viaveis;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.doadora_id || !formData.fazenda_id || !formData.data_aspiracao) {
      toast({
        title: 'Erro de validação',
        description: 'Doadora, fazenda e data de aspiração são obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const total = calculateTotal(formData);

      const insertData: Record<string, string | number | null> = {
        doadora_id: formData.doadora_id,
        fazenda_id: formData.fazenda_id,
        data_aspiracao: formData.data_aspiracao,
        horario_aspiracao: formData.horario_aspiracao || null,
        atresicos: parseInt(formData.atresicos) || 0,
        degenerados: parseInt(formData.degenerados) || 0,
        expandidos: parseInt(formData.expandidos) || 0,
        desnudos: parseInt(formData.desnudos) || 0,
        viaveis: parseInt(formData.viaveis) || 0,
        total_oocitos: total,
        veterinario_responsavel: formData.veterinario_responsavel || null,
        tecnico_responsavel: formData.tecnico_responsavel || null,
        observacoes: formData.observacoes || null,
      };

      const { error } = await supabase.from('aspiracoes_doadoras').insert([insertData]);

      if (error) throw error;

      toast({
        title: 'Aspiração criada',
        description: 'Aspiração registrada com sucesso',
      });

      setShowDialog(false);
      setFormData({
        doadora_id: '',
        fazenda_id: '',
        data_aspiracao: new Date().toISOString().split('T')[0],
        horario_aspiracao: '',
        atresicos: '',
        degenerados: '',
        expandidos: '',
        desnudos: '',
        viaveis: '',
        total_oocitos: '',
        veterinario_responsavel: '',
        tecnico_responsavel: '',
        observacoes: '',
      });
      loadData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao criar aspiração',
        description: errorMessage.includes('RLS') || errorMessage.includes('policy')
          ? 'RLS está bloqueando escrita. Configure políticas anon no Supabase.'
          : errorMessage,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (aspiracao: AspiracaoDoadora) => {
    setEditingAspiracao(aspiracao);
    setEditFormData({
      doadora_id: aspiracao.doadora_id,
      fazenda_id: aspiracao.fazenda_id,
      data_aspiracao: aspiracao.data_aspiracao,
      horario_aspiracao: aspiracao.horario_aspiracao || '',
      atresicos: aspiracao.atresicos?.toString() || '',
      degenerados: aspiracao.degenerados?.toString() || '',
      expandidos: aspiracao.expandidos?.toString() || '',
      desnudos: aspiracao.desnudos?.toString() || '',
      viaveis: aspiracao.viaveis?.toString() || '',
      total_oocitos: aspiracao.total_oocitos?.toString() || '',
      veterinario_responsavel: aspiracao.veterinario_responsavel || '',
      tecnico_responsavel: aspiracao.tecnico_responsavel || '',
      observacoes: aspiracao.observacoes || '',
    });
    setShowEditDialog(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingAspiracao) return;

    try {
      setSubmitting(true);

      const total = calculateTotal(editFormData);

      const updateData: Record<string, string | number | null> = {
        doadora_id: editFormData.doadora_id,
        fazenda_id: editFormData.fazenda_id,
        data_aspiracao: editFormData.data_aspiracao,
        horario_aspiracao: editFormData.horario_aspiracao || null,
        atresicos: parseInt(editFormData.atresicos) || 0,
        degenerados: parseInt(editFormData.degenerados) || 0,
        expandidos: parseInt(editFormData.expandidos) || 0,
        desnudos: parseInt(editFormData.desnudos) || 0,
        viaveis: parseInt(editFormData.viaveis) || 0,
        total_oocitos: total,
        veterinario_responsavel: editFormData.veterinario_responsavel || null,
        tecnico_responsavel: editFormData.tecnico_responsavel || null,
        observacoes: editFormData.observacoes || null,
      };

      const { error } = await supabase
        .from('aspiracoes_doadoras')
        .update(updateData)
        .eq('id', editingAspiracao.id);

      if (error) throw error;

      toast({
        title: 'Aspiração atualizada',
        description: 'Aspiração atualizada com sucesso',
      });

      setShowEditDialog(false);
      setEditingAspiracao(null);
      loadData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao atualizar aspiração',
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
          <h1 className="text-3xl font-bold text-slate-900">Aspirações</h1>
          <p className="text-slate-600 mt-1">Registrar aspirações de doadoras</p>
        </div>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button className="bg-green-600 hover:bg-green-700">
              <Plus className="w-4 h-4 mr-2" />
              Nova Aspiração
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Registrar Nova Aspiração</DialogTitle>
              <DialogDescription>Preencha os dados da aspiração</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="doadora_id">Doadora *</Label>
                  <Select
                    value={formData.doadora_id}
                    onValueChange={(value) => setFormData({ ...formData, doadora_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a doadora" />
                    </SelectTrigger>
                    <SelectContent>
                      {doadoras.map((doadora) => (
                        <SelectItem key={doadora.id} value={doadora.id}>
                          {doadora.nome || doadora.registro || doadora.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fazenda_id">Fazenda *</Label>
                  <Select
                    value={formData.fazenda_id}
                    onValueChange={(value) => setFormData({ ...formData, fazenda_id: value })}
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="data_aspiracao">Data de Aspiração *</Label>
                  <Input
                    id="data_aspiracao"
                    type="date"
                    value={formData.data_aspiracao}
                    onChange={(e) => setFormData({ ...formData, data_aspiracao: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="horario_aspiracao">Horário</Label>
                  <Input
                    id="horario_aspiracao"
                    type="time"
                    value={formData.horario_aspiracao}
                    onChange={(e) =>
                      setFormData({ ...formData, horario_aspiracao: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Contagem de Oócitos</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="atresicos">Atrésicos</Label>
                    <Input
                      id="atresicos"
                      type="number"
                      min="0"
                      value={formData.atresicos}
                      onChange={(e) => setFormData({ ...formData, atresicos: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="degenerados">Degenerados</Label>
                    <Input
                      id="degenerados"
                      type="number"
                      min="0"
                      value={formData.degenerados}
                      onChange={(e) => setFormData({ ...formData, degenerados: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expandidos">Expandidos</Label>
                    <Input
                      id="expandidos"
                      type="number"
                      min="0"
                      value={formData.expandidos}
                      onChange={(e) => setFormData({ ...formData, expandidos: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="desnudos">Desnudos</Label>
                    <Input
                      id="desnudos"
                      type="number"
                      min="0"
                      value={formData.desnudos}
                      onChange={(e) => setFormData({ ...formData, desnudos: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="viaveis">Viáveis</Label>
                    <Input
                      id="viaveis"
                      type="number"
                      min="0"
                      value={formData.viaveis}
                      onChange={(e) => setFormData({ ...formData, viaveis: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Total</Label>
                    <Input value={calculateTotal(formData)} disabled />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="veterinario_responsavel">Veterinário Responsável</Label>
                  <Input
                    id="veterinario_responsavel"
                    value={formData.veterinario_responsavel}
                    onChange={(e) =>
                      setFormData({ ...formData, veterinario_responsavel: e.target.value })
                    }
                    placeholder="Nome do veterinário"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tecnico_responsavel">Técnico Responsável</Label>
                  <Input
                    id="tecnico_responsavel"
                    value={formData.tecnico_responsavel}
                    onChange={(e) =>
                      setFormData({ ...formData, tecnico_responsavel: e.target.value })
                    }
                    placeholder="Nome do técnico"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Observações sobre a aspiração"
                  rows={3}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="submit"
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={submitting}
                >
                  {submitting ? 'Salvando...' : 'Salvar'}
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
          <CardTitle>Lista de Aspirações</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Doadora</TableHead>
                <TableHead>Fazenda</TableHead>
                <TableHead>Viáveis</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Veterinário</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {aspiracoes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-500">
                    Nenhuma aspiração registrada
                  </TableCell>
                </TableRow>
              ) : (
                aspiracoes.map((aspiracao) => (
                  <TableRow key={aspiracao.id}>
                    <TableCell>
                      {new Date(aspiracao.data_aspiracao).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>{aspiracao.doadora_nome || '-'}</TableCell>
                    <TableCell>{aspiracao.fazenda_nome || '-'}</TableCell>
                    <TableCell className="font-medium">{aspiracao.viaveis || 0}</TableCell>
                    <TableCell>{aspiracao.total_oocitos || 0}</TableCell>
                    <TableCell>{aspiracao.veterinario_responsavel || '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(aspiracao)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog - Similar structure to create dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Aspiração</DialogTitle>
            <DialogDescription>Atualizar dados da aspiração</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            {/* Same form fields as create, but with editFormData */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Doadora *</Label>
                <Select
                  value={editFormData.doadora_id}
                  onValueChange={(value) => setEditFormData({ ...editFormData, doadora_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {doadoras.map((doadora) => (
                      <SelectItem key={doadora.id} value={doadora.id}>
                        {doadora.nome || doadora.registro || doadora.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Fazenda *</Label>
                <Select
                  value={editFormData.fazenda_id}
                  onValueChange={(value) => setEditFormData({ ...editFormData, fazenda_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data de Aspiração *</Label>
                <Input
                  type="date"
                  value={editFormData.data_aspiracao}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, data_aspiracao: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Horário</Label>
                <Input
                  type="time"
                  value={editFormData.horario_aspiracao}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, horario_aspiracao: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">Contagem de Oócitos</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Atrésicos</Label>
                  <Input
                    type="number"
                    min="0"
                    value={editFormData.atresicos}
                    onChange={(e) => setEditFormData({ ...editFormData, atresicos: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Degenerados</Label>
                  <Input
                    type="number"
                    min="0"
                    value={editFormData.degenerados}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, degenerados: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Expandidos</Label>
                  <Input
                    type="number"
                    min="0"
                    value={editFormData.expandidos}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, expandidos: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Desnudos</Label>
                  <Input
                    type="number"
                    min="0"
                    value={editFormData.desnudos}
                    onChange={(e) => setEditFormData({ ...editFormData, desnudos: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Viáveis</Label>
                  <Input
                    type="number"
                    min="0"
                    value={editFormData.viaveis}
                    onChange={(e) => setEditFormData({ ...editFormData, viaveis: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Total</Label>
                  <Input value={calculateTotal(editFormData)} disabled />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Veterinário Responsável</Label>
                <Input
                  value={editFormData.veterinario_responsavel}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, veterinario_responsavel: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Técnico Responsável</Label>
                <Input
                  value={editFormData.tecnico_responsavel}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, tecnico_responsavel: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={editFormData.observacoes}
                onChange={(e) => setEditFormData({ ...editFormData, observacoes: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="submit"
                className="flex-1 bg-green-600 hover:bg-green-700"
                disabled={submitting}
              >
                {submitting ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEditDialog(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}