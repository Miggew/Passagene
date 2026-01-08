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
    localizacao: '',
    responsavel: '',
    contato_responsavel: '',
  });

  useEffect(() => {
    loadClientes();
    if (id) {
      loadFazenda();
    }
  }, [id]);

  const loadClientes = async () => {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome')
        .order('nome', { ascending: true });

      if (error) throw error;
      setClientes(data || []);
    } catch (error) {
      toast({
        title: 'Erro ao carregar clientes',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
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
        localizacao: data.localizacao || '',
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

      const fazendaData: Record<string, string> = {
        cliente_id: formData.cliente_id,
        nome: formData.nome,
      };

      if (formData.localizacao.trim()) fazendaData.localizacao = formData.localizacao;
      if (formData.responsavel.trim()) fazendaData.responsavel = formData.responsavel;
      if (formData.contato_responsavel.trim())
        fazendaData.contato_responsavel = formData.contato_responsavel;

      console.log('Fazenda payload:', fazendaData);

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

        console.log('Fazenda created:', data);

        toast({
          title: 'Fazenda criada',
          description: 'Fazenda criada com sucesso',
        });
      }

      navigate('/fazendas');
    } catch (error) {
      console.error('Error saving fazenda:', error);
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
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/fazendas')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            {id ? 'Editar Fazenda' : 'Nova Fazenda'}
          </h1>
          <p className="text-slate-600 mt-1">
            {id ? 'Atualizar informações da fazenda' : 'Cadastrar nova fazenda'}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações da Fazenda</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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
              <Label htmlFor="localizacao">Localização</Label>
              <Input
                id="localizacao"
                value={formData.localizacao}
                onChange={(e) => setFormData({ ...formData, localizacao: e.target.value })}
                placeholder="Cidade, Estado"
              />
            </div>

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