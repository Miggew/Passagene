import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { Fazenda, Cliente } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import { useToast } from '@/hooks/use-toast';
import { handleError } from '@/lib/error-handler';
import { Plus, Eye, Search, Filter, X, Users, Home, Navigation } from 'lucide-react';
import { getGoogleMapsUrl, getGoogleMapsSearchUrl, extractCoordsFromMapsUrl, isShortMapsUrl, isValidCoordinates } from '@/lib/coordinates';

interface FazendaWithCliente extends Fazenda {
  cliente_nome?: string;
}

const ITENS_POR_PAGINA = 15;

export default function AdminFazendasTab() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [fazendas, setFazendas] = useState<FazendaWithCliente[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroCliente, setFiltroCliente] = useState<string>('todos');

  // Dialog state
  const [showDialog, setShowDialog] = useState(false);
  const [editingFazenda, setEditingFazenda] = useState<Fazenda | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    nome: '',
    sigla: '',
    cliente_id: '',
    localizacao: '',
    latitude: '',
    longitude: '',
    mapsLink: '',
    responsavel: '',
    contato_responsavel: '',
  });
  const [mapsLinkError, setMapsLinkError] = useState<string | null>(null);
  const [coordsValid, setCoordsValid] = useState<boolean | null>(null);

  // Paginacao
  const [paginaAtual, setPaginaAtual] = useState(1);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load clientes
      const { data: clientesData, error: clientesError } = await supabase
        .from('clientes')
        .select('*')
        .order('nome');

      if (clientesError) throw clientesError;
      setClientes(clientesData || []);

      // Load fazendas
      const { data: fazendasData, error: fazendasError } = await supabase
        .from('fazendas')
        .select('*')
        .order('nome', { ascending: true });

      if (fazendasError) throw fazendasError;

      const clientesMap = new Map((clientesData || []).map((c) => [c.id, c.nome]));

      const fazendasWithCliente = fazendasData?.map((f) => ({
        ...f,
        cliente_nome: clientesMap.get(f.cliente_id),
      }));

      setFazendas(fazendasWithCliente || []);
    } catch (error) {
      handleError(error, 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  // Filtrar fazendas
  const filteredFazendas = useMemo(() => {
    return fazendas.filter(fazenda => {
      const matchesSearch = !searchTerm ||
        fazenda.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        fazenda.cliente_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        fazenda.responsavel?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        fazenda.localizacao?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCliente = filtroCliente === 'todos' || fazenda.cliente_id === filtroCliente;

      return matchesSearch && matchesCliente;
    });
  }, [fazendas, searchTerm, filtroCliente]);

  // Paginacao
  const totalPaginas = Math.ceil(filteredFazendas.length / ITENS_POR_PAGINA);
  const fazendasPaginadas = useMemo(() => {
    const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
    return filteredFazendas.slice(inicio, inicio + ITENS_POR_PAGINA);
  }, [filteredFazendas, paginaAtual]);

  // Reset pagina quando filtrar
  useEffect(() => {
    setPaginaAtual(1);
  }, [searchTerm, filtroCliente]);

  const handleMapsLinkChange = (value: string) => {
    setFormData(prev => ({ ...prev, mapsLink: value }));
    setMapsLinkError(null);

    if (!value.trim()) {
      return;
    }

    if (isShortMapsUrl(value)) {
      setMapsLinkError('Links curtos (goo.gl) nao sao suportados. Abra o link no navegador e copie a URL completa.');
      return;
    }

    const coords = extractCoordsFromMapsUrl(value);
    if (coords) {
      setFormData(prev => ({
        ...prev,
        mapsLink: value,
        latitude: coords.lat,
        longitude: coords.lng,
      }));
    }
  };

  const handleCoordsChange = (field: 'latitude' | 'longitude', value: string) => {
    const newForm = { ...formData, [field]: value };
    setFormData(newForm);

    if (newForm.latitude && newForm.longitude) {
      const lat = parseFloat(newForm.latitude);
      const lng = parseFloat(newForm.longitude);
      setCoordsValid(isValidCoordinates(lat, lng));
    } else {
      setCoordsValid(null);
    }
  };

  const handleOpenDialog = (fazenda?: Fazenda) => {
    if (fazenda) {
      setEditingFazenda(fazenda);
      setFormData({
        nome: fazenda.nome || '',
        sigla: fazenda.sigla || '',
        cliente_id: fazenda.cliente_id || '',
        localizacao: fazenda.localizacao || '',
        latitude: fazenda.latitude?.toString() || '',
        longitude: fazenda.longitude?.toString() || '',
        mapsLink: '',
        responsavel: fazenda.responsavel || '',
        contato_responsavel: fazenda.contato_responsavel || '',
      });
    } else {
      setEditingFazenda(null);
      setFormData({
        nome: '',
        sigla: '',
        cliente_id: '',
        localizacao: '',
        latitude: '',
        longitude: '',
        mapsLink: '',
        responsavel: '',
        contato_responsavel: '',
      });
    }
    setMapsLinkError(null);
    setCoordsValid(null);
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingFazenda(null);
    setFormData({
      nome: '',
      sigla: '',
      cliente_id: '',
      localizacao: '',
      latitude: '',
      longitude: '',
      mapsLink: '',
      responsavel: '',
      contato_responsavel: '',
    });
    setMapsLinkError(null);
    setCoordsValid(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nome.trim()) {
      toast({
        title: 'Erro de validacao',
        description: 'Nome da fazenda e obrigatorio',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.cliente_id) {
      toast({
        title: 'Erro de validacao',
        description: 'Selecione um cliente',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const fazendaData: Record<string, string | number | null> = {
        nome: formData.nome.trim(),
        sigla: formData.sigla.trim().toUpperCase() || null,
        cliente_id: formData.cliente_id,
        localizacao: formData.localizacao.trim() || null,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        responsavel: formData.responsavel.trim() || null,
        contato_responsavel: formData.contato_responsavel.trim() || null,
      };

      if (editingFazenda) {
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
        const { error } = await supabase
          .from('fazendas')
          .insert([fazendaData]);

        if (error) throw error;

        toast({
          title: 'Fazenda criada',
          description: 'Fazenda criada com sucesso',
        });
      }

      handleCloseDialog();
      loadData();
    } catch (error) {
      handleError(error, 'Erro ao salvar fazenda');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNavigate = (fazenda: Fazenda) => {
    if (fazenda.latitude && fazenda.longitude) {
      const mapsUrl = getGoogleMapsUrl(fazenda.latitude, fazenda.longitude);
      window.open(mapsUrl, '_blank');
    } else if (fazenda.localizacao) {
      const mapsUrl = getGoogleMapsSearchUrl(fazenda.localizacao);
      window.open(mapsUrl, '_blank');
    }
  };

  const hasLocation = (fazenda: Fazenda) => {
    return (fazenda.latitude && fazenda.longitude) || fazenda.localizacao;
  };

  const handleVerDetalhes = (fazenda: Fazenda) => {
    // Navega para FazendaDetail (tem tabs de receptoras/doadoras)
    navigate(`/fazendas/${fazenda.id}`);
  };

  const handleLimparFiltros = () => {
    setSearchTerm('');
    setFiltroCliente('todos');
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-4">
      {/* Barra de Filtros Premium */}
      <div className="rounded-xl border border-border bg-gradient-to-r from-card via-card to-muted/30 p-4">
        <div className="flex flex-wrap items-end gap-6">
          {/* Grupo: Busca */}
          <div className="flex items-end gap-3">
            <div className="w-1 h-6 rounded-full bg-primary/40 self-center" />
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground self-center">
              <Filter className="w-3.5 h-3.5" />
              <span>Busca</span>
            </div>
            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, cliente, responsavel..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>

          {/* Separador */}
          <div className="h-10 w-px bg-border hidden lg:block" />

          {/* Grupo: Cliente */}
          <div className="flex items-end gap-3">
            <div className="w-1 h-6 rounded-full bg-amber-500/40 self-center" />
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground self-center">
              <Users className="w-3.5 h-3.5" />
              <span>Cliente</span>
            </div>
            <div className="w-[200px]">
              <Select value={filtroCliente} onValueChange={setFiltroCliente}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os clientes</SelectItem>
                  {clientes.map((cliente) => (
                    <SelectItem key={cliente.id} value={cliente.id}>
                      {cliente.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Botao Limpar */}
          {(searchTerm || filtroCliente !== 'todos') && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleLimparFiltros}
              className="h-9"
            >
              <X className="w-4 h-4 mr-2" />
              Limpar
            </Button>
          )}

          {/* Botao Nova Fazenda */}
          <Button onClick={() => handleOpenDialog()} className="h-9 ml-auto">
            <Plus className="w-4 h-4 mr-2" />
            Nova Fazenda
          </Button>
        </div>
      </div>

      {/* Tabela Premium */}
      {filteredFazendas.length === 0 ? (
        <EmptyState
          title="Nenhuma fazenda encontrada"
          description={searchTerm || filtroCliente !== 'todos'
            ? "Tente ajustar os filtros de busca"
            : "Cadastre uma fazenda para comecar."
          }
          action={!(searchTerm || filtroCliente !== 'todos') && (
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Nova Fazenda
            </Button>
          )}
        />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Header da tabela */}
          <div className="bg-gradient-to-r from-muted/80 via-muted/60 to-muted/80 border-b border-border">
            <div className="grid grid-cols-[1.5fr_1.2fr_1fr_1fr_1fr_0.6fr] text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              <div className="px-4 py-3 flex items-center gap-2">
                <div className="w-1 h-4 rounded-full bg-primary/40" />
                Nome
              </div>
              <div className="px-3 py-3">Cliente</div>
              <div className="px-3 py-3">Responsavel</div>
              <div className="px-3 py-3">Contato</div>
              <div className="px-3 py-3">Localizacao</div>
              <div className="px-2 py-3"></div>
            </div>
          </div>

          {/* Linhas */}
          <div className="divide-y divide-border/50">
            {fazendasPaginadas.map((fazenda, index) => (
              <div
                key={fazenda.id}
                className={`
                  group grid grid-cols-[1.5fr_1.2fr_1fr_1fr_1fr_0.6fr] items-center cursor-pointer transition-all duration-150
                  hover:bg-gradient-to-r hover:from-primary/5 hover:via-transparent hover:to-transparent
                  ${index % 2 === 0 ? 'bg-transparent' : 'bg-muted/20'}
                `}
                onClick={() => handleVerDetalhes(fazenda)}
              >
                {/* Nome */}
                <div className="px-4 py-3.5 flex items-center gap-3">
                  <div className="w-0.5 h-8 rounded-full bg-transparent group-hover:bg-primary transition-colors" />
                  <span className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                    {fazenda.nome}
                  </span>
                </div>

                {/* Cliente */}
                <div className="px-3 py-3.5 text-sm text-muted-foreground truncate">
                  {fazenda.cliente_nome || '-'}
                </div>

                {/* Responsavel */}
                <div className="px-3 py-3.5 text-sm text-muted-foreground truncate">
                  {fazenda.responsavel || '-'}
                </div>

                {/* Contato */}
                <div className="px-3 py-3.5 text-sm text-muted-foreground truncate">
                  {fazenda.contato_responsavel || '-'}
                </div>

                {/* Localizacao */}
                <div className="px-3 py-3.5 text-sm text-muted-foreground truncate">
                  {fazenda.localizacao || '-'}
                </div>

                {/* Acoes */}
                <div className="px-2 py-3.5 flex justify-center gap-1">
                  {hasLocation(fazenda) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNavigate(fazenda);
                      }}
                      className="w-8 h-8 rounded-md flex items-center justify-center bg-transparent hover:bg-emerald-500/10 transition-colors"
                      title="Navegar"
                    >
                      <Navigation className="w-4 h-4 text-muted-foreground hover:text-emerald-600 transition-colors" />
                    </button>
                  )}
                  <div className="w-8 h-8 rounded-md flex items-center justify-center bg-transparent group-hover:bg-primary/10 transition-colors">
                    <Eye className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Paginacao */}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-muted/30 via-transparent to-muted/30 border-t border-border">
              <span className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{((paginaAtual - 1) * ITENS_POR_PAGINA) + 1}-{Math.min(paginaAtual * ITENS_POR_PAGINA, filteredFazendas.length)}</span>
                {' '}de{' '}
                <span className="font-medium text-foreground">{filteredFazendas.length}</span>
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPaginaAtual(prev => Math.max(1, prev - 1))}
                  disabled={paginaAtual === 1}
                  className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted text-muted-foreground hover:text-foreground"
                >
                  Anterior
                </button>
                <div className="flex items-center gap-0.5 mx-2">
                  {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
                    let pageNum;
                    if (totalPaginas <= 5) pageNum = i + 1;
                    else if (paginaAtual <= 3) pageNum = i + 1;
                    else if (paginaAtual >= totalPaginas - 2) pageNum = totalPaginas - 4 + i;
                    else pageNum = paginaAtual - 2 + i;

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPaginaAtual(pageNum)}
                        className={`
                          w-8 h-8 text-xs font-medium rounded-md transition-all
                          ${paginaAtual === pageNum
                            ? 'bg-primary/15 text-primary shadow-sm'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          }
                        `}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setPaginaAtual(prev => Math.min(totalPaginas, prev + 1))}
                  disabled={paginaAtual === totalPaginas}
                  className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted text-muted-foreground hover:text-foreground"
                >
                  Proximo
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dialog de criacao/edicao */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Home className="w-5 h-5 text-primary" />
              {editingFazenda ? 'Editar Fazenda' : 'Nova Fazenda'}
            </DialogTitle>
            <DialogDescription>
              {editingFazenda
                ? `Editando ${editingFazenda.nome}`
                : 'Preencha os dados da nova fazenda'
              }
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome da Fazenda *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Nome da fazenda"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sigla">Sigla (2-3 caracteres)</Label>
              <Input
                id="sigla"
                value={formData.sigla}
                onChange={(e) => {
                  const valor = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
                  setFormData({ ...formData, sigla: valor });
                }}
                placeholder="Ex: SC, BV"
                maxLength={3}
                className="w-24 uppercase"
              />
              <p className="text-xs text-muted-foreground">
                Usada para identificar embrioes (ex: SC-2401-001)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cliente_id">Cliente *</Label>
              <Select
                value={formData.cliente_id}
                onValueChange={(v) => setFormData({ ...formData, cliente_id: v })}
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
              <Label htmlFor="localizacao">Localizacao</Label>
              <Input
                id="localizacao"
                value={formData.localizacao}
                onChange={(e) => setFormData({ ...formData, localizacao: e.target.value })}
                placeholder="Cidade, Estado"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mapsLink">Link do Google Maps</Label>
              <Input
                id="mapsLink"
                value={formData.mapsLink}
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
                  value={formData.latitude}
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
                  value={formData.longitude}
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
              <Label htmlFor="responsavel">Responsavel</Label>
              <Input
                id="responsavel"
                value={formData.responsavel}
                onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
                placeholder="Nome do responsavel"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contato_responsavel">Contato do Responsavel</Label>
              <Input
                id="contato_responsavel"
                value={formData.contato_responsavel}
                onChange={(e) => setFormData({ ...formData, contato_responsavel: e.target.value })}
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
                onClick={handleCloseDialog}
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
