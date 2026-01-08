import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Doadora } from '@/lib/types';
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
import { Plus, Pencil, Dna, Search } from 'lucide-react';

interface Fazenda {
  id: string;
  nome: string;
}

export default function Doadoras() {
  const [doadoras, setDoadoras] = useState<Doadora[]>([]);
  const [filteredDoadoras, setFilteredDoadoras] = useState<Doadora[]>([]);
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [selectedFazendaId, setSelectedFazendaId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    registro: '',
    nome: '',
    raca: '',
    gpta: '',
    controle_leiteiro: '',
    beta_caseina: '',
    pai_registro: '',
    pai_nome: '',
    mae_registro: '',
    mae_nome: '',
    genealogia_texto: '',
    link_abcz: '',
    foto_url: '',
  });

  useEffect(() => {
    loadFazendas();
  }, []);

  useEffect(() => {
    if (selectedFazendaId) {
      loadDoadoras();
    } else {
      setDoadoras([]);
      setFilteredDoadoras([]);
    }
  }, [selectedFazendaId]);

  useEffect(() => {
    filterDoadoras();
  }, [searchTerm, doadoras]);

  const filterDoadoras = () => {
    if (!searchTerm.trim()) {
      setFilteredDoadoras(doadoras);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = doadoras.filter(
      (d) =>
        d.nome?.toLowerCase().includes(term) ||
        d.registro?.toLowerCase().includes(term) ||
        d.raca?.toLowerCase().includes(term)
    );
    setFilteredDoadoras(filtered);
  };

  const loadFazendas = async () => {
    try {
      setLoading(true);
      const { data: fazendasData, error: fazendasError } = await supabase
        .from('fazendas')
        .select('id, nome')
        .order('nome', { ascending: true });

      if (fazendasError) throw fazendasError;
      setFazendas(fazendasData || []);
    } catch (error) {
      toast({
        title: 'Erro ao carregar fazendas',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadDoadoras = async () => {
    try {
      setLoading(true);
      const { data: doadorasData, error: doadorasError } = await supabase
        .from('doadoras')
        .select('*')
        .eq('fazenda_id', selectedFazendaId)
        .order('created_at', { ascending: false });

      if (doadorasError) throw doadorasError;
      setDoadoras(doadorasData || []);
      setFilteredDoadoras(doadorasData || []);
    } catch (error) {
      toast({
        title: 'Erro ao carregar doadoras',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      registro: '',
      nome: '',
      raca: '',
      gpta: '',
      controle_leiteiro: '',
      beta_caseina: '',
      pai_registro: '',
      pai_nome: '',
      mae_registro: '',
      mae_nome: '',
      genealogia_texto: '',
      link_abcz: '',
      foto_url: '',
    });
    setEditingId(null);
  };

  const handleEdit = (doadora: Doadora) => {
    setFormData({
      registro: doadora.registro || '',
      nome: doadora.nome || '',
      raca: doadora.raca || '',
      gpta: doadora.gpta?.toString() || '',
      controle_leiteiro: doadora.controle_leiteiro?.toString() || '',
      beta_caseina: doadora.beta_caseina || '',
      pai_registro: doadora.pai_registro || '',
      pai_nome: doadora.pai_nome || '',
      mae_registro: doadora.mae_registro || '',
      mae_nome: doadora.mae_nome || '',
      genealogia_texto: doadora.genealogia_texto || '',
      link_abcz: doadora.link_abcz || '',
      foto_url: doadora.foto_url || '',
    });
    setEditingId(doadora.id);
    setShowDialog(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFazendaId) {
      toast({
        title: 'Erro de validação',
        description: 'Selecione a fazenda primeiro',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.registro.trim()) {
      toast({
        title: 'Erro de validação',
        description: 'Registro é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const doadoraData: Record<string, string | number | null> = {
        fazenda_id: selectedFazendaId,
        registro: formData.registro,
        nome: formData.nome.trim() || null,
        raca: formData.raca.trim() || null,
        gpta: formData.gpta ? parseFloat(formData.gpta) : null,
        controle_leiteiro: formData.controle_leiteiro ? parseFloat(formData.controle_leiteiro) : null,
        beta_caseina: formData.beta_caseina.trim() || null,
        pai_registro: formData.pai_registro.trim() || null,
        pai_nome: formData.pai_nome.trim() || null,
        mae_registro: formData.mae_registro.trim() || null,
        mae_nome: formData.mae_nome.trim() || null,
        genealogia_texto: formData.genealogia_texto.trim() || null,
        link_abcz: formData.link_abcz.trim() || null,
        foto_url: formData.foto_url.trim() || null,
      };

      if (editingId) {
        const { error } = await supabase
          .from('doadoras')
          .update(doadoraData)
          .eq('id', editingId);

        if (error) throw error;

        toast({
          title: 'Doadora atualizada',
          description: 'Doadora atualizada com sucesso',
        });
      } else {
        const { error } = await supabase.from('doadoras').insert([doadoraData]);

        if (error) throw error;

        toast({
          title: 'Doadora criada',
          description: 'Doadora criada com sucesso',
        });
      }

      setShowDialog(false);
      resetForm();
      loadDoadoras();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: editingId ? 'Erro ao atualizar doadora' : 'Erro ao criar doadora',
        description: errorMessage.includes('RLS') || errorMessage.includes('policy')
          ? 'RLS está bloqueando escrita. Configure políticas anon no Supabase.'
          : errorMessage,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDialogClose = (open: boolean) => {
    setShowDialog(open);
    if (!open) {
      resetForm();
    }
  };

  if (loading && fazendas.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Doadoras</h1>
        <p className="text-slate-600 mt-1">Gerenciar doadoras do sistema</p>
      </div>

      {/* Fazenda Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Selecione a Fazenda</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedFazendaId} onValueChange={setSelectedFazendaId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione uma fazenda para visualizar doadoras" />
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
            <p className="text-slate-500">Selecione uma fazenda para visualizar e gerenciar doadoras</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Buscar por nome ou registro..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Dialog open={showDialog} onOpenChange={handleDialogClose}>
              <DialogTrigger asChild>
                <Button className="bg-green-600 hover:bg-green-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Doadora
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Dna className="w-5 h-5" />
                    {editingId ? 'Editar Doadora' : 'Criar Nova Doadora'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingId ? 'Atualize os dados da doadora' : 'Criar doadora na fazenda selecionada'}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="registro">Registro *</Label>
                      <Input
                        id="registro"
                        value={formData.registro}
                        onChange={(e) => setFormData({ ...formData, registro: e.target.value })}
                        placeholder="Registro da doadora"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="nome">Nome</Label>
                      <Input
                        id="nome"
                        value={formData.nome}
                        onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                        placeholder="Nome da doadora"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="raca">Raça</Label>
                      <Input
                        id="raca"
                        value={formData.raca}
                        onChange={(e) => setFormData({ ...formData, raca: e.target.value })}
                        placeholder="Raça"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="beta_caseina">Beta Caseína</Label>
                      <Input
                        id="beta_caseina"
                        value={formData.beta_caseina}
                        onChange={(e) => setFormData({ ...formData, beta_caseina: e.target.value })}
                        placeholder="A2A2, A1A2, etc."
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="gpta">GPTA</Label>
                      <Input
                        id="gpta"
                        type="number"
                        step="0.01"
                        value={formData.gpta}
                        onChange={(e) => setFormData({ ...formData, gpta: e.target.value })}
                        placeholder="Valor numérico"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="controle_leiteiro">Controle Leiteiro</Label>
                      <Input
                        id="controle_leiteiro"
                        type="number"
                        step="0.01"
                        value={formData.controle_leiteiro}
                        onChange={(e) =>
                          setFormData({ ...formData, controle_leiteiro: e.target.value })
                        }
                        placeholder="Valor numérico"
                      />
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="text-sm font-semibold mb-3">Genealogia</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="pai_registro">Registro do Pai</Label>
                        <Input
                          id="pai_registro"
                          value={formData.pai_registro}
                          onChange={(e) => setFormData({ ...formData, pai_registro: e.target.value })}
                          placeholder="Registro"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="pai_nome">Nome do Pai</Label>
                        <Input
                          id="pai_nome"
                          value={formData.pai_nome}
                          onChange={(e) => setFormData({ ...formData, pai_nome: e.target.value })}
                          placeholder="Nome"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="mae_registro">Registro da Mãe</Label>
                        <Input
                          id="mae_registro"
                          value={formData.mae_registro}
                          onChange={(e) => setFormData({ ...formData, mae_registro: e.target.value })}
                          placeholder="Registro"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="mae_nome">Nome da Mãe</Label>
                        <Input
                          id="mae_nome"
                          value={formData.mae_nome}
                          onChange={(e) => setFormData({ ...formData, mae_nome: e.target.value })}
                          placeholder="Nome"
                        />
                      </div>

                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="genealogia_texto">Genealogia (Texto)</Label>
                        <Textarea
                          id="genealogia_texto"
                          value={formData.genealogia_texto}
                          onChange={(e) =>
                            setFormData({ ...formData, genealogia_texto: e.target.value })
                          }
                          placeholder="Informações adicionais sobre genealogia"
                          rows={3}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="text-sm font-semibold mb-3">Links e Mídia</h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="link_abcz">Link ABCZ</Label>
                        <Input
                          id="link_abcz"
                          type="url"
                          value={formData.link_abcz}
                          onChange={(e) => setFormData({ ...formData, link_abcz: e.target.value })}
                          placeholder="https://..."
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="foto_url">URL da Foto</Label>
                        <Input
                          id="foto_url"
                          type="url"
                          value={formData.foto_url}
                          onChange={(e) => setFormData({ ...formData, foto_url: e.target.value })}
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      type="submit"
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      disabled={submitting}
                    >
                      {submitting ? 'Salvando...' : editingId ? 'Atualizar' : 'Criar Doadora'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleDialogClose(false)}
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
              <CardTitle>Lista de Doadoras</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-8">
                  <LoadingSpinner />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Registro</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Raça</TableHead>
                      <TableHead>GPTA</TableHead>
                      <TableHead>Beta Caseína</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDoadoras.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-slate-500">
                          {searchTerm ? 'Nenhuma doadora encontrada' : 'Nenhuma doadora cadastrada nesta fazenda'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredDoadoras.map((doadora) => (
                        <TableRow key={doadora.id}>
                          <TableCell className="font-medium">{doadora.registro}</TableCell>
                          <TableCell>{doadora.nome || '-'}</TableCell>
                          <TableCell>{doadora.raca || '-'}</TableCell>
                          <TableCell>{doadora.gpta || '-'}</TableCell>
                          <TableCell>{doadora.beta_caseina || '-'}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(doadora)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
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
    </div>
  );
}