import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { Touro, TouroInsert } from '@/lib/types';

// Tipo para valores de campos dinâmicos
type ValorDinamico = string | number | boolean | null | undefined;
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
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Eye } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import CamposDinamicosPorRaca from '@/components/touros/CamposDinamicosPorRaca';

const racasBovinas = ['Holandesa', 'Jersey', 'Gir', 'Girolando', 'Nelore', 'Angus', 'Brahman', 'Hereford', 'Simmental', 'Tabapuã', 'Sindi', 'Caracu', 'Canchim', 'Senepol', 'Brangus', 'Gir Leiteiro', 'Guzerá'];

export default function Touros() {
  const navigate = useNavigate();
  const [touros, setTouros] = useState<Touro[]>([]);
  const [filteredTouros, setFilteredTouros] = useState<Touro[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroRaca, setFiltroRaca] = useState('');
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    registro: '',
    nome: '',
    raca: '',
    data_nascimento: '',
    proprietario: '',
    fazenda_nome: '',
    pai_registro: '',
    pai_nome: '',
    mae_registro: '',
    mae_nome: '',
    genealogia_texto: '',
    link_catalogo: '',
    foto_url: '',
    link_video: '',
    observacoes: '',
  });

  // Campos dinâmicos em JSONB
  const [dadosDinamicos, setDadosDinamicos] = useState({
    dados_geneticos: {} as Record<string, ValorDinamico>,
    dados_producao: {} as Record<string, ValorDinamico>,
    dados_conformacao: {} as Record<string, ValorDinamico>,
    medidas_fisicas: {} as Record<string, ValorDinamico>,
    dados_saude_reproducao: {} as Record<string, ValorDinamico>,
    caseinas: {} as Record<string, ValorDinamico>,
    outros_dados: {} as Record<string, ValorDinamico>,
  });

  useEffect(() => {
    loadTouros();
  }, []);

  useEffect(() => {
    filterTouros();
  }, [searchTerm, filtroRaca, touros]);

  const filterTouros = () => {
    let filtered = [...touros];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.nome?.toLowerCase().includes(term) ||
          t.registro?.toLowerCase().includes(term) ||
          t.raca?.toLowerCase().includes(term)
      );
    }

    if (filtroRaca) {
      filtered = filtered.filter((t) => t.raca === filtroRaca);
    }

    setFilteredTouros(filtered);
  };

  const loadTouros = async () => {
    try {
      setLoading(true);
      const { data: tourosData, error: tourosError } = await supabase
        .from('touros')
        .select('*')
        .order('nome', { ascending: true });

      if (tourosError) throw tourosError;
      setTouros(tourosData || []);
      setFilteredTouros(tourosData || []);
    } catch (error) {
      toast({
        title: 'Erro ao carregar touros',
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
      data_nascimento: '',
      proprietario: '',
      fazenda_nome: '',
      pai_registro: '',
      pai_nome: '',
      mae_registro: '',
      mae_nome: '',
      genealogia_texto: '',
      link_catalogo: '',
      foto_url: '',
      link_video: '',
      observacoes: '',
    });
    setDadosDinamicos({
      dados_geneticos: {},
      dados_producao: {},
      dados_conformacao: {},
      medidas_fisicas: {},
      dados_saude_reproducao: {},
      caseinas: {},
      outros_dados: {},
    });
  };

  const handleCampoDinamicoChange = (campo: string, valor: ValorDinamico, categoria: string) => {
    setDadosDinamicos((prev) => ({
      ...prev,
      [categoria]: {
        ...prev[categoria as keyof typeof prev],
        [campo]: valor === '' ? undefined : valor, // Remove campos vazios
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.registro.trim()) {
      toast({
        title: 'Erro de validação',
        description: 'Registro é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.nome.trim()) {
      toast({
        title: 'Erro de validação',
        description: 'Nome é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.raca) {
      toast({
        title: 'Erro de validação',
        description: 'Raça é obrigatória',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      // Limpar campos vazios dos dados dinâmicos antes de salvar
      // Retorna {} (objeto vazio) em vez de null para campos JSONB
      const limparCamposVazios = (obj: Record<string, ValorDinamico>): Record<string, ValorDinamico> | null => {
        const limpo: Record<string, ValorDinamico> = {};
        Object.entries(obj).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            limpo[key] = value;
          }
        });
        return Object.keys(limpo).length > 0 ? limpo : {};
      };

      const insertData: TouroInsert = {
        registro: formData.registro.trim(),
        nome: formData.nome.trim(),
        raca: formData.raca, // Já validado acima - não pode ser vazio
        data_nascimento: formData.data_nascimento || null,
        proprietario: formData.proprietario.trim() || null,
        fazenda_nome: formData.fazenda_nome.trim() || null,
        pai_registro: formData.pai_registro.trim() || null,
        pai_nome: formData.pai_nome.trim() || null,
        mae_registro: formData.mae_registro.trim() || null,
        mae_nome: formData.mae_nome.trim() || null,
        genealogia_texto: formData.genealogia_texto.trim() || null,
        link_catalogo: formData.link_catalogo.trim() || null,
        foto_url: formData.foto_url.trim() || null,
        link_video: formData.link_video.trim() || null,
        observacoes: formData.observacoes.trim() || null,
        disponivel: true,
        // Campos dinâmicos em JSONB
        dados_geneticos: limparCamposVazios(dadosDinamicos.dados_geneticos),
        dados_producao: limparCamposVazios(dadosDinamicos.dados_producao),
        dados_conformacao: limparCamposVazios(dadosDinamicos.dados_conformacao),
        medidas_fisicas: limparCamposVazios(dadosDinamicos.medidas_fisicas),
        dados_saude_reproducao: limparCamposVazios(dadosDinamicos.dados_saude_reproducao),
        caseinas: limparCamposVazios(dadosDinamicos.caseinas),
        outros_dados: limparCamposVazios(dadosDinamicos.outros_dados),
      };

      const { error } = await supabase.from('touros').insert([insertData]);

      if (error) throw error;

      toast({
        title: 'Touro cadastrado',
        description: 'Touro cadastrado com sucesso no catálogo',
      });

      setShowDialog(false);
      resetForm();
      loadTouros();
    } catch (error: unknown) {
      let errorMessage = 'Erro desconhecido';
      if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      // Mensagens mais específicas para erros comuns
      if (errorMessage.includes('RLS') || errorMessage.includes('policy')) {
        errorMessage = 'RLS está bloqueando escrita. Configure políticas anon no Supabase.';
      } else if (errorMessage.includes('duplicate') || errorMessage.includes('unique')) {
        errorMessage = 'Já existe um touro com este registro no catálogo.';
      } else if (errorMessage.includes('null value') || errorMessage.includes('NOT NULL')) {
        errorMessage = 'Um ou mais campos obrigatórios não foram preenchidos. Verifique o formulário.';
      }
      
      toast({
        title: 'Erro ao cadastrar touro',
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
      <PageHeader
        title="Catálogo de Touros"
        description="Gerenciar catálogo de touros para FIV"
        actions={
          <Dialog open={showDialog} onOpenChange={(open) => {
            setShowDialog(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="bg-green-600 hover:bg-green-700">
                <Plus className="w-4 h-4 mr-2" />
                Novo Touro
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Cadastrar Novo Touro</DialogTitle>
                <DialogDescription>
                  Adicione um touro ao catálogo. Os clientes poderão ter doses deste touro.
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
                    placeholder="Ex: 250HO14579"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: HANCOCK"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                  <Label htmlFor="data_nascimento">Data de Nascimento</Label>
                  <Input
                    id="data_nascimento"
                    type="date"
                    value={formData.data_nascimento}
                    onChange={(e) => setFormData({ ...formData, data_nascimento: e.target.value })}
                  />
                </div>
              </div>

              {/* Proprietário e Fazenda */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="proprietario">Proprietário</Label>
                  <Input
                    id="proprietario"
                    value={formData.proprietario}
                    onChange={(e) => setFormData({ ...formData, proprietario: e.target.value })}
                    placeholder="Nome do proprietário"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fazenda_nome">Fazenda</Label>
                  <Input
                    id="fazenda_nome"
                    value={formData.fazenda_nome}
                    onChange={(e) => setFormData({ ...formData, fazenda_nome: e.target.value })}
                    placeholder="Nome da fazenda"
                  />
                </div>
              </div>

              {/* Campos Dinâmicos por Raça */}
              {formData.raca && (
                <div className="border-t pt-4">
                  <CamposDinamicosPorRaca
                    raca={formData.raca}
                    valores={{
                      ...dadosDinamicos.dados_geneticos,
                      ...dadosDinamicos.dados_producao,
                      ...dadosDinamicos.dados_conformacao,
                      ...dadosDinamicos.medidas_fisicas,
                      ...dadosDinamicos.dados_saude_reproducao,
                      ...dadosDinamicos.caseinas,
                      ...dadosDinamicos.outros_dados,
                    }}
                    onChange={handleCampoDinamicoChange}
                  />
                </div>
              )}

              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold mb-3">Pedigree</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pai_registro">Registro do Pai</Label>
                    <Input
                      id="pai_registro"
                      value={formData.pai_registro}
                      onChange={(e) => setFormData({ ...formData, pai_registro: e.target.value })}
                      placeholder="Registro do pai"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pai_nome">Nome do Pai</Label>
                    <Input
                      id="pai_nome"
                      value={formData.pai_nome}
                      onChange={(e) => setFormData({ ...formData, pai_nome: e.target.value })}
                      placeholder="Nome do pai"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mae_registro">Registro da Mãe</Label>
                    <Input
                      id="mae_registro"
                      value={formData.mae_registro}
                      onChange={(e) => setFormData({ ...formData, mae_registro: e.target.value })}
                      placeholder="Registro da mãe"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mae_nome">Nome da Mãe</Label>
                    <Input
                      id="mae_nome"
                      value={formData.mae_nome}
                      onChange={(e) => setFormData({ ...formData, mae_nome: e.target.value })}
                      placeholder="Nome da mãe"
                    />
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <Label htmlFor="genealogia_texto">Genealogia Completa (Texto)</Label>
                  <Textarea
                    id="genealogia_texto"
                    value={formData.genealogia_texto}
                    onChange={(e) => setFormData({ ...formData, genealogia_texto: e.target.value })}
                    placeholder="Genealogia completa em formato texto"
                    rows={3}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="link_catalogo">Link do Catálogo</Label>
                  <Input
                    id="link_catalogo"
                    type="url"
                    value={formData.link_catalogo}
                    onChange={(e) => setFormData({ ...formData, link_catalogo: e.target.value })}
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
                <div className="space-y-2">
                  <Label htmlFor="link_video">Link do Vídeo (YouTube, etc.)</Label>
                  <Input
                    id="link_video"
                    type="url"
                    value={formData.link_video}
                    onChange={(e) => setFormData({ ...formData, link_video: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Observações adicionais sobre o touro"
                  rows={3}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="submit"
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={submitting}
                >
                  {submitting ? 'Salvando...' : 'Cadastrar Touro'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowDialog(false);
                    resetForm();
                  }}
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

      <Card>
        <CardHeader>
          <CardTitle>Lista de Touros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Buscar Touro</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder="Buscar por nome, registro ou raça..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
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
                <TableHead>Registro</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Raça</TableHead>
                <TableHead>NM$</TableHead>
                <TableHead>TPI</TableHead>
                <TableHead>PTAT</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTouros.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-500">
                    <EmptyState
                      title="Nenhum touro cadastrado"
                      description="Cadastre o primeiro touro para começar."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filteredTouros.map((touro) => (
                  <TableRow key={touro.id}>
                    <TableCell className="font-medium">{touro.registro}</TableCell>
                    <TableCell>{touro.nome}</TableCell>
                    <TableCell>
                      {touro.raca ? <Badge variant="outline">{touro.raca}</Badge> : '-'}
                    </TableCell>
                    <TableCell>{touro.nm_dolares !== null && touro.nm_dolares !== undefined ? `+${touro.nm_dolares}` : '-'}</TableCell>
                    <TableCell>{touro.tpi !== null && touro.tpi !== undefined ? `+${touro.tpi}` : '-'}</TableCell>
                    <TableCell>{touro.ptat !== null && touro.ptat !== undefined ? `+${touro.ptat}` : '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/touros/${touro.id}`)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
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
