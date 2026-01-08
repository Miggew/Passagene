import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Receptora, Fazenda, ReceptoraComStatus } from '@/lib/types';
import { calcularStatusReceptoras } from '@/lib/receptoraStatus';
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
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Search, History } from 'lucide-react';
import ReceptoraHistorico from './ReceptoraHistorico';

export default function Receptoras() {
  const [receptoras, setReceptoras] = useState<ReceptoraComStatus[]>([]);
  const [filteredReceptoras, setFilteredReceptoras] = useState<ReceptoraComStatus[]>([]);
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [selectedFazendaId, setSelectedFazendaId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingFazendas, setLoadingFazendas] = useState(true);
  const [loadingReceptoras, setLoadingReceptoras] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showHistorico, setShowHistorico] = useState(false);
  const [selectedReceptoraId, setSelectedReceptoraId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingReceptora, setEditingReceptora] = useState<Receptora | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    identificacao: '',
    nome: '',
  });

  const [editFormData, setEditFormData] = useState({
    identificacao: '',
    nome: '',
  });

  useEffect(() => {
    loadFazendas();
  }, []);

  useEffect(() => {
    if (selectedFazendaId) {
      loadReceptoras();
    } else {
      setReceptoras([]);
      setFilteredReceptoras([]);
    }
  }, [selectedFazendaId]);

  useEffect(() => {
    filterReceptoras();
  }, [searchTerm, receptoras]);

  const filterReceptoras = () => {
    if (!searchTerm.trim()) {
      setFilteredReceptoras(receptoras);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = receptoras.filter(
      (r) =>
        r.identificacao.toLowerCase().includes(term) ||
        r.nome?.toLowerCase().includes(term)
    );
    setFilteredReceptoras(filtered);
  };

  const loadFazendas = async () => {
    try {
      setLoadingFazendas(true);
      const { data, error } = await supabase
        .from('fazendas')
        .select('id, nome')
        .order('nome', { ascending: true });

      if (error) throw error;
      setFazendas(data || []);
    } catch (error) {
      toast({
        title: 'Erro ao carregar fazendas',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoadingFazendas(false);
    }
  };

  const loadReceptoras = async () => {
    try {
      setLoadingReceptoras(true);

      const { data, error } = await supabase
        .from('receptoras')
        .select('*')
        .eq('fazenda_atual_id', selectedFazendaId)
        .order('identificacao', { ascending: true });

      if (error) throw error;

      // Calculate status for all receptoras
      const receptoraIds = data?.map(r => r.id) || [];
      const statusMap = await calcularStatusReceptoras(receptoraIds);

      const receptorasComStatus: ReceptoraComStatus[] = (data || []).map(r => ({
        ...r,
        status_calculado: statusMap.get(r.id) || 'VAZIA',
      }));

      setReceptoras(receptorasComStatus);
      setFilteredReceptoras(receptorasComStatus);
    } catch (error) {
      toast({
        title: 'Erro ao carregar receptoras',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoadingReceptoras(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.identificacao.trim()) {
      toast({
        title: 'Erro de validação',
        description: 'Identificação (brinco) é obrigatória',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedFazendaId) {
      toast({
        title: 'Erro de validação',
        description: 'Selecione uma fazenda primeiro',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const insertData: Record<string, string> = {
        identificacao: formData.identificacao,
        fazenda_atual_id: selectedFazendaId,
      };

      if (formData.nome.trim()) {
        insertData.nome = formData.nome;
      }

      const { error } = await supabase
        .from('receptoras')
        .insert([insertData]);

      if (error) {
        if (error.code === '23505') {
          throw new Error('Já existe uma receptora com esse brinco nesta fazenda.');
        }
        throw error;
      }

      toast({
        title: 'Receptora criada',
        description: 'Receptora criada com sucesso',
      });

      setShowDialog(false);
      setFormData({
        identificacao: '',
        nome: '',
      });
      loadReceptoras();
    } catch (error) {
      toast({
        title: 'Erro ao criar receptora',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (receptora: Receptora) => {
    setEditingReceptora(receptora);
    setEditFormData({
      identificacao: receptora.identificacao,
      nome: receptora.nome || '',
    });
    setShowEditDialog(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingReceptora) return;

    if (!editFormData.identificacao.trim()) {
      toast({
        title: 'Erro de validação',
        description: 'Identificação (brinco) é obrigatória',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const updateData: Record<string, string | null> = {
        identificacao: editFormData.identificacao,
        nome: editFormData.nome.trim() || null,
      };

      const { error } = await supabase
        .from('receptoras')
        .update(updateData)
        .eq('id', editingReceptora.id);

      if (error) {
        if (error.code === '23505') {
          throw new Error('Já existe uma receptora com esse brinco nesta fazenda.');
        }
        throw error;
      }

      toast({
        title: 'Receptora atualizada',
        description: 'Receptora atualizada com sucesso',
      });

      setShowEditDialog(false);
      setEditingReceptora(null);
      loadReceptoras();
    } catch (error) {
      toast({
        title: 'Erro ao atualizar receptora',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', className?: string }> = {
      'VAZIA': { variant: 'outline' },
      'EM SINCRONIZAÇÃO': { variant: 'secondary' },
      'SINCRONIZADA': { variant: 'default' },
      'SERVIDA': { variant: 'default', className: 'bg-blue-600' },
      'PRENHE': { variant: 'default', className: 'bg-green-600' },
      'PRENHE (FÊMEA)': { variant: 'default', className: 'bg-pink-600' },
      'PRENHE (MACHO)': { variant: 'default', className: 'bg-blue-700' },
      'PRENHE (SEM SEXO)': { variant: 'default', className: 'bg-purple-600' },
    };

    const config = statusConfig[status] || { variant: 'outline' };
    return <Badge variant={config.variant} className={config.className}>{status}</Badge>;
  };

  if (loadingFazendas) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Receptoras</h1>
          <p className="text-slate-600 mt-1">Gerenciar receptoras por fazenda</p>
        </div>
      </div>

      {/* Fazenda Selection - OBRIGATÓRIO */}
      <Card>
        <CardHeader>
          <CardTitle>Selecione a Fazenda *</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedFazendaId} onValueChange={setSelectedFazendaId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione uma fazenda para listar receptoras" />
            </SelectTrigger>
            <SelectContent>
              {fazendas.map((fazenda) => (
                <SelectItem key={fazenda.id} value={fazenda.id}>
                  {fazenda.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {!selectedFazendaId ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-slate-500 text-lg">Selecione uma fazenda para listar receptoras</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Buscar por brinco ou nome..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
              <DialogTrigger asChild>
                <Button className="bg-green-600 hover:bg-green-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Receptora
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Criar Nova Receptora</DialogTitle>
                  <DialogDescription>
                    Criar receptora na fazenda selecionada
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="identificacao">Identificação (Brinco) *</Label>
                    <Input
                      id="identificacao"
                      value={formData.identificacao}
                      onChange={(e) => setFormData({ ...formData, identificacao: e.target.value })}
                      placeholder="Número do brinco"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome</Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      placeholder="Nome da receptora (opcional)"
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
              <CardTitle>Lista de Receptoras ({filteredReceptoras.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingReceptoras ? (
                <div className="py-8">
                  <LoadingSpinner />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Brinco</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Status Atual</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReceptoras.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-slate-500">
                          {searchTerm ? 'Nenhuma receptora encontrada' : 'Nenhuma receptora cadastrada nesta fazenda'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredReceptoras.map((receptora) => (
                        <TableRow key={receptora.id}>
                          <TableCell className="font-medium">{receptora.identificacao}</TableCell>
                          <TableCell>{receptora.nome || '-'}</TableCell>
                          <TableCell>{getStatusBadge(receptora.status_calculado)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(receptora)}
                                title="Editar"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedReceptoraId(receptora.id);
                                  setShowHistorico(true);
                                }}
                                title="Ver histórico"
                              >
                                <History className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Receptora</DialogTitle>
            <DialogDescription>
              Atualizar dados da receptora
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit_identificacao">Identificação (Brinco) *</Label>
              <Input
                id="edit_identificacao"
                value={editFormData.identificacao}
                onChange={(e) => setEditFormData({ ...editFormData, identificacao: e.target.value })}
                placeholder="Número do brinco"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_nome">Nome</Label>
              <Input
                id="edit_nome"
                value={editFormData.nome}
                onChange={(e) => setEditFormData({ ...editFormData, nome: e.target.value })}
                placeholder="Nome da receptora (opcional)"
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

      {/* Historico Sheet */}
      <ReceptoraHistorico
        receptoraId={selectedReceptoraId}
        open={showHistorico}
        onClose={() => setShowHistorico(false)}
      />
    </div>
  );
}