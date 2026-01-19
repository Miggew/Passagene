import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { Fazenda } from '@/lib/types';
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
import { Badge } from '@/components/ui/badge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, X } from 'lucide-react';
import DatePickerBR from '@/components/shared/DatePickerBR';

interface FazendaSelect {
  id: string;
  nome: string;
}

export default function PacoteAspiracaoForm() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fazendas, setFazendas] = useState<FazendaSelect[]>([]);

  const [formData, setFormData] = useState({
    fazenda_id: '',
    fazendas_destino_ids: [] as string[],
    data_aspiracao: new Date().toISOString().split('T')[0],
    horario_inicio: '',
    veterinario_responsavel: '',
    tecnico_responsavel: '',
    observacoes: '',
  });
  const [buscaFazendaDestino, setBuscaFazendaDestino] = useState('');

  useEffect(() => {
    loadFazendas();
  }, []);

  const loadFazendas = async () => {
    try {
      setLoading(true);
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
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.fazenda_id || formData.fazendas_destino_ids.length === 0 || !formData.data_aspiracao) {
      toast({
        title: 'Erro de validação',
        description: 'Fazenda, pelo menos uma fazenda destino e data são obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.veterinario_responsavel.trim()) {
      toast({
        title: 'Erro de validação',
        description: 'Veterinário responsável é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.tecnico_responsavel.trim()) {
      toast({
        title: 'Erro de validação',
        description: 'Técnico responsável é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      // Usar a primeira fazenda destino para compatibilidade (campo legacy)
      const primeiraFazendaDestino = formData.fazendas_destino_ids[0];

      const insertData = {
        fazenda_id: formData.fazenda_id,
        fazenda_destino_id: primeiraFazendaDestino, // Mantido para compatibilidade
        data_aspiracao: formData.data_aspiracao,
        horario_inicio: formData.horario_inicio || null,
        veterinario_responsavel: formData.veterinario_responsavel.trim(),
        tecnico_responsavel: formData.tecnico_responsavel.trim(),
        observacoes: formData.observacoes.trim() || null,
        status: 'EM_ANDAMENTO' as const,
      };

      const { data, error } = await supabase
        .from('pacotes_aspiracao')
        .insert([insertData])
        .select()
        .single();

      if (error) throw error;

      // Inserir múltiplas fazendas destino na tabela de relacionamento
      const fazendasDestinoData = formData.fazendas_destino_ids.map((fazendaId) => ({
        pacote_aspiracao_id: data.id,
        fazenda_destino_id: fazendaId,
      }));

      const { error: fazendasDestinoError } = await supabase
        .from('pacotes_aspiracao_fazendas_destino')
        .insert(fazendasDestinoData);

      if (fazendasDestinoError) throw fazendasDestinoError;

      toast({
        title: 'Aspiração criada',
        description: 'Aspiração criada com sucesso',
      });

      // Navegar para a página de detalhes do pacote
      navigate(`/aspiracoes/${data.id}`);
    } catch (error) {
      toast({
        title: 'Erro ao criar aspiração',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
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
      <div className="flex items-center gap-4">
        <Button onClick={() => navigate('/aspiracoes')} variant="outline" size="icon">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Nova Aspiração</h1>
          <p className="text-slate-600 mt-1">Criar nova aspiração</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações da Aspiração</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fazenda_id">Fazenda da Aspiração *</Label>
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

              <div className="space-y-2 col-span-2">
                <Label>Fazendas Destino *</Label>
                <div className="space-y-2">
                  <Input
                    placeholder="Buscar fazenda destino..."
                    value={buscaFazendaDestino}
                    onChange={(e) => setBuscaFazendaDestino(e.target.value)}
                    className="mb-2"
                  />
                  <Select
                    value=""
                    onValueChange={(value) => {
                      if (value && !formData.fazendas_destino_ids.includes(value)) {
                        setFormData({
                          ...formData,
                          fazendas_destino_ids: [...formData.fazendas_destino_ids, value],
                        });
                        setBuscaFazendaDestino(''); // Limpar busca após selecionar
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma fazenda destino para adicionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {fazendas
                        .filter((f) => !formData.fazendas_destino_ids.includes(f.id))
                        .filter((f) =>
                          buscaFazendaDestino.trim() === ''
                            ? true
                            : f.nome.toLowerCase().includes(buscaFazendaDestino.toLowerCase())
                        )
                        .map((fazenda) => (
                          <SelectItem key={fazenda.id} value={fazenda.id}>
                            {fazenda.nome}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                {formData.fazendas_destino_ids.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.fazendas_destino_ids.map((fazendaId) => {
                      const fazenda = fazendas.find((f) => f.id === fazendaId);
                      if (!fazenda) return null;
                      return (
                        <Badge key={fazendaId} variant="outline" className="flex items-center gap-1 pr-1">
                          {fazenda.nome}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              setFormData({
                                ...formData,
                                fazendas_destino_ids: formData.fazendas_destino_ids.filter((id) => id !== fazendaId),
                              });
                            }}
                            className="ml-1 hover:bg-slate-200 rounded-full p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}
                {formData.fazendas_destino_ids.length === 0 && (
                  <p className="text-sm text-slate-500">Selecione pelo menos uma fazenda destino</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="data_aspiracao">Data da Aspiração *</Label>
                <DatePickerBR
                  id="data_aspiracao"
                  value={formData.data_aspiracao}
                  onChange={(value) => setFormData({ ...formData, data_aspiracao: value || '' })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="horario_inicio">Horário de Início</Label>
                <Input
                  id="horario_inicio"
                  type="time"
                  value={formData.horario_inicio}
                  onChange={(e) => setFormData({ ...formData, horario_inicio: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="veterinario_responsavel">Veterinário Responsável *</Label>
                <Input
                  id="veterinario_responsavel"
                  value={formData.veterinario_responsavel}
                  onChange={(e) => setFormData({ ...formData, veterinario_responsavel: e.target.value })}
                  placeholder="Nome do veterinário"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tecnico_responsavel">Técnico Responsável *</Label>
                <Input
                  id="tecnico_responsavel"
                  value={formData.tecnico_responsavel}
                  onChange={(e) => setFormData({ ...formData, tecnico_responsavel: e.target.value })}
                  placeholder="Nome do técnico"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                placeholder="Observações sobre a aspiração"
                rows={3}
              />
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                type="submit"
                className="flex-1 bg-green-600 hover:bg-green-700"
                disabled={submitting}
              >
                {submitting ? 'Criando...' : 'Criar Aspiração'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/aspiracoes')}
                disabled={submitting}
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
