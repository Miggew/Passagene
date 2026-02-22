import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { DoseSemen, Touro, DoseSemenInsert } from '@/lib/types';
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
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Search, Users, Dna, X } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';

interface DoseSemenWithInfo extends DoseSemen {
  cliente_nome?: string;
  touro_nome?: string;
  touro_registro?: string;
  touro_raca?: string;
}

interface Cliente {
  id: string;
  nome: string;
}

export default function DosesSemen() {
  const [doses, setDoses] = useState<DoseSemenWithInfo[]>([]);
  const [touros, setTouros] = useState<Touro[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingDose, setEditingDose] = useState<DoseSemenWithInfo | null>(null);
  const [deletingDose, setDeletingDose] = useState<DoseSemenWithInfo | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    touro_id: '',
    cliente_id: '',
    tipo_semen: '',
    quantidade: '',
  });

  const [editFormData, setEditFormData] = useState({
    touro_id: '',
    cliente_id: '',
    tipo_semen: '',
    quantidade: '',
  });

  const [filtroTouro, setFiltroTouro] = useState('');
  const [filtroCliente, setFiltroCliente] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load touros
      const { data: tourosData, error: tourosError } = await supabase
        .from('touros')
        .select('*')
        .order('nome', { ascending: true });

      if (tourosError) throw tourosError;
      setTouros(tourosData || []);

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
        .order('created_at', { ascending: false });

      if (dosesError) throw dosesError;

      // Enriquecer doses com informações do touro e cliente
      const tourosMap = new Map(tourosData?.map((t) => [t.id, t]) || []);
      const clientesMap = new Map(clientesData?.map((c) => [c.id, c.nome]) || []);

      const dosesWithInfo: DoseSemenWithInfo[] = (dosesData || []).map((d) => {
        const touro = tourosMap.get(d.touro_id);
        return {
          ...d,
          cliente_nome: d.cliente_id ? clientesMap.get(d.cliente_id) : undefined,
          touro_nome: touro?.nome,
          touro_registro: touro?.registro,
          touro_raca: touro?.raca,
        };
      });

      setDoses(dosesWithInfo);
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

    if (!formData.touro_id) {
      toast({
        title: 'Erro de validação',
        description: 'Selecione um touro do catálogo',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.cliente_id) {
      toast({
        title: 'Erro de validação',
        description: 'Selecione um cliente',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.tipo_semen) {
      toast({
        title: 'Erro de validação',
        description: 'Selecione o tipo de sêmen',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const insertData: DoseSemenInsert = {
        touro_id: formData.touro_id,
        cliente_id: formData.cliente_id,
        tipo_semen: formData.tipo_semen as 'CONVENCIONAL' | 'SEXADO' | undefined,
        quantidade: parseInt(formData.quantidade) || 0,
      };

      const { error } = await supabase.from('doses_semen').insert([insertData]).select();

      if (error) throw error;

      toast({
        title: 'Dose criada',
        description: 'Dose de sêmen criada com sucesso',
      });

      setShowDialog(false);
      setFormData({
        touro_id: '',
        cliente_id: '',
        tipo_semen: '',
        quantidade: '',
      });
      loadData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao criar dose',
        description: errorMessage.includes('RLS') || errorMessage.includes('policy')
          ? 'RLS está bloqueando escrita. Configure políticas anon no Supabase.'
          : errorMessage,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (dose: DoseSemenWithInfo) => {
    setEditingDose(dose);
    setEditFormData({
      touro_id: dose.touro_id,
      cliente_id: dose.cliente_id || '',
      tipo_semen: dose.tipo_semen || '',
      quantidade: dose.quantidade?.toString() || '',
    });
    setShowEditDialog(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingDose) return;

    if (!editFormData.touro_id) {
      toast({
        title: 'Erro de validação',
        description: 'Selecione um touro do catálogo',
        variant: 'destructive',
      });
      return;
    }

    if (!editFormData.cliente_id) {
      toast({
        title: 'Erro de validação',
        description: 'Selecione um cliente',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const updateData: DoseSemenInsert = {
        touro_id: editFormData.touro_id,
        cliente_id: editFormData.cliente_id,
        tipo_semen: editFormData.tipo_semen as 'CONVENCIONAL' | 'SEXADO' | undefined,
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

  const dosesFiltradas = doses.filter((dose) => {
    const touroMatch = !filtroTouro || 
      dose.touro_nome?.toLowerCase().includes(filtroTouro.toLowerCase()) ||
      dose.touro_registro?.toLowerCase().includes(filtroTouro.toLowerCase());
    const clienteMatch = !filtroCliente || 
      dose.cliente_nome?.toLowerCase().includes(filtroCliente.toLowerCase());
    const tipoMatch = !filtroTipo || dose.tipo_semen === filtroTipo;
    return touroMatch && clienteMatch && tipoMatch;
  });

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Doses de Sêmen"
        description="Gerenciar doses de sêmen dos clientes relacionadas aos touros do catálogo"
        actions={
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nova Dose
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Criar Nova Dose de Sêmen</DialogTitle>
                <DialogDescription>
                  Selecione um touro do catálogo e um cliente para criar a dose
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="touro_id">Touro do Catálogo *</Label>
                <Select
                  value={formData.touro_id}
                  onValueChange={(value) => setFormData({ ...formData, touro_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o touro" />
                  </SelectTrigger>
                  <SelectContent>
                    {touros.map((touro) => (
                      <SelectItem key={touro.id} value={touro.id}>
                        {touro.nome} ({touro.registro})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cliente_id">Cliente *</Label>
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
                <Label htmlFor="tipo_semen">Tipo de Sêmen *</Label>
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
                  placeholder="Quantidade de doses"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="submit"
                  className="flex-1"
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
        }
      />

      {/* Barra de Filtros Premium */}
      <div className="rounded-xl border border-border bg-gradient-to-r from-card via-card to-muted/30 p-4">
        <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end md:gap-6">
          {/* Grupo: Busca Touro */}
          <div className="flex items-end gap-3">
            <div className="w-1 h-6 rounded-full bg-primary/40 self-center" />
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground self-center">
              <Search className="w-3.5 h-3.5" />
              <span>Touro</span>
            </div>
            <div className="relative w-full md:w-auto md:flex-1 md:min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Nome ou registro do touro..."
                value={filtroTouro}
                onChange={(e) => setFiltroTouro(e.target.value)}
                className="pl-9 h-11 md:h-9"
              />
            </div>
          </div>

          {/* Separador */}
          <div className="h-10 w-px bg-border hidden md:block" />

          {/* Grupo: Cliente */}
          <div className="flex items-end gap-3">
            <div className="w-1 h-6 rounded-full bg-emerald-500/40 self-center" />
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground self-center">
              <Users className="w-3.5 h-3.5" />
              <span>Cliente</span>
            </div>
            <div className="relative w-full md:w-auto md:flex-1 md:min-w-[180px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Nome do cliente..."
                value={filtroCliente}
                onChange={(e) => setFiltroCliente(e.target.value)}
                className="pl-9 h-11 md:h-9"
              />
            </div>
          </div>

          {/* Separador */}
          <div className="h-10 w-px bg-border hidden md:block" />

          {/* Grupo: Tipo */}
          <div className="flex items-end gap-3">
            <div className="w-1 h-6 rounded-full bg-blue-500/40 self-center" />
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground self-center">
              <Dna className="w-3.5 h-3.5" />
              <span>Tipo</span>
            </div>
            <div className="w-full md:w-[160px]">
              <Select value={filtroTipo || 'all'} onValueChange={(value) => setFiltroTipo(value === 'all' ? '' : value)}>
                <SelectTrigger className="h-11 md:h-9">
                  <SelectValue placeholder="Todos os tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="CONVENCIONAL">CONVENCIONAL</SelectItem>
                  <SelectItem value="SEXADO">SEXADO</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Botão Limpar */}
          {(filtroTouro || filtroCliente || filtroTipo) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFiltroTouro('');
                setFiltroCliente('');
                setFiltroTipo('');
              }}
              className="h-9 ml-auto"
            >
              <X className="w-4 h-4 mr-2" />
              Limpar Filtros
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Doses de Sêmen ({dosesFiltradas.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {dosesFiltradas.length === 0 ? (
              <EmptyState title="Nenhuma dose cadastrada" description="Cadastre a primeira dose para começar." />
            ) : (
              dosesFiltradas.map((dose) => (
                <div key={dose.id} className="rounded-xl border border-border/60 glass-panel shadow-sm p-3.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-medium text-base truncate">{dose.touro_nome || '-'}</span>
                    {dose.tipo_semen && <Badge variant="secondary">{dose.tipo_semen}</Badge>}
                  </div>
                  {dose.touro_registro && (
                    <p className="text-sm text-muted-foreground mb-2">{dose.touro_registro}</p>
                  )}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm mb-3">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase block">Raca</span>
                      <span className="font-medium">{dose.touro_raca || '-'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase block">Quantidade</span>
                      <span className="font-medium text-base">{dose.quantidade ?? '-'}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[10px] text-muted-foreground uppercase block">Cliente</span>
                      <span className="font-medium">{dose.cliente_nome || '-'}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-3 border-t border-border/50">
                    <Button variant="outline" size="sm" className="flex-1 h-11" onClick={() => handleEdit(dose)}>
                      <Edit className="w-4 h-4 mr-2" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-11 text-red-600 hover:text-red-700"
                      onClick={() => { setDeletingDose(dose); setShowDeleteDialog(true); }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Touro</TableHead>
                <TableHead>Registro</TableHead>
                <TableHead>Raça</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Quantidade</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dosesFiltradas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    <EmptyState
                      title="Nenhuma dose cadastrada"
                      description="Cadastre a primeira dose para começar."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                dosesFiltradas.map((dose) => (
                  <TableRow key={dose.id}>
                    <TableCell className="font-medium">{dose.touro_nome || '-'}</TableCell>
                    <TableCell>{dose.touro_registro || '-'}</TableCell>
                    <TableCell>
                      {dose.touro_raca ? <Badge variant="outline">{dose.touro_raca}</Badge> : '-'}
                    </TableCell>
                    <TableCell>{dose.cliente_nome || '-'}</TableCell>
                    <TableCell>
                      {dose.tipo_semen ? <Badge variant="secondary">{dose.tipo_semen}</Badge> : '-'}
                    </TableCell>
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
          </div>
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
              <Label htmlFor="edit_touro_id">Touro do Catálogo *</Label>
              <Select
                value={editFormData.touro_id}
                onValueChange={(value) => setEditFormData({ ...editFormData, touro_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o touro" />
                </SelectTrigger>
                <SelectContent>
                  {touros.map((touro) => (
                    <SelectItem key={touro.id} value={touro.id}>
                      {touro.nome} ({touro.registro})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_cliente_id">Cliente *</Label>
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
              <Label htmlFor="edit_tipo_semen">Tipo de Sêmen *</Label>
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

            <div className="space-y-2">
              <Label htmlFor="edit_quantidade">Quantidade</Label>
              <Input
                id="edit_quantidade"
                type="number"
                min="0"
                value={editFormData.quantidade}
                onChange={(e) => setEditFormData({ ...editFormData, quantidade: e.target.value })}
                placeholder="Quantidade de doses"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="submit"
                className="flex-1"
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
              Tem certeza que deseja excluir a dose do touro "{deletingDose?.touro_nome}" do cliente "{deletingDose?.cliente_nome}"? Esta ação não pode ser desfeita.
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
