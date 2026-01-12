import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { ArrowRightLeft } from 'lucide-react';

interface Fazenda {
  id: string;
  nome: string;
}

interface ReceptoraSincronizada {
  receptora_id: string;
  brinco: string;
  protocolo_id: string;
  protocolo_receptora_id: string;
}

interface EmbrioDisponivel {
  embriao_id: string;
  identificacao?: string;
  classificacao?: string;
  status_atual: string;
  localizacao_atual?: string;
}

export default function TransferenciaEmbrioes() {
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [receptoras, setReceptoras] = useState<ReceptoraSincronizada[]>([]);
  const [embrioes, setEmbrioes] = useState<EmbrioDisponivel[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    fazenda_id: '',
    receptora_id: '',
    protocolo_receptora_id: '',
    embriao_id: '',
    data_te: new Date().toISOString().split('T')[0],
    tipo_te: 'FRESCO',
    veterinario_responsavel: '',
    tecnico_responsavel: '',
    observacoes: '',
  });

  useEffect(() => {
    loadFazendas();
    loadEmbrioes();
  }, []);

  const loadFazendas = async () => {
    try {
      const { data, error } = await supabase
        .from('fazendas')
        .select('id, nome')
        .order('nome', { ascending: true });

      if (error) throw error;
      setFazendas(data || []);
      setLoading(false);
    } catch (error) {
      toast({
        title: 'Erro ao carregar fazendas',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  const loadEmbrioes = async () => {
    try {
      // Load from view v_embrioes_disponiveis_te
      const { data, error } = await supabase.from('v_embrioes_disponiveis_te').select('*');

      if (error) throw error;
      setEmbrioes(data || []);
    } catch (error) {
      console.error('Error loading embrioes:', error);
      // Fallback: load directly from embrioes table
      const { data, error: fallbackError } = await supabase
        .from('embrioes')
        .select('id, identificacao, classificacao, status_atual, localizacao_atual')
        .in('status_atual', ['FRESCO', 'CONGELADO']);

      if (!fallbackError) {
        setEmbrioes(
          data?.map((e) => ({
            embriao_id: e.id,
            identificacao: e.identificacao,
            classificacao: e.classificacao,
            status_atual: e.status_atual,
            localizacao_atual: e.localizacao_atual,
          })) || []
        );
      }
    }
  };

  const handleFazendaChange = async (fazendaId: string) => {
    setFormData({ ...formData, fazenda_id: fazendaId, receptora_id: '', protocolo_receptora_id: '' });

    try {
      // 1. Buscar receptoras da fazenda atual via vw_receptoras_fazenda_atual
      const { data: viewData, error: viewError } = await supabase
        .from('vw_receptoras_fazenda_atual')
        .select('receptora_id')
        .eq('fazenda_id_atual', fazendaId);

      if (viewError) throw viewError;

      const receptoraIdsNaFazenda = viewData?.map(v => v.receptora_id) || [];

      if (receptoraIdsNaFazenda.length === 0) {
        setReceptoras([]);
        return;
      }

      // 2. Buscar receptoras sincronizadas que estão na fazenda atual
      const { data: statusData, error: statusError } = await supabase
        .from('v_protocolo_receptoras_status')
        .select('*')
        .eq('fase_ciclo', 'SINCRONIZADA')
        .in('receptora_id', receptoraIdsNaFazenda);

      if (statusError) throw statusError;

      if (!statusData || statusData.length === 0) {
        setReceptoras([]);
        return;
      }

      // 3. Buscar protocolo_receptora_id para cada uma
      const protocolosIds = Array.from(new Set(statusData.map(r => r.protocolo_id)));
      const { data: prData, error: prError } = await supabase
        .from('protocolo_receptoras')
        .select('id, receptora_id, protocolo_id')
        .in('protocolo_id', protocolosIds)
        .in('receptora_id', receptoraIdsNaFazenda);

      if (prError) throw prError;

      const prMap = new Map(prData?.map((pr) => [pr.receptora_id + pr.protocolo_id, pr.id]) || []);

      const receptorasComId = statusData.map((r) => ({
        receptora_id: r.receptora_id,
        brinco: r.brinco,
        protocolo_id: r.protocolo_id,
        protocolo_receptora_id: prMap.get(r.receptora_id + r.protocolo_id) || '',
      }));

      setReceptoras(receptorasComId);
    } catch (error) {
      toast({
        title: 'Erro ao carregar receptoras',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  };

  const handleReceptoraChange = (receptoraId: string) => {
    const receptora = receptoras.find((r) => r.receptora_id === receptoraId);
    setFormData({
      ...formData,
      receptora_id: receptoraId,
      protocolo_receptora_id: receptora?.protocolo_receptora_id || '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formData.fazenda_id ||
      !formData.receptora_id ||
      !formData.embriao_id ||
      !formData.data_te
    ) {
      toast({
        title: 'Erro de validação',
        description: 'Fazenda, receptora, embrião e data de TE são obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      // Insert transferencia
      const insertData: Record<string, string | null> = {
        embriao_id: formData.embriao_id,
        receptora_id: formData.receptora_id,
        fazenda_id: formData.fazenda_id,
        protocolo_receptora_id: formData.protocolo_receptora_id || null,
        data_te: formData.data_te,
        tipo_te: formData.tipo_te,
        veterinario_responsavel: formData.veterinario_responsavel || null,
        tecnico_responsavel: formData.tecnico_responsavel || null,
        status_te: 'REALIZADA',
        observacoes: formData.observacoes || null,
      };

      const { error: teError } = await supabase.from('transferencias_embrioes').insert([insertData]);

      if (teError) throw teError;

      // Update embriao status
      const { error: embriaoError } = await supabase
        .from('embrioes')
        .update({ status_atual: 'TRANSFERIDO' })
        .eq('id', formData.embriao_id);

      if (embriaoError) throw embriaoError;

      // Update protocolo_receptora status
      if (formData.protocolo_receptora_id) {
        const { error: prError } = await supabase
          .from('protocolo_receptoras')
          .update({ status: 'UTILIZADA' })
          .eq('id', formData.protocolo_receptora_id);

        if (prError) throw prError;
      }

      toast({
        title: 'Transferência realizada',
        description: 'Transferência de embrião registrada com sucesso',
      });

      setFormData({
        fazenda_id: '',
        receptora_id: '',
        protocolo_receptora_id: '',
        embriao_id: '',
        data_te: new Date().toISOString().split('T')[0],
        tipo_te: 'FRESCO',
        veterinario_responsavel: '',
        tecnico_responsavel: '',
        observacoes: '',
      });
      setReceptoras([]);
      loadEmbrioes();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao realizar transferência',
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Transferência de Embriões (TE)</h1>
        <p className="text-slate-600 mt-1">Registrar transferência de embriões para receptoras</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5" />
            Nova Transferência
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fazenda_id">Fazenda *</Label>
                <Select value={formData.fazenda_id} onValueChange={handleFazendaChange}>
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
                <Label htmlFor="receptora_id">Receptora Sincronizada *</Label>
                <Select
                  value={formData.receptora_id}
                  onValueChange={handleReceptoraChange}
                  disabled={!formData.fazenda_id}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a receptora" />
                  </SelectTrigger>
                  <SelectContent>
                    {receptoras.length === 0 ? (
                      <div className="p-2 text-sm text-slate-500">
                        Nenhuma receptora sincronizada disponível
                      </div>
                    ) : (
                      receptoras.map((receptora) => (
                        <SelectItem key={receptora.receptora_id} value={receptora.receptora_id}>
                          {receptora.brinco}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="embriao_id">Embrião Disponível *</Label>
                <Select
                  value={formData.embriao_id}
                  onValueChange={(value) => setFormData({ ...formData, embriao_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o embrião" />
                  </SelectTrigger>
                  <SelectContent>
                    {embrioes.length === 0 ? (
                      <div className="p-2 text-sm text-slate-500">
                        Nenhum embrião disponível
                      </div>
                    ) : (
                      embrioes.map((embriao) => (
                        <SelectItem key={embriao.embriao_id} value={embriao.embriao_id}>
                          {embriao.identificacao || embriao.embriao_id.slice(0, 8)} -{' '}
                          {embriao.classificacao} ({embriao.status_atual})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="data_te">Data da TE *</Label>
                <Input
                  id="data_te"
                  type="date"
                  value={formData.data_te}
                  onChange={(e) => setFormData({ ...formData, data_te: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tipo_te">Tipo de TE</Label>
                <Select
                  value={formData.tipo_te}
                  onValueChange={(value) => setFormData({ ...formData, tipo_te: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FRESCO">FRESCO</SelectItem>
                    <SelectItem value="CONGELADO">CONGELADO</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="veterinario_responsavel">Veterinário Responsável</Label>
                <Input
                  id="veterinario_responsavel"
                  value={formData.veterinario_responsavel}
                  onChange={(e) =>
                    setFormData({ ...formData, veterinario_responsavel: e.target.value })
                  }
                  placeholder="Nome do veterinário"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tecnico_responsavel">Técnico Responsável</Label>
              <Input
                id="tecnico_responsavel"
                value={formData.tecnico_responsavel}
                onChange={(e) => setFormData({ ...formData, tecnico_responsavel: e.target.value })}
                placeholder="Nome do técnico"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                placeholder="Observações sobre a transferência"
                rows={3}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="submit"
                className="bg-green-600 hover:bg-green-700"
                disabled={submitting}
              >
                {submitting ? 'Registrando...' : 'Registrar Transferência'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}