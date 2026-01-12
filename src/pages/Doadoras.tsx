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
import GenealogiaTree, { type GenealogiaData } from '@/components/shared/GenealogiaTree';

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
    racaCustom: '', // Para quando selecionar "Outra"
    genealogia_texto: '',
    foto_url: '',
  });

  const [genealogia, setGenealogia] = useState<GenealogiaData>({
    pai: { nome: '', registro: '' },
    mae: { nome: '', registro: '' },
    pai_pai: { nome: '', registro: '' },
    pai_mae: { nome: '', registro: '' },
    mae_pai: { nome: '', registro: '' },
    mae_mae: { nome: '', registro: '' },
  });

  // Preparação para campos específicos por raça (será implementado depois)
  const racasPredefinidas = ['Holandesa', 'Jersey', 'Gir', 'Girolando'];
  const [racaSelecionada, setRacaSelecionada] = useState<string>('');

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
      racaCustom: '',
      genealogia_texto: '',
      foto_url: '',
    });
    setGenealogia({
      pai: { nome: '', registro: '' },
      mae: { nome: '', registro: '' },
      pai_pai: { nome: '', registro: '' },
      pai_mae: { nome: '', registro: '' },
      mae_pai: { nome: '', registro: '' },
      mae_mae: { nome: '', registro: '' },
    });
    setRacaSelecionada('');
    setEditingId(null);
  };

  const handleEdit = (doadora: Doadora) => {
    const raca = doadora.raca || '';
    const isRacaPredefinida = racasPredefinidas.includes(raca);
    
    setRacaSelecionada(isRacaPredefinida ? raca : 'Outra');
    
    // Extrair genealogia do campo genealogia_texto (pode estar em JSON)
    let genealogiaExtraida: GenealogiaData = {
      pai: { nome: doadora.pai_nome || '', registro: doadora.pai_registro || '' },
      mae: { nome: doadora.mae_nome || '', registro: doadora.mae_registro || '' },
      pai_pai: { nome: '', registro: '' },
      pai_mae: { nome: '', registro: '' },
      mae_pai: { nome: '', registro: '' },
      mae_mae: { nome: '', registro: '' },
    };
    
    let genealogiaTexto = doadora.genealogia_texto || '';
    
    // Tentar extrair JSON da genealogia se existir
    if (genealogiaTexto.includes('[GENEALOGIA_JSON]')) {
      try {
        const match = genealogiaTexto.match(/\[GENEALOGIA_JSON\](.*?)\[\/GENEALOGIA_JSON\]/s);
        if (match) {
          const genealogiaJSON = JSON.parse(match[1]);
          genealogiaExtraida = {
            pai: genealogiaJSON.pai || genealogiaExtraida.pai,
            mae: genealogiaJSON.mae || genealogiaExtraida.mae,
            pai_pai: genealogiaJSON.pai_pai || genealogiaExtraida.pai_pai,
            pai_mae: genealogiaJSON.pai_mae || genealogiaExtraida.pai_mae,
            mae_pai: genealogiaJSON.mae_pai || genealogiaExtraida.mae_pai,
            mae_mae: genealogiaJSON.mae_mae || genealogiaExtraida.mae_mae,
          };
          // Remover JSON do texto de observações
          genealogiaTexto = genealogiaTexto.replace(/\[GENEALOGIA_JSON\].*?\[\/GENEALOGIA_JSON\]/s, '').trim();
        }
      } catch (e) {
        console.warn('Erro ao parsear genealogia JSON:', e);
      }
    }
    
    setFormData({
      registro: doadora.registro || '',
      nome: doadora.nome || '',
      raca: isRacaPredefinida ? raca : '',
      racaCustom: isRacaPredefinida ? '' : raca,
      genealogia_texto: genealogiaTexto,
      foto_url: doadora.foto_url || '',
    });
    
    setGenealogia(genealogiaExtraida);
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

    // Validar raça: deve ter selecionado uma raça pré-definida ou digitado uma raça customizada
    const racaFinal = racaSelecionada === 'Outra' ? formData.racaCustom.trim() : formData.raca.trim();
    if (!racaFinal) {
      toast({
        title: 'Erro de validação',
        description: 'Raça é obrigatória',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      // Determinar raça final (pré-definida ou customizada)
      const racaFinal = racaSelecionada === 'Outra' ? formData.racaCustom.trim() : formData.raca.trim();
      
      // Converter genealogia para formato do banco (mantendo compatibilidade com campos antigos)
      const doadoraData: Record<string, string | number | null> = {
        fazenda_id: selectedFazendaId,
        registro: formData.registro.trim(),
        nome: formData.nome.trim() || null,
        raca: racaFinal, // Obrigatório
        // Manter campos antigos para compatibilidade
        pai_registro: genealogia.pai.registro.trim() || null,
        pai_nome: genealogia.pai.nome.trim() || null,
        mae_registro: genealogia.mae.registro.trim() || null,
        mae_nome: genealogia.mae.nome.trim() || null,
        foto_url: formData.foto_url.trim() || null,
      };

      // Adicionar genealogia completa como JSON no campo genealogia_texto
      const genealogiaCompleta = {
        pai: genealogia.pai,
        mae: genealogia.mae,
        pai_pai: genealogia.pai_pai,
        pai_mae: genealogia.pai_mae,
        mae_pai: genealogia.mae_pai,
        mae_mae: genealogia.mae_mae,
      };
      
      // Verificar se há pelo menos um campo preenchido na genealogia
      const temGenealogia = Object.values(genealogiaCompleta).some(
        (pessoa) => pessoa.nome.trim() || pessoa.registro.trim()
      );
      
      if (temGenealogia) {
        // Armazenar JSON da genealogia completa junto com o texto de observações
        const genealogiaJSON = JSON.stringify(genealogiaCompleta);
        doadoraData.genealogia_texto = formData.genealogia_texto.trim()
          ? `${formData.genealogia_texto}\n\n[GENEALOGIA_JSON]${genealogiaJSON}[/GENEALOGIA_JSON]`
          : `[GENEALOGIA_JSON]${genealogiaJSON}[/GENEALOGIA_JSON]`;
      } else {
        doadoraData.genealogia_texto = formData.genealogia_texto.trim() || null;
      }

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
                      <Label htmlFor="raca">Raça *</Label>
                      <Select
                        value={racaSelecionada}
                        onValueChange={(value) => {
                          setRacaSelecionada(value);
                          if (value === 'Outra') {
                            setFormData({ ...formData, raca: '', racaCustom: '' });
                          } else {
                            setFormData({ ...formData, raca: value, racaCustom: '' });
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a raça" />
                        </SelectTrigger>
                        <SelectContent>
                          {racasPredefinidas.map((raca) => (
                            <SelectItem key={raca} value={raca}>
                              {raca}
                            </SelectItem>
                          ))}
                          <SelectItem value="Outra">Outra</SelectItem>
                        </SelectContent>
                      </Select>
                      {racaSelecionada === 'Outra' && (
                        <Input
                          id="raca_custom"
                          value={formData.racaCustom}
                          onChange={(e) => setFormData({ ...formData, racaCustom: e.target.value, raca: e.target.value })}
                          placeholder="Digite a raça"
                          className="mt-2"
                          required
                        />
                      )}
                      {/* Preparação para campos específicos por raça */}
                      {racaSelecionada && racaSelecionada !== 'Outra' && (
                        <div className="mt-2 text-xs text-slate-500">
                          {/* Aqui serão adicionados campos específicos por raça no futuro */}
                        </div>
                      )}
                    </div>

                  </div>

                  <div className="border-t pt-4">
                    <GenealogiaTree
                      value={genealogia}
                      onChange={setGenealogia}
                      doadoraNome={formData.nome || formData.registro}
                      doadoraRegistro={formData.registro}
                    />
                    
                    <div className="mt-4 space-y-2">
                      <Label htmlFor="genealogia_texto">Observações sobre Genealogia</Label>
                      <Textarea
                        id="genealogia_texto"
                        value={formData.genealogia_texto}
                        onChange={(e) =>
                          setFormData({ ...formData, genealogia_texto: e.target.value })
                        }
                        placeholder="Informações adicionais sobre genealogia (opcional)"
                        rows={3}
                      />
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="text-sm font-semibold mb-3">Foto</h3>
                    <div className="space-y-2">
                      <Label htmlFor="foto_url">Foto</Label>
                      <Input
                        id="foto_url"
                        type="url"
                        value={formData.foto_url}
                        onChange={(e) => setFormData({ ...formData, foto_url: e.target.value })}
                        placeholder="URL da foto (opcional)"
                      />
                      <p className="text-xs text-slate-500">
                        Cole a URL da foto da doadora
                      </p>
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
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDoadoras.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-slate-500">
                          {searchTerm ? 'Nenhuma doadora encontrada' : 'Nenhuma doadora cadastrada nesta fazenda'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredDoadoras.map((doadora) => (
                        <TableRow key={doadora.id}>
                          <TableCell className="font-medium">{doadora.registro}</TableCell>
                          <TableCell>{doadora.nome || '-'}</TableCell>
                          <TableCell>{doadora.raca || '-'}</TableCell>
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