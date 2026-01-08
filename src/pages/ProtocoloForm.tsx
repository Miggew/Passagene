import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Fazenda } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';

export default function ProtocoloForm() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [formData, setFormData] = useState({
    fazenda_id: '',
    data_inicio: new Date().toISOString().split('T')[0],
    veterinario: '',
    tecnico: '',
    observacoes: '',
  });

  useEffect(() => {
    loadFazendas();
  }, []);

  const loadFazendas = async () => {
    try {
      const { data, error } = await supabase
        .from('fazendas')
        .select('*')
        .order('nome', { ascending: true });

      if (error) throw error;
      setFazendas(data || []);
    } catch (error) {
      toast({
        title: 'Erro ao carregar fazendas',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.fazenda_id || !formData.data_inicio || !formData.veterinario.trim() || !formData.tecnico.trim()) {
      toast({
        title: 'Erro de validação',
        description: 'Fazenda, data de início, veterinário e técnico são obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);

      // Format responsavel_inicio as "VET: <veterinario> | TEC: <tecnico>"
      const responsavel_inicio = `VET: ${formData.veterinario.trim()} | TEC: ${formData.tecnico.trim()}`;

      // Garantir que data_inicio seja salva como string YYYY-MM-DD (sem conversão de timezone)
      const insertData: Record<string, string> = {
        fazenda_id: formData.fazenda_id,
        data_inicio: formData.data_inicio, // Já vem como YYYY-MM-DD do input type="date"
        responsavel_inicio: responsavel_inicio,
        status: 'ABERTO',
      };

      if (formData.observacoes.trim()) {
        insertData.observacoes = formData.observacoes;
      }

      const { data: protocoloData, error } = await supabase
        .from('protocolos_sincronizacao')
        .insert([insertData])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Protocolo criado',
        description: 'Protocolo criado com sucesso',
      });

      // Redirect to protocol detail
      navigate(`/protocolos/${protocoloData.id}`);
    } catch (error) {
      toast({
        title: 'Erro ao criar protocolo',
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
        <Button variant="ghost" size="sm" onClick={() => navigate('/protocolos')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Novo Protocolo</h1>
          <p className="text-slate-600 mt-1">Primeira visita - Cadastrar novo protocolo de sincronização</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações do Protocolo</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fazenda_id">Fazenda *</Label>
              <Select
                value={formData.fazenda_id}
                onValueChange={(value) => setFormData({ ...formData, fazenda_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a fazenda" />
                </SelectTrigger>
                <SelectContent>
                  {fazendas.map((fazenda) => (
                    <SelectItem key={fazenda.id} value={fazenda.id}>
                      {fazenda.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="data_inicio">Data de Início *</Label>
              <Input
                id="data_inicio"
                type="date"
                value={formData.data_inicio}
                onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="veterinario">Veterinário Responsável *</Label>
              <Input
                id="veterinario"
                value={formData.veterinario}
                onChange={(e) =>
                  setFormData({ ...formData, veterinario: e.target.value })
                }
                placeholder="Nome do veterinário"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tecnico">Técnico Responsável *</Label>
              <Input
                id="tecnico"
                value={formData.tecnico}
                onChange={(e) =>
                  setFormData({ ...formData, tecnico: e.target.value })
                }
                placeholder="Nome do técnico/funcionário"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                placeholder="Observações sobre o protocolo"
                rows={3}
              />
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                type="submit"
                className="bg-green-600 hover:bg-green-700"
                disabled={loading}
              >
                {loading ? 'Salvando...' : 'Criar Protocolo'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/protocolos')}
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