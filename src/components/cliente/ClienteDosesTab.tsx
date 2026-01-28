import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { DoseSemenComTouro, Touro } from '@/lib/types';
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
import { Badge } from '@/components/ui/badge';
import EmptyState from '@/components/shared/EmptyState';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Search, Minus, PlusCircle } from 'lucide-react';

interface ClienteDosesTabProps {
  clienteId: string;
  clienteNome: string;
  doses: DoseSemenComTouro[];
  onReload: () => void;
}

export function ClienteDosesTab({ clienteId, clienteNome, doses, onReload }: ClienteDosesTabProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [showDialog, setShowDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [touros, setTouros] = useState<Touro[]>([]);
  const [loadingTouros, setLoadingTouros] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    touro_id: '',
    tipo_semen: 'CONVENCIONAL' as 'CONVENCIONAL' | 'SEXADO',
    quantidade: 1,
  });

  // Edição de quantidade
  const [editingDoseId, setEditingDoseId] = useState<string | null>(null);
  const [editQuantidade, setEditQuantidade] = useState<number>(0);

  // Filtrar doses
  const filteredDoses = doses.filter((dose) => {
    const touro = dose.touro;
    const matchesSearch = !searchTerm ||
      touro?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      touro?.registro?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      touro?.raca?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesTipo = filtroTipo === 'todos' || dose.tipo_semen === filtroTipo;

    return matchesSearch && matchesTipo;
  });

  // Carregar touros disponíveis
  const loadTouros = async () => {
    setLoadingTouros(true);
    try {
      const { data, error } = await supabase
        .from('touros')
        .select('id, nome, registro, raca')
        .eq('disponivel', true)
        .order('nome');

      if (error) throw error;
      setTouros(data || []);
    } catch (error) {
      toast({
        title: 'Erro ao carregar touros',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoadingTouros(false);
    }
  };

  const handleOpenDialog = () => {
    loadTouros();
    setFormData({
      touro_id: '',
      tipo_semen: 'CONVENCIONAL',
      quantidade: 1,
    });
    setShowDialog(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.touro_id) {
      toast({
        title: 'Erro',
        description: 'Selecione um touro',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      // Verificar se já existe dose desse touro/tipo para esse cliente
      const existingDose = doses.find(
        d => d.touro_id === formData.touro_id && d.tipo_semen === formData.tipo_semen
      );

      if (existingDose) {
        // Atualizar quantidade existente
        const { error } = await supabase
          .from('doses_semen')
          .update({ quantidade: (existingDose.quantidade || 0) + formData.quantidade })
          .eq('id', existingDose.id);

        if (error) throw error;

        toast({
          title: 'Doses adicionadas',
          description: `Adicionadas ${formData.quantidade} doses ao estoque existente`,
        });
      } else {
        // Criar nova entrada
        const { error } = await supabase
          .from('doses_semen')
          .insert([{
            cliente_id: clienteId,
            touro_id: formData.touro_id,
            tipo_semen: formData.tipo_semen,
            quantidade: formData.quantidade,
          }]);

        if (error) throw error;

        toast({
          title: 'Doses cadastradas',
          description: 'Doses de sêmen cadastradas com sucesso',
        });
      }

      setShowDialog(false);
      onReload();
    } catch (error) {
      toast({
        title: 'Erro ao salvar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditQuantidade = (dose: DoseSemenComTouro) => {
    setEditingDoseId(dose.id);
    setEditQuantidade(dose.quantidade || 0);
  };

  const handleSaveQuantidade = async () => {
    if (!editingDoseId) return;

    try {
      const { error } = await supabase
        .from('doses_semen')
        .update({ quantidade: editQuantidade })
        .eq('id', editingDoseId);

      if (error) throw error;

      toast({
        title: 'Quantidade atualizada',
        description: 'Quantidade de doses atualizada com sucesso',
      });

      setEditingDoseId(null);
      onReload();
    } catch (error) {
      toast({
        title: 'Erro ao atualizar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  };

  const handleAjustarQuantidade = async (doseId: string, delta: number) => {
    const dose = doses.find(d => d.id === doseId);
    if (!dose) return;

    const novaQuantidade = Math.max(0, (dose.quantidade || 0) + delta);

    try {
      const { error } = await supabase
        .from('doses_semen')
        .update({ quantidade: novaQuantidade })
        .eq('id', doseId);

      if (error) throw error;
      onReload();
    } catch (error) {
      toast({
        title: 'Erro ao atualizar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  };

  // Estatísticas
  const totalDoses = doses.reduce((sum, d) => sum + (d.quantidade || 0), 0);
  const dosesConvencionais = doses
    .filter(d => d.tipo_semen === 'CONVENCIONAL')
    .reduce((sum, d) => sum + (d.quantidade || 0), 0);
  const dosesSexadas = doses
    .filter(d => d.tipo_semen === 'SEXADO')
    .reduce((sum, d) => sum + (d.quantidade || 0), 0);
  const tourosUnicos = new Set(doses.map(d => d.touro_id)).size;

  return (
    <div className="space-y-4">
      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-slate-500">Total de Doses</p>
            <p className="text-2xl font-bold">{totalDoses}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-slate-500">Convencionais</p>
            <p className="text-2xl font-bold">{dosesConvencionais}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-slate-500">Sexadas</p>
            <p className="text-2xl font-bold">{dosesSexadas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-slate-500">Touros</p>
            <p className="text-2xl font-bold">{tourosUnicos}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros e ações */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar touro..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="CONVENCIONAL">Convencional</SelectItem>
              <SelectItem value="SEXADO">Sexado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Doses
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Doses de Sêmen</DialogTitle>
              <DialogDescription>
                Adicionar doses para {clienteNome}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Touro *</Label>
                <Select
                  value={formData.touro_id}
                  onValueChange={(v) => setFormData({ ...formData, touro_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingTouros ? "Carregando..." : "Selecione o touro"} />
                  </SelectTrigger>
                  <SelectContent>
                    {touros.map((touro) => (
                      <SelectItem key={touro.id} value={touro.id}>
                        {touro.nome} {touro.registro && `(${touro.registro})`} - {touro.raca || 'S/R'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tipo de Sêmen</Label>
                <Select
                  value={formData.tipo_semen}
                  onValueChange={(v) => setFormData({ ...formData, tipo_semen: v as 'CONVENCIONAL' | 'SEXADO' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CONVENCIONAL">Convencional</SelectItem>
                    <SelectItem value="SEXADO">Sexado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  min={1}
                  value={formData.quantidade}
                  onChange={(e) => setFormData({ ...formData, quantidade: parseInt(e.target.value) || 1 })}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={submitting}
                >
                  {submitting ? 'Salvando...' : 'Adicionar'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDialog(false)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>Doses de Sêmen ({filteredDoses.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredDoses.length === 0 ? (
            <EmptyState
              title="Nenhuma dose encontrada"
              description={searchTerm || filtroTipo !== 'todos'
                ? "Tente ajustar os filtros"
                : "Cadastre a primeira dose de sêmen"
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Touro</TableHead>
                  <TableHead>Raça</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-center">Quantidade</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDoses.map((dose) => {
                  const touro = dose.touro;
                  const isEditing = editingDoseId === dose.id;

                  return (
                    <TableRow key={dose.id}>
                      <TableCell className="font-medium">
                        {touro?.nome || 'Touro desconhecido'}
                        {touro?.registro && (
                          <span className="text-slate-500 ml-2">({touro.registro})</span>
                        )}
                      </TableCell>
                      <TableCell>{touro?.raca || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={dose.tipo_semen === 'SEXADO' ? 'default' : 'secondary'}>
                          {dose.tipo_semen || 'CONVENCIONAL'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-2">
                            <Input
                              type="number"
                              min={0}
                              value={editQuantidade}
                              onChange={(e) => setEditQuantidade(parseInt(e.target.value) || 0)}
                              className="w-20 text-center"
                            />
                            <Button size="sm" onClick={handleSaveQuantidade}>
                              Salvar
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingDoseId(null)}>
                              Cancelar
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAjustarQuantidade(dose.id, -1)}
                              disabled={(dose.quantidade || 0) <= 0}
                            >
                              <Minus className="w-4 h-4" />
                            </Button>
                            <span className="font-medium min-w-[3ch] text-center">
                              {dose.quantidade ?? 0}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAjustarQuantidade(dose.id, 1)}
                            >
                              <PlusCircle className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditQuantidade(dose)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
