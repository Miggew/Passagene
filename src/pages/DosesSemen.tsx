import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { DoseSemen } from '@/lib/types';
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
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DoseSemenWithCliente extends DoseSemen {
  cliente_nome?: string;
}

interface Cliente {
  id: string;
  nome: string;
}

export default function DosesSemen() {
  const [doses, setDoses] = useState<DoseSemenWithCliente[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingDose, setEditingDose] = useState<DoseSemen | null>(null);
  const [deletingDose, setDeletingDose] = useState<DoseSemen | null>(null);
  const { toast } = useToast();

  const racasBovinas = ['Holandesa', 'Jersey', 'Gir', 'Girolando', 'Nelore', 'Angus', 'Brahman', 'Hereford', 'Simmental', 'Tabapuã', 'Sindi', 'Caracu', 'Canchim', 'Senepol', 'Brangus'];

  const [formData, setFormData] = useState({
    cliente_id: '',
    nome: '',
    raca: '',
    tipo_semen: '',
    quantidade: '',
  });

  const [editFormData, setEditFormData] = useState({
    cliente_id: '',
    nome: '',
    raca: '',
    tipo_semen: '',
    quantidade: '',
  });

  const [filtroNome, setFiltroNome] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroRaca, setFiltroRaca] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load clientes
      const { data: clientesData, error: clientesError } = await supabase
        .from('clientes')
        .select('id, nome')
        .order('nome', { ascending: true });

      if (clientesError) throw clientesError;
      setClientes(clientesData || []);

      // Load doses
      const { data: dosesData, error: dosesError } = await supabase
        .from('doses_semen')
        .select('*')
        .order('nome', { ascending: true });

      if (dosesError) throw dosesError;

      const clientesMap = new Map(clientesData?.map((c) => [c.id, c.nome]));

      const dosesWithCliente = dosesData?.map((d) => ({
        ...d,
        cliente_nome: d.cliente_id ? clientesMap.get(d.cliente_id) : undefined,
      }));

      setDoses(dosesWithCliente || []);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nome.trim()) {
      toast({
        title: 'Erro de validação',
        description: 'Nome é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const insertData: Record<string, string | number | null> = {
        nome: formData.nome,
        cliente_id: formData.cliente_id || null,
        raca: formData.raca || null,
        tipo_semen: formData.tipo_semen || null,
        quantidade: parseInt(formData.quantidade) || 0,
      };

      console.log('Dados sendo inseridos:', insertData);
      const { error, data } = await supabase.from('doses_semen').insert([insertData]).select();

      if (error) {
        console.error('Erro detalhado:', error);
        throw error;
      }

      toast({
        title: 'Dose criada',
        description: 'Dose de sêmen criada com sucesso',
      });

      setShowDialog(false);
      setFormData({
        cliente_id: '',
        nome: '',
        raca: '',
        tipo_semen: '',
        quantidade: '',
      });
      loadData();
    } catch (error) {
      console.error('Erro completo:', error);
      let errorMessage = 'Erro desconhecido';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        errorMessage = JSON.stringify(error, null, 2);
      }
      toast({
        title: 'Erro ao criar dose',
        description: errorMessage.includes('RLS') || errorMessage.includes('policy')
          ? 'RLS está bloqueando escrita. Configure políticas anon no Supabase.'
          : errorMessage.length > 200 
          ? errorMessage.substring(0, 200) + '...'
          : errorMessage,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (dose: DoseSemen) => {
    setEditingDose(dose);
    setEditFormData({
      cliente_id: dose.cliente_id || '',
      nome: dose.nome,
      raca: dose.raca || '',
      tipo_semen: dose.tipo_semen || '',
      quantidade: dose.quantidade?.toString() || '',
    });
    setShowEditDialog(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingDose) return;

    if (!editFormData.nome.trim()) {
      toast({
        title: 'Erro de validação',
        description: 'Nome é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const updateData: Record<string, string | number | null> = {
        nome: editFormData.nome,
        cliente_id: editFormData.cliente_id || null,
        raca: editFormData.raca || null,
        tipo_semen: editFormData.tipo_semen || null,
        quantidade: parseInt(editFormData.quantidade) || 0,
      };

      const { error } = await supabase
        .from('doses_semen')
        .update(updateData)
        .eq('id', editingDose.id);

      if (error) throw error;

      toast({
        title: 'Dose atualizada',
        description: 'Dose de sêmen atualizada com sucesso',
      });

      setShowEditDialog(false);
      setEditingDose(null);
      loadData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao atualizar dose',
        description: errorMessage.includes('RLS') || errorMessage.includes('policy')
          ? 'RLS está bloqueando escrita. Configure políticas anon no Supabase.'
          : errorMessage,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingDose) return;

    try {
      setSubmitting(true);

      const { error } = await supabase.from('doses_semen').delete().eq('id', deletingDose.id);

      if (error) throw error;

      toast({
        title: 'Dose excluída',
        description: 'Dose de sêmen excluída com sucesso',
      });

      setShowDeleteDialog(false);
      setDeletingDose(null);
      loadData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao excluir dose',
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
          <h1 className="text-3xl font-bold text-slate-900">Doses de Sêmen</h1>
          <p className="text-slate-600 mt-1">Gerenciar doses de sêmen disponíveis</p>
        </div>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button className="bg-green-600 hover:bg-green-700">
              <Plus className="w-4 h-4 mr-2" />
              Nova Dose
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Criar Nova Dose de Sêmen</DialogTitle>
              <DialogDescription>Preencha os dados da dose</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Nome do touro/reprodutor"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cliente_id">Cliente</Label>
                <Select
                  value={formData.cliente_id}
                  onValueChange={(value) => setFormData({ ...formData, cliente_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map((cliente) => (
                      <SelectItem key={cliente.id} value={cliente.id}>
                        {cliente.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="raca">Raça</Label>
                <Select
                  value={formData.raca}
                  onValueChange={(value) => setFormData({ ...formData, raca: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a raça" />
                  </SelectTrigger>
                  <SelectContent>
                    {racasBovinas.map((raca) => (
                      <SelectItem key={raca} value={raca}>
                        {raca}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tipo_semen">Tipo de Sêmen</Label>
                <Select
                  value={formData.tipo_semen}
                  onValueChange={(value) => setFormData({ ...formData, tipo_semen: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CONVENCIONAL">CONVENCIONAL</SelectItem>
                    <SelectItem value="SEXADO">SEXADO</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantidade">Quantidade</Label>
                <Input
                  id="quantidade"
                  type="number"
                  min="0"
                  value={formData.quantidade}
                  onChange={(e) => setFormData({ ...formData, quantidade: e.target.value })}
                  placeholder="Quantidade a ser adicionada"
                  required
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
          <CardTitle>Lista de Doses de Sêmen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Filtrar por Touro</Label>
                <Input
                  placeholder="Buscar por nome do touro..."
                  value={filtroNome}
                  onChange={(e) => setFiltroNome(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Filtrar por Tipo</Label>
                <Select value={filtroTipo || 'all'} onValueChange={(value) => setFiltroTipo(value === 'all' ? '' : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    <SelectItem value="CONVENCIONAL">CONVENCIONAL</SelectItem>
                    <SelectItem value="SEXADO">SEXADO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Filtrar por Raça</Label>
                <Select value={filtroRaca || 'all'} onValueChange={(value) => setFiltroRaca(value === 'all' ? '' : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as raças" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as raças</SelectItem>
                    {racasBovinas.map((raca) => (
                      <SelectItem key={raca} value={raca}>
                        {raca}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome (Touro)</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Raça</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Quantidade</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {doses
                .filter((dose) => {
                  const nomeMatch = !filtroNome || dose.nome.toLowerCase().includes(filtroNome.toLowerCase());
                  const tipoMatch = !filtroTipo || dose.tipo_semen === filtroTipo;
                  const racaMatch = !filtroRaca || dose.raca === filtroRaca;
                  return nomeMatch && tipoMatch && racaMatch;
                })
                .length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-500">
                    Nenhuma dose cadastrada
                  </TableCell>
                </TableRow>
              ) : (
                doses
                  .filter((dose) => {
                    const nomeMatch = !filtroNome || dose.nome.toLowerCase().includes(filtroNome.toLowerCase());
                    const tipoMatch = !filtroTipo || dose.tipo_semen === filtroTipo;
                    const racaMatch = !filtroRaca || dose.raca === filtroRaca;
                    return nomeMatch && tipoMatch && racaMatch;
                  })
                  .map((dose) => (
                    <TableRow key={dose.id}>
                      <TableCell className="font-medium">{dose.nome}</TableCell>
                      <TableCell>{dose.cliente_nome || '-'}</TableCell>
                      <TableCell>{dose.raca || '-'}</TableCell>
                      <TableCell>{dose.tipo_semen || '-'}</TableCell>
                      <TableCell>{dose.quantidade ?? '-'}</TableCell>
                      <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(dose)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDeletingDose(dose);
                            setShowDeleteDialog(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Dose de Sêmen</DialogTitle>
            <DialogDescription>Atualizar dados da dose</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit_nome">Nome *</Label>
              <Input
                id="edit_nome"
                value={editFormData.nome}
                onChange={(e) => setEditFormData({ ...editFormData, nome: e.target.value })}
                placeholder="Nome do touro/reprodutor"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_cliente_id">Cliente</Label>
              <Select
                value={editFormData.cliente_id}
                onValueChange={(value) => setEditFormData({ ...editFormData, cliente_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((cliente) => (
                    <SelectItem key={cliente.id} value={cliente.id}>
                      {cliente.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_raca">Raça</Label>
              <Select
                value={editFormData.raca}
                onValueChange={(value) => setEditFormData({ ...editFormData, raca: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a raça" />
                </SelectTrigger>
                <SelectContent>
                  {racasBovinas.map((raca) => (
                    <SelectItem key={raca} value={raca}>
                      {raca}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_quantidade">Quantidade</Label>
              <Input
                id="edit_quantidade"
                type="number"
                min="0"
                value={editFormData.quantidade}
                onChange={(e) => setEditFormData({ ...editFormData, quantidade: e.target.value })}
                placeholder="Quantidade"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_tipo_semen">Tipo de Sêmen</Label>
              <Select
                value={editFormData.tipo_semen}
                onValueChange={(value) => setEditFormData({ ...editFormData, tipo_semen: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CONVENCIONAL">CONVENCIONAL</SelectItem>
                  <SelectItem value="SEXADO">SEXADO</SelectItem>
                </SelectContent>
              </Select>
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

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a dose "{deletingDose?.nome}"? Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={submitting}
              className="bg-red-600 hover:bg-red-700"
            >
              {submitting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}