import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';
import PageHeader from '@/components/shared/PageHeader';
import { extractCoordsFromMapsUrl, isShortMapsUrl, isValidCoordinates } from '@/lib/coordinates';

interface Cliente {
  id: string;
  nome: string;
}

export default function FazendaForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [formData, setFormData] = useState({
    cliente_id: '',
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
    loadClientes();
    if (id) {
      loadFazenda();
    }
  }, [id]);

  const loadClientes = async () => {
    try {
      // Primeiro, verificar se a tabela clientes existe e tem dados
      const { data, error, count } = await supabase
        .from('clientes')
        .select('id, nome', { count: 'exact' })
        .order('nome', { ascending: true });

      if (error) {
        // Se o erro for relacionado à ordenação, tentar sem ordenação
        if (error.message?.includes('order') || error.code === 'PGRST116') {
          const { data: dataWithoutOrder, error: errorWithoutOrder } = await supabase
            .from('clientes')
            .select('id, nome');
          
          if (errorWithoutOrder) {
            throw errorWithoutOrder;
          }
          
          // Ordenar manualmente
          const sorted = (dataWithoutOrder || []).sort((a, b) => 
            (a.nome || '').localeCompare(b.nome || '')
          );
          setClientes(sorted);
          return;
        }
        throw error;
      }
      
      setClientes(data || []);
      
      if (!data || data.length === 0) {
        toast({
          title: 'Atenção',
          description: 'Nenhum cliente cadastrado. Cadastre um cliente antes de criar uma fazenda.',
          variant: 'default',
        });
      }
    } catch (error) {
      toast({
        title: 'Erro ao carregar clientes',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      setClientes([]);
    }
  };

  const loadFazenda = async () => {
    try {
      const { data, error } = await supabase
        .from('fazendas')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setFormData({
        cliente_id: data.cliente_id || '',
        nome: data.nome || '',
        sigla: data.sigla || '',
        localizacao: data.localizacao || '',
        latitude: data.latitude?.toString() || '',
        longitude: data.longitude?.toString() || '',
        mapsLink: '',
        responsavel: data.responsavel || '',
        contato_responsavel: data.contato_responsavel || '',
      });
    } catch (error) {
      toast({
        title: 'Erro ao carregar fazenda',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  };

  const handleMapsLinkChange = (value: string) => {
    setFormData({ ...formData, mapsLink: value });
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
      setFormData(prev => ({
        ...prev,
        mapsLink: value,
        latitude: coords.lat,
        longitude: coords.lng,
      }));
      setCoordsValid(true);
    }
  };

  const handleCoordsChange = (field: 'latitude' | 'longitude', value: string) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);

    // Validate coordinates when both are present
    if (newFormData.latitude && newFormData.longitude) {
      const lat = parseFloat(newFormData.latitude);
      const lng = parseFloat(newFormData.longitude);
      setCoordsValid(isValidCoordinates(lat, lng));
    } else {
      setCoordsValid(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.cliente_id) {
      toast({
        title: 'Erro de validação',
        description: 'Cliente é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.nome.trim()) {
      toast({
        title: 'Erro de validação',
        description: 'Nome da fazenda é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);

      const fazendaData: Record<string, string | number | null> = {
        cliente_id: formData.cliente_id,
        nome: formData.nome,
      };

      // Sigla: normalizar para maiúsculas ou null se vazio
      if (formData.sigla.trim()) {
        fazendaData.sigla = formData.sigla.trim().toUpperCase();
      } else {
        fazendaData.sigla = null;
      }

      if (formData.localizacao.trim()) fazendaData.localizacao = formData.localizacao;
      if (formData.responsavel.trim()) fazendaData.responsavel = formData.responsavel;
      if (formData.contato_responsavel.trim())
        fazendaData.contato_responsavel = formData.contato_responsavel;

      // Coordenadas
      if (formData.latitude && formData.longitude) {
        const lat = parseFloat(formData.latitude);
        const lng = parseFloat(formData.longitude);
        if (isValidCoordinates(lat, lng)) {
          fazendaData.latitude = lat;
          fazendaData.longitude = lng;
        }
      } else {
        fazendaData.latitude = null;
        fazendaData.longitude = null;
      }

      if (id) {
        // Update
        const { error } = await supabase.from('fazendas').update(fazendaData).eq('id', id);

        if (error) throw error;

        toast({
          title: 'Fazenda atualizada',
          description: 'Fazenda atualizada com sucesso',
        });
      } else {
        // Create
        const { data, error } = await supabase
          .from('fazendas')
          .insert([fazendaData])
          .select()
          .single();

        if (error) throw error;

        toast({
          title: 'Fazenda criada',
          description: 'Fazenda criada com sucesso',
        });
      }

      navigate('/fazendas');
    } catch (error) {
      toast({
        title: 'Erro ao salvar fazenda',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={id ? 'Editar Fazenda' : 'Nova Fazenda'}
        description={id ? 'Atualizar informações da fazenda' : 'Cadastrar nova fazenda'}
        actions={(
          <Button variant="outline" size="icon" onClick={() => navigate('/fazendas')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
        )}
      />

      <Card>
        <CardHeader>
          <CardTitle>Informações da Fazenda</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cliente_id">Cliente *</Label>
              {clientes.length === 0 ? (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
                  Nenhum cliente cadastrado. Por favor, cadastre um cliente primeiro.
                </div>
              ) : (
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
              )}
            </div>

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
                placeholder="Ex: SC, BV, FE"
                maxLength={3}
                className="w-24 uppercase"
              />
              <p className="text-xs text-muted-foreground">
                Usada para identificar embriões desta fazenda (ex: SC-2401-001)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="localizacao">Localização</Label>
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
              <Label htmlFor="responsavel">Responsável</Label>
              <Input
                id="responsavel"
                value={formData.responsavel}
                onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
                placeholder="Nome do responsável"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contato_responsavel">Contato do Responsável</Label>
              <Input
                id="contato_responsavel"
                value={formData.contato_responsavel}
                onChange={(e) =>
                  setFormData({ ...formData, contato_responsavel: e.target.value })
                }
                placeholder="Telefone ou email"
              />
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                type="submit"
                className="bg-green-600 hover:bg-green-700"
                disabled={loading}
              >
                {loading ? 'Salvando...' : id ? 'Atualizar' : 'Criar Fazenda'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/fazendas')}
                disabled={loading}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}