import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { Cliente, Fazenda, DoseSemen, Embriao } from '@/lib/types';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Edit, Home, Dna, Plus, MapPin, Navigation, Snowflake } from 'lucide-react';

export default function ClienteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [doses, setDoses] = useState<DoseSemen[]>([]);
  const [embrioesCongelados, setEmbrioesCongelados] = useState<Embriao[]>([]);
  const [showFazendaDialog, setShowFazendaDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [fazendaForm, setFazendaForm] = useState({
    nome: '',
    localizacao: '',
    latitude: '',
    longitude: '',
    responsavel: '',
    contato_responsavel: '',
  });

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load cliente
      const { data: clienteData, error: clienteError } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', id)
        .single();

      if (clienteError) throw clienteError;
      setCliente(clienteData);

      // Load fazendas
      const { data: fazendasData, error: fazendasError } = await supabase
        .from('fazendas')
        .select('*')
        .eq('cliente_id', id)
        .order('nome', { ascending: true });

      if (fazendasError) throw fazendasError;
      setFazendas(fazendasData || []);

      // Load doses de sêmen (com informações do touro)
      const { data: dosesData, error: dosesError } = await supabase
        .from('doses_semen')
        .select(`
          *,
          touro:touros(id, nome, registro, raca)
        `)
        .eq('cliente_id', id)
        .order('created_at', { ascending: false });

      if (dosesError) throw dosesError;
      setDoses(dosesData || []);

      // Load embriões congelados do cliente
      const { data: embrioesData, error: embrioesError } = await supabase
        .from('embrioes')
        .select(`
          *,
          lote_fiv:lotes_fiv(id, data_abertura),
          acasalamento:lote_fiv_acasalamentos(
            id,
            dose_semen:doses_semen(
              id,
              touro:touros(id, nome, registro, raca)
            ),
            aspiracao:aspiracoes_doadoras(
              id,
              doadora:doadoras(id, registro, nome)
            )
          )
        `)
        .eq('cliente_id', id)
        .eq('status_atual', 'CONGELADO')
        .order('data_congelamento', { ascending: false });

      if (embrioesError) throw embrioesError;
      setEmbrioesCongelados(embrioesData || []);
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

  const getMapsLink = (fazenda: Fazenda) => {
    if (fazenda.latitude && fazenda.longitude) {
      return `https://www.google.com/maps?q=${fazenda.latitude},${fazenda.longitude}`;
    } else if (fazenda.localizacao) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fazenda.localizacao)}`;
    }
    return null;
  };

  const getWazeLink = (fazenda: Fazenda) => {
    if (fazenda.latitude && fazenda.longitude) {
      return `https://waze.com/ul?ll=${fazenda.latitude},${fazenda.longitude}&navigate=yes`;
    } else if (fazenda.localizacao) {
      // Fallback to Google Maps for Waze if no coordinates
      return getMapsLink(fazenda);
    }
    return null;
  };

  const handleCreateFazenda = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fazendaForm.nome.trim()) {
      toast({
        title: 'Erro de validação',
        description: 'Nome da fazenda é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const fazendaData: Record<string, string | number | null> = {
        cliente_id: id!,
        nome: fazendaForm.nome,
        localizacao: fazendaForm.localizacao.trim() || null,
        latitude: fazendaForm.latitude ? parseFloat(fazendaForm.latitude) : null,
        longitude: fazendaForm.longitude ? parseFloat(fazendaForm.longitude) : null,
        responsavel: fazendaForm.responsavel.trim() || null,
        contato_responsavel: fazendaForm.contato_responsavel.trim() || null,
      };

      const { error } = await supabase.from('fazendas').insert([fazendaData]);

      if (error) throw error;

      toast({
        title: 'Fazenda criada',
        description: 'Fazenda criada com sucesso',
      });

      setShowFazendaDialog(false);
      setFazendaForm({
        nome: '',
        localizacao: '',
        latitude: '',
        longitude: '',
        responsavel: '',
        contato_responsavel: '',
      });
      loadData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao criar fazenda',
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

  if (!cliente) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">Cliente não encontrado</p>
        <Button onClick={() => navigate('/clientes')} className="mt-4">
          Voltar para Clientes
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/clientes')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{cliente.nome}</h1>
            <p className="text-slate-600 mt-1">Detalhes do cliente</p>
          </div>
        </div>
        <Link to={`/clientes/${id}/editar`}>
          <Button variant="outline">
            <Edit className="w-4 h-4 mr-2" />
            Editar
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações do Cliente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-slate-500">Nome</p>
            <p className="text-base text-slate-900">{cliente.nome}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Telefone</p>
            <p className="text-base text-slate-900">{cliente.telefone || '-'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Endereço</p>
            <p className="text-base text-slate-900">{cliente.endereco || '-'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Cadastrado em</p>
            <p className="text-base text-slate-900">
              {cliente.created_at
                ? new Date(cliente.created_at).toLocaleDateString('pt-BR')
                : '-'}
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="fazendas" className="w-full">
        <TabsList>
          <TabsTrigger value="fazendas">
            <Home className="w-4 h-4 mr-2" />
            Fazendas ({fazendas.length})
          </TabsTrigger>
          <TabsTrigger value="doses">
            <Dna className="w-4 h-4 mr-2" />
            Doses de Sêmen ({doses.length})
          </TabsTrigger>
          <TabsTrigger value="embrioes">
            <Snowflake className="w-4 h-4 mr-2" />
            Embriões Congelados ({embrioesCongelados.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fazendas">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Fazendas do Cliente</CardTitle>
                <Dialog open={showFazendaDialog} onOpenChange={setShowFazendaDialog}>
                  <DialogTrigger asChild>
                    <Button className="bg-green-600 hover:bg-green-700">
                      <Plus className="w-4 h-4 mr-2" />
                      Nova Fazenda
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Criar Nova Fazenda</DialogTitle>
                      <DialogDescription>
                        Criar fazenda para {cliente.nome}
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateFazenda} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="nome">Nome da Fazenda *</Label>
                        <Input
                          id="nome"
                          value={fazendaForm.nome}
                          onChange={(e) => setFazendaForm({ ...fazendaForm, nome: e.target.value })}
                          placeholder="Nome da fazenda"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="localizacao">Localização</Label>
                        <Input
                          id="localizacao"
                          value={fazendaForm.localizacao}
                          onChange={(e) => setFazendaForm({ ...fazendaForm, localizacao: e.target.value })}
                          placeholder="Cidade, Estado"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="latitude">Latitude</Label>
                          <Input
                            id="latitude"
                            type="number"
                            step="any"
                            value={fazendaForm.latitude}
                            onChange={(e) => setFazendaForm({ ...fazendaForm, latitude: e.target.value })}
                            placeholder="-23.550520"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="longitude">Longitude</Label>
                          <Input
                            id="longitude"
                            type="number"
                            step="any"
                            value={fazendaForm.longitude}
                            onChange={(e) => setFazendaForm({ ...fazendaForm, longitude: e.target.value })}
                            placeholder="-46.633308"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="responsavel">Responsável</Label>
                        <Input
                          id="responsavel"
                          value={fazendaForm.responsavel}
                          onChange={(e) => setFazendaForm({ ...fazendaForm, responsavel: e.target.value })}
                          placeholder="Nome do responsável"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="contato_responsavel">Contato do Responsável</Label>
                        <Input
                          id="contato_responsavel"
                          value={fazendaForm.contato_responsavel}
                          onChange={(e) => setFazendaForm({ ...fazendaForm, contato_responsavel: e.target.value })}
                          placeholder="Telefone ou email"
                        />
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button
                          type="submit"
                          className="flex-1 bg-green-600 hover:bg-green-700"
                          disabled={submitting}
                        >
                          {submitting ? 'Salvando...' : 'Criar Fazenda'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowFazendaDialog(false)}
                          disabled={submitting}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fazendas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-slate-500">
                        Nenhuma fazenda cadastrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    fazendas.map((fazenda) => (
                      <TableRow key={fazenda.id}>
                        <TableCell className="font-medium">
                          <Link
                            to={`/fazendas/${fazenda.id}`}
                            className="text-green-600 hover:text-green-700 hover:underline"
                          >
                            {fazenda.nome}
                          </Link>
                        </TableCell>
                        <TableCell>{fazenda.localizacao || '-'}</TableCell>
                        <TableCell>{fazenda.responsavel || '-'}</TableCell>
                        <TableCell>{fazenda.contato_responsavel || '-'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            {getMapsLink(fazenda) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(getMapsLink(fazenda)!, '_blank')}
                              >
                                <MapPin className="w-4 h-4 mr-1" />
                                Maps
                              </Button>
                            )}
                            {getWazeLink(fazenda) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(getWazeLink(fazenda)!, '_blank')}
                              >
                                <Navigation className="w-4 h-4 mr-1" />
                                Waze
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="doses">
          <Card>
            <CardHeader>
              <CardTitle>Doses de Sêmen</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome (Touro)</TableHead>
                    <TableHead>Raça</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Quantidade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {doses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-slate-500">
                        Nenhuma dose de sêmen cadastrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    doses.map((dose) => {
                      const touro = (dose as any).touro;
                      return (
                        <TableRow key={dose.id}>
                          <TableCell className="font-medium">
                            {touro?.nome || 'Touro desconhecido'}
                            {touro?.registro && <span className="text-slate-500 ml-2">({touro.registro})</span>}
                          </TableCell>
                          <TableCell>{touro?.raca || dose.raca || '-'}</TableCell>
                          <TableCell>{dose.tipo_semen || '-'}</TableCell>
                          <TableCell>{dose.quantidade ?? '-'}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="embrioes">
          <Card>
            <CardHeader>
              <CardTitle>Embriões Congelados no Estoque</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Identificação</TableHead>
                    <TableHead>Classificação</TableHead>
                    <TableHead>Doadora</TableHead>
                    <TableHead>Touro</TableHead>
                    <TableHead>Data Congelamento</TableHead>
                    <TableHead>Localização</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {embrioesCongelados.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-slate-500">
                        Nenhum embrião congelado no estoque
                      </TableCell>
                    </TableRow>
                  ) : (
                    embrioesCongelados.map((embriao) => {
                      const acasalamento = (embriao as any).acasalamento;
                      const dose = acasalamento?.dose_semen;
                      const touro = dose?.touro;
                      const aspiracao = acasalamento?.aspiracao;
                      const doadora = aspiracao?.doadora;

                      return (
                        <TableRow key={embriao.id}>
                          <TableCell className="font-medium">
                            {embriao.identificacao || '-'}
                          </TableCell>
                          <TableCell>
                            {embriao.classificacao ? (
                              <span className="px-2 py-1 text-xs font-medium rounded bg-purple-100 text-purple-800">
                                {embriao.classificacao}
                              </span>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>{doadora?.registro || doadora?.nome || '-'}</TableCell>
                          <TableCell>
                            {touro?.nome || '-'}
                            {touro?.registro && (
                              <span className="text-slate-500 ml-2">({touro.registro})</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {embriao.data_congelamento
                              ? new Date(embriao.data_congelamento).toLocaleDateString('pt-BR')
                              : '-'}
                          </TableCell>
                          <TableCell>{embriao.localizacao_atual || '-'}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}