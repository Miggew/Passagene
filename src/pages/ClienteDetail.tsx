import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { Cliente, Fazenda, EmbriaoComRelacionamentos, DoseSemenComTouro } from '@/lib/types';
import { getGoogleMapsUrl, getGoogleMapsSearchUrl, extractCoordsFromMapsUrl, isShortMapsUrl, isValidCoordinates } from '@/lib/coordinates';
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
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Edit, Home, Dna, Plus, Navigation, Snowflake } from 'lucide-react';
import { ClienteDosesTab } from '@/components/cliente/ClienteDosesTab';
import { ClienteEmbrioesTab } from '@/components/cliente/ClienteEmbrioesTab';

export default function ClienteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [doses, setDoses] = useState<DoseSemenComTouro[]>([]);
  const [embrioesCongelados, setEmbrioesCongelados] = useState<EmbriaoComRelacionamentos[]>([]);
  const [showFazendaDialog, setShowFazendaDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [fazendaForm, setFazendaForm] = useState({
    nome: '',
    sigla: '',
    localizacao: '',
    latitude: '',
    longitude: '',
    mapsLink: '',
    responsavel: '',
    contato_responsavel: '',
  });
  const [mapsLinkError, setMapsLinkError] = useState<string | null>(null);
  const [coordsValid, setCoordsValid] = useState<boolean | null>(null);

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
              data_aspiracao,
              horario_aspiracao,
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

  const handleNavigate = (fazenda: Fazenda) => {
    if (fazenda.latitude && fazenda.longitude) {
      // Abre Google Maps com as coordenadas (funciona em qualquer dispositivo)
      const mapsUrl = getGoogleMapsUrl(fazenda.latitude, fazenda.longitude);
      window.open(mapsUrl, '_blank');
    } else if (fazenda.localizacao) {
      // Fallback para busca por endereço
      const mapsUrl = getGoogleMapsSearchUrl(fazenda.localizacao);
      window.open(mapsUrl, '_blank');
    }
  };

  const hasLocation = (fazenda: Fazenda) => {
    return (fazenda.latitude && fazenda.longitude) || fazenda.localizacao;
  };

  const handleMapsLinkChange = (value: string) => {
    setFazendaForm({ ...fazendaForm, mapsLink: value });
    setMapsLinkError(null);

    if (!value.trim()) {
      return;
    }

    // Check for short URLs
    if (isShortMapsUrl(value)) {
      setMapsLinkError('Links curtos (goo.gl) nao sao suportados. Abra o link no navegador e copie a URL completa.');
      return;
    }

    // Try to extract coordinates
    const coords = extractCoordsFromMapsUrl(value);
    if (coords) {
      setFazendaForm(prev => ({
        ...prev,
        mapsLink: value,
        latitude: coords.lat,
        longitude: coords.lng,
      }));
    }
  };

  const handleCoordsChange = (field: 'latitude' | 'longitude', value: string) => {
    const newForm = { ...fazendaForm, [field]: value };
    setFazendaForm(newForm);

    // Validate coordinates when both are present
    if (newForm.latitude && newForm.longitude) {
      const lat = parseFloat(newForm.latitude);
      const lng = parseFloat(newForm.longitude);
      setCoordsValid(isValidCoordinates(lat, lng));
    } else {
      setCoordsValid(null);
    }
  };

  // Estado para edição de fazenda
  const [editingFazenda, setEditingFazenda] = useState<Fazenda | null>(null);

  const handleEditFazenda = (fazenda: Fazenda) => {
    setFazendaForm({
      nome: fazenda.nome || '',
      sigla: fazenda.sigla || '',
      localizacao: fazenda.localizacao || '',
      latitude: fazenda.latitude?.toString() || '',
      longitude: fazenda.longitude?.toString() || '',
      mapsLink: '',
      responsavel: fazenda.responsavel || '',
      contato_responsavel: fazenda.contato_responsavel || '',
    });
    setMapsLinkError(null);
    setCoordsValid(null);
    setEditingFazenda(fazenda);
    setShowFazendaDialog(true);
  };

  const handleSaveFazenda = async (e: React.FormEvent) => {
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
        nome: fazendaForm.nome,
        sigla: fazendaForm.sigla.trim().toUpperCase() || null,
        localizacao: fazendaForm.localizacao.trim() || null,
        latitude: fazendaForm.latitude ? parseFloat(fazendaForm.latitude) : null,
        longitude: fazendaForm.longitude ? parseFloat(fazendaForm.longitude) : null,
        responsavel: fazendaForm.responsavel.trim() || null,
        contato_responsavel: fazendaForm.contato_responsavel.trim() || null,
      };

      if (editingFazenda) {
        // Atualizar fazenda existente
        const { error } = await supabase
          .from('fazendas')
          .update(fazendaData)
          .eq('id', editingFazenda.id);

        if (error) throw error;

        toast({
          title: 'Fazenda atualizada',
          description: 'Fazenda atualizada com sucesso',
        });
      } else {
        // Criar nova fazenda
        const { error } = await supabase
          .from('fazendas')
          .insert([{ ...fazendaData, cliente_id: id! }]);

        if (error) throw error;

        toast({
          title: 'Fazenda criada',
          description: 'Fazenda criada com sucesso',
        });
      }

      setShowFazendaDialog(false);
      setEditingFazenda(null);
      setFazendaForm({
        nome: '',
        sigla: '',
        localizacao: '',
        latitude: '',
        longitude: '',
        mapsLink: '',
        responsavel: '',
        contato_responsavel: '',
      });
      setMapsLinkError(null);
      setCoordsValid(null);
      loadData();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: editingFazenda ? 'Erro ao atualizar fazenda' : 'Erro ao criar fazenda',
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
      <div className="space-y-6">
        <EmptyState
          title="Cliente não encontrado"
          description="Volte para a lista e selecione outro cliente."
          action={(
            <Button onClick={() => navigate('/clientes')} variant="outline">
              Voltar para Clientes
            </Button>
          )}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={cliente.nome}
        description="Detalhes do cliente"
        actions={(
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigate('/clientes')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <Link to={`/clientes/${id}/editar`}>
              <Button variant="outline">
                <Edit className="w-4 h-4 mr-2" />
                Editar
              </Button>
            </Link>
          </div>
        )}
      />

      <Card>
        <CardHeader>
          <CardTitle>Informações do Cliente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Nome</p>
            <p className="text-base text-foreground">{cliente.nome}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Telefone</p>
            <p className="text-base text-foreground">{cliente.telefone || '-'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Endereço</p>
            <p className="text-base text-foreground">{cliente.endereco || '-'}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Cadastrado em</p>
            <p className="text-base text-foreground">
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
                <Dialog open={showFazendaDialog} onOpenChange={(open) => {
                  setShowFazendaDialog(open);
                  if (!open) {
                    setEditingFazenda(null);
                    setFazendaForm({
                      nome: '',
                      sigla: '',
                      localizacao: '',
                      latitude: '',
                      longitude: '',
                      mapsLink: '',
                      responsavel: '',
                      contato_responsavel: '',
                    });
                    setMapsLinkError(null);
                    setCoordsValid(null);
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Nova Fazenda
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>{editingFazenda ? 'Editar Fazenda' : 'Criar Nova Fazenda'}</DialogTitle>
                      <DialogDescription>
                        {editingFazenda ? `Editando ${editingFazenda.nome}` : `Criar fazenda para ${cliente.nome}`}
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSaveFazenda} className="space-y-4">
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
                        <Label htmlFor="sigla">Sigla (2-3 caracteres)</Label>
                        <Input
                          id="sigla"
                          value={fazendaForm.sigla}
                          onChange={(e) => {
                            const valor = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
                            setFazendaForm({ ...fazendaForm, sigla: valor });
                          }}
                          placeholder="Ex: SC, BV"
                          maxLength={3}
                          className="w-24 uppercase"
                        />
                        <p className="text-xs text-muted-foreground">
                          Usada para identificar embriões (ex: SC-2401-001)
                        </p>
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

                      <div className="space-y-2">
                        <Label htmlFor="mapsLink">Link do Google Maps</Label>
                        <Input
                          id="mapsLink"
                          value={fazendaForm.mapsLink}
                          onChange={(e) => handleMapsLinkChange(e.target.value)}
                          placeholder="Cole aqui o link compartilhado do Maps"
                          className={mapsLinkError ? 'border-red-500' : ''}
                        />
                        {mapsLinkError && (
                          <p className="text-xs text-red-500">{mapsLinkError}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Cole um link do Google Maps para preencher as coordenadas automaticamente
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="latitude">Latitude</Label>
                          <Input
                            id="latitude"
                            type="number"
                            step="any"
                            value={fazendaForm.latitude}
                            onChange={(e) => handleCoordsChange('latitude', e.target.value)}
                            placeholder="-23.550520"
                            className={coordsValid === false ? 'border-red-500' : coordsValid === true ? 'border-green-500' : ''}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="longitude">Longitude</Label>
                          <Input
                            id="longitude"
                            type="number"
                            step="any"
                            value={fazendaForm.longitude}
                            onChange={(e) => handleCoordsChange('longitude', e.target.value)}
                            placeholder="-46.633308"
                            className={coordsValid === false ? 'border-red-500' : coordsValid === true ? 'border-green-500' : ''}
                          />
                        </div>
                      </div>
                      {coordsValid === false && (
                        <p className="text-xs text-red-500">Coordenadas fora do range valido (lat: -90 a 90, lng: -180 a 180)</p>
                      )}

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
                          className="flex-1"
                          disabled={submitting}
                        >
                          {submitting ? 'Salvando...' : (editingFazenda ? 'Salvar' : 'Criar Fazenda')}
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
                    <TableHead>Sigla</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fazendas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Nenhuma fazenda cadastrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    fazendas.map((fazenda) => (
                      <TableRow key={fazenda.id}>
                        <TableCell className="font-medium">
                          <Link
                            to={`/fazendas/${fazenda.id}`}
                            className="text-primary hover:text-primary/80 hover:underline"
                          >
                            {fazenda.nome}
                          </Link>
                        </TableCell>
                        <TableCell>{fazenda.sigla || '-'}</TableCell>
                        <TableCell>{fazenda.localizacao || '-'}</TableCell>
                        <TableCell>{fazenda.responsavel || '-'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditFazenda(fazenda)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            {hasLocation(fazenda) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleNavigate(fazenda)}
                              >
                                <Navigation className="w-4 h-4 mr-1" />
                                Navegar
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
          <ClienteDosesTab
            clienteId={id!}
            clienteNome={cliente.nome}
            doses={doses}
            onReload={loadData}
          />
        </TabsContent>

        <TabsContent value="embrioes">
          <ClienteEmbrioesTab
            clienteId={id!}
            clienteNome={cliente.nome}
            embrioes={embrioesCongelados}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}