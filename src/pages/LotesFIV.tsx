import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { LoteFIV, LoteFIVAcasalamento, PacoteAspiracao, AspiracaoDoadora, DoseSemen, Fazenda, Doadora } from '@/lib/types';
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
import { Badge } from '@/components/ui/badge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { Plus, ArrowLeft, Eye, Lock, Calendar } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface LoteFIVComNomes extends LoteFIV {
  pacote_nome?: string;
  pacote_data?: string;
  fazendas_destino_nomes?: string[];
  quantidade_acasalamentos?: number;
  dias_aberto?: number;
}

interface PacoteComNomes extends PacoteAspiracao {
  fazenda_nome?: string;
  fazendas_destino_nomes?: string[];
  quantidade_doadoras?: number;
}

interface AcasalamentoComNomes extends LoteFIVAcasalamento {
  doadora_nome?: string;
  doadora_registro?: string;
  dose_nome?: string;
  viaveis?: number;
}

export default function LotesFIV() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [lotes, setLotes] = useState<LoteFIVComNomes[]>([]);
  const [pacotes, setPacotes] = useState<PacoteComNomes[]>([]);
  const [aspiracoesDoadoras, setAspiracoesDoadoras] = useState<AspiracaoDoadora[]>([]);
  const [doses, setDoses] = useState<DoseSemen[]>([]);
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [doadoras, setDoadoras] = useState<Doadora[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showLoteDetail, setShowLoteDetail] = useState(false);
  const [selectedLote, setSelectedLote] = useState<LoteFIVComNomes | null>(null);
  const [acasalamentos, setAcasalamentos] = useState<AcasalamentoComNomes[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [editQuantidadeEmbrioes, setEditQuantidadeEmbrioes] = useState<{ [key: string]: string }>({});
  const [showAddAcasalamento, setShowAddAcasalamento] = useState(false);
  const [aspiracoesDisponiveis, setAspiracoesDisponiveis] = useState<AspiracaoDoadora[]>([]);
  const [dosesDisponiveis, setDosesDisponiveis] = useState<DoseSemen[]>([]);
  const [acasalamentoForm, setAcasalamentoForm] = useState({
    aspiracao_doadora_id: '',
    dose_semen_id: '',
    quantidade_fracionada: '1.0',
    observacoes: '',
  });

  const [formData, setFormData] = useState({
    pacote_aspiracao_id: '',
    observacoes: '',
  });

  const [selectedPacote, setSelectedPacote] = useState<PacoteComNomes | null>(null);

  useEffect(() => {
    if (id) {
      loadLoteDetail(id);
    } else {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load pacotes FINALIZADOS
      const { data: pacotesData, error: pacotesError } = await supabase
        .from('pacotes_aspiracao')
        .select('*')
        .eq('status', 'FINALIZADO')
        .order('data_aspiracao', { ascending: false });

      if (pacotesError) throw pacotesError;

      // Load fazendas
      const { data: fazendasData, error: fazendasError } = await supabase
        .from('fazendas')
        .select('id, nome')
        .order('nome', { ascending: true });

      if (fazendasError) throw fazendasError;
      setFazendas(fazendasData || []);

      const fazendasMap = new Map(fazendasData?.map((f) => [f.id, f.nome]));
      const fazendasDestinoPorPacote = new Map<string, string[]>();
      const quantidadePorPacote = new Map<string, number>();

      // Load fazendas destino dos pacotes
      const pacoteIds = pacotesData?.map((p) => p.id) || [];
      
      if (pacoteIds.length > 0) {
        const { data: fazendasDestinoData, error: fazendasDestinoError } = await supabase
          .from('pacotes_aspiracao_fazendas_destino')
          .select('pacote_aspiracao_id, fazenda_destino_id')
          .in('pacote_aspiracao_id', pacoteIds);

        if (fazendasDestinoError) {
          console.error('Erro ao carregar fazendas destino:', fazendasDestinoError);
          // Continuar mesmo com erro - pode ser que a tabela não exista ainda
        } else if (fazendasDestinoData) {
          fazendasDestinoData.forEach((fd) => {
            const nome = fazendasMap.get(fd.fazenda_destino_id);
            if (nome) {
              const atual = fazendasDestinoPorPacote.get(fd.pacote_aspiracao_id) || [];
              atual.push(nome);
              fazendasDestinoPorPacote.set(fd.pacote_aspiracao_id, atual);
            }
          });
        }

        // Load quantidade de doadoras por pacote
        const { data: aspiracoesData, error: aspiracoesError } = await supabase
          .from('aspiracoes_doadoras')
          .select('pacote_aspiracao_id')
          .in('pacote_aspiracao_id', pacoteIds);

        if (aspiracoesError) {
          console.error('Erro ao carregar aspirações:', aspiracoesError);
        } else if (aspiracoesData) {
          aspiracoesData.forEach((a) => {
            if (a.pacote_aspiracao_id) {
              quantidadePorPacote.set(a.pacote_aspiracao_id, (quantidadePorPacote.get(a.pacote_aspiracao_id) || 0) + 1);
            }
          });
        }
      }

      const pacotesComNomes: PacoteComNomes[] = (pacotesData || []).map((p) => ({
        ...p,
        fazenda_nome: fazendasMap.get(p.fazenda_id),
        fazendas_destino_nomes: fazendasDestinoPorPacote.get(p.id) || [],
        quantidade_doadoras: quantidadePorPacote.get(p.id) || 0,
      }));

      setPacotes(pacotesComNomes);

      // Load lotes
      const { data: lotesData, error: lotesError } = await supabase
        .from('lotes_fiv')
        .select('*')
        .order('data_abertura', { ascending: false });

      if (lotesError) throw lotesError;

      // Load acasalamentos para contar
      const loteIds = lotesData?.map((l) => l.id) || [];
      const { data: acasalamentosData, error: acasalamentosError } = await supabase
        .from('lote_fiv_acasalamentos')
        .select('lote_fiv_id')
        .in('lote_fiv_id', loteIds);

      if (acasalamentosError) throw acasalamentosError;

      const quantidadeAcasalamentosPorLote = new Map<string, number>();
      acasalamentosData?.forEach((a) => {
        quantidadeAcasalamentosPorLote.set(a.lote_fiv_id, (quantidadeAcasalamentosPorLote.get(a.lote_fiv_id) || 0) + 1);
      });

      // Load fazendas destino dos lotes
      const { data: fazendasDestinoLotesData, error: fazendasDestinoLotesError } = await supabase
        .from('lote_fiv_fazendas_destino')
        .select('lote_fiv_id, fazenda_id')
        .in('lote_fiv_id', loteIds);

      if (fazendasDestinoLotesError) throw fazendasDestinoLotesError;

      const fazendasDestinoPorLote = new Map<string, string[]>();
      fazendasDestinoLotesData?.forEach((fd) => {
        const nome = fazendasMap.get(fd.fazenda_id);
        if (nome) {
          const atual = fazendasDestinoPorLote.get(fd.lote_fiv_id) || [];
          atual.push(nome);
          fazendasDestinoPorLote.set(fd.lote_fiv_id, atual);
        }
      });

      const pacotesMap = new Map(pacotesComNomes.map((p) => [p.id, p]));

      const lotesComNomes: LoteFIVComNomes[] = (lotesData || []).map((l) => {
        const pacote = pacotesMap.get(l.pacote_aspiracao_id);
        const dataAbertura = new Date(l.data_abertura);
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        dataAbertura.setHours(0, 0, 0, 0);
        const diasAberto = Math.max(0, Math.floor((hoje.getTime() - dataAbertura.getTime()) / (1000 * 60 * 60 * 24)));

        return {
          ...l,
          pacote_nome: pacote?.fazenda_nome,
          pacote_data: pacote?.data_aspiracao,
          fazendas_destino_nomes: fazendasDestinoPorLote.get(l.id) || [],
          quantidade_acasalamentos: quantidadeAcasalamentosPorLote.get(l.id) || 0,
          dias_aberto: diasAberto,
        };
      });

      setLotes(lotesComNomes);
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

  const loadLoteDetail = async (loteId: string) => {
    try {
      setLoading(true);

      // Load lote
      const { data: loteData, error: loteError } = await supabase
        .from('lotes_fiv')
        .select('*')
        .eq('id', loteId)
        .single();

      if (loteError) throw loteError;

      // Load pacote
      const { data: pacoteData, error: pacoteError } = await supabase
        .from('pacotes_aspiracao')
        .select('*')
        .eq('id', loteData.pacote_aspiracao_id)
        .single();

      if (pacoteError) throw pacoteError;

      // Load acasalamentos
      const { data: acasalamentosData, error: acasalamentosError } = await supabase
        .from('lote_fiv_acasalamentos')
        .select('*')
        .eq('lote_fiv_id', loteId)
        .order('created_at', { ascending: true });

      if (acasalamentosError) throw acasalamentosError;

      // Load aspirações doadoras
      const aspiracaoIds = acasalamentosData?.map((a) => a.aspiracao_doadora_id) || [];
      const { data: aspiracoesData, error: aspiracoesError } = await supabase
        .from('aspiracoes_doadoras')
        .select('id, doadora_id, viaveis')
        .in('id', aspiracaoIds);

      if (aspiracoesError) throw aspiracoesError;

      // Load doadoras
      const doadoraIds = [...new Set(aspiracoesData?.map((a) => a.doadora_id) || [])];
      const { data: doadorasData, error: doadorasError } = await supabase
        .from('doadoras')
        .select('id, nome, registro')
        .in('id', doadoraIds);

      if (doadorasError) throw doadorasError;

      // Load doses
      const doseIds = [...new Set(acasalamentosData?.map((a) => a.dose_semen_id) || [])];
      const { data: dosesData, error: dosesError } = await supabase
        .from('doses_semen')
        .select('id, nome')
        .in('id', doseIds);

      if (dosesError) throw dosesError;

      const doadorasMap = new Map(doadorasData?.map((d) => [d.id, d]));
      const dosesMap = new Map(dosesData?.map((d) => [d.id, d]));
      const aspiracoesMap = new Map(aspiracoesData?.map((a) => [a.id, a]));

      const acasalamentosComNomes: AcasalamentoComNomes[] = (acasalamentosData || []).map((a) => {
        const aspiracao = aspiracoesMap.get(a.aspiracao_doadora_id);
        const doadora = aspiracao ? doadorasMap.get(aspiracao.doadora_id) : undefined;
        const dose = dosesMap.get(a.dose_semen_id);

        return {
          ...a,
          doadora_nome: doadora?.nome || doadora?.registro,
          doadora_registro: doadora?.registro,
          dose_nome: dose?.nome,
          viaveis: aspiracao?.viaveis,
        };
      });

      setAcasalamentos(acasalamentosComNomes);
      setSelectedLote({
        ...loteData,
        pacote_nome: pacoteData.fazenda_id,
        pacote_data: pacoteData.data_aspiracao,
      } as LoteFIVComNomes);
      setShowLoteDetail(true);

      // Carregar todas as aspirações do pacote (para usar no dialog de adicionar acasalamento)
      const { data: todasAspiracoesData, error: todasAspiracoesError } = await supabase
        .from('aspiracoes_doadoras')
        .select('id, doadora_id, viaveis')
        .eq('pacote_aspiracao_id', loteData.pacote_aspiracao_id);

      if (todasAspiracoesError) {
        console.error('Erro ao carregar todas as aspirações:', todasAspiracoesError);
      } else {
        // Filtrar aspirações que ainda não foram usadas
        const aspiracaoIdsJaUsadas = acasalamentosData?.map((a) => a.aspiracao_doadora_id) || [];
        const aspiracoesDisponiveis = (todasAspiracoesData || []).filter(
          (a) => !aspiracaoIdsJaUsadas.includes(a.id)
        );
        setAspiracoesDisponiveis(aspiracoesDisponiveis);

        // Carregar todas as doadoras do pacote para exibir no select
        const todasDoadoraIds = [...new Set(todasAspiracoesData?.map((a) => a.doadora_id) || [])];
        if (todasDoadoraIds.length > 0) {
          const { data: todasDoadorasData, error: todasDoadorasError } = await supabase
            .from('doadoras')
            .select('id, nome, registro')
            .in('id', todasDoadoraIds);

          if (!todasDoadorasError && todasDoadorasData) {
            setDoadoras(todasDoadorasData);
          }
        }
      }

      // Load doses disponíveis
      const { data: dosesDisponiveisData, error: dosesDisponiveisError } = await supabase
        .from('doses_semen')
        .select('id, nome')
        .order('nome', { ascending: true });

      if (dosesDisponiveisError) {
        console.error('Erro ao carregar doses disponíveis:', dosesDisponiveisError);
      } else {
        setDosesDisponiveis(dosesDisponiveisData || []);
      }
    } catch (error) {
      toast({
        title: 'Erro ao carregar detalhes do lote',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePacoteChange = async (pacoteId: string) => {
    setFormData({ ...formData, pacote_aspiracao_id: pacoteId });
    const pacote = pacotes.find((p) => p.id === pacoteId);
    setSelectedPacote(pacote || null);

    if (pacote) {
      // Load aspirações doadoras do pacote
      const { data: aspiracoesData, error: aspiracoesError } = await supabase
        .from('aspiracoes_doadoras')
        .select('id, doadora_id, viaveis')
        .eq('pacote_aspiracao_id', pacoteId);

      if (aspiracoesError) {
        console.error('Erro ao carregar aspirações:', aspiracoesError);
        return;
      }

      setAspiracoesDoadoras(aspiracoesData || []);

      // Load doadoras
      const doadoraIds = [...new Set(aspiracoesData?.map((a) => a.doadora_id) || [])];
      if (doadoraIds.length > 0) {
        const { data: doadorasData, error: doadorasError } = await supabase
          .from('doadoras')
          .select('id, nome, registro')
          .in('id', doadoraIds);

        if (doadorasError) {
          console.error('Erro ao carregar doadoras:', doadorasError);
          return;
        }

        setDoadoras(doadorasData || []);
      }

      // Load doses
      const { data: dosesData, error: dosesError } = await supabase
        .from('doses_semen')
        .select('id, nome')
        .order('nome', { ascending: true });

      if (dosesError) {
        console.error('Erro ao carregar doses:', dosesError);
        return;
      }

      setDoses(dosesData || []);
    }
  };


  const handleAddAcasalamento = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedLote) return;

    if (!acasalamentoForm.aspiracao_doadora_id || !acasalamentoForm.dose_semen_id) {
      toast({
        title: 'Erro de validação',
        description: 'Doadora e dose de sêmen são obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    const quantidadeFracionada = parseFloat(acasalamentoForm.quantidade_fracionada) || 1.0;
    if (quantidadeFracionada <= 0) {
      toast({
        title: 'Erro de validação',
        description: 'Quantidade fracionada deve ser maior que zero',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const { error } = await supabase.from('lote_fiv_acasalamentos').insert([
        {
          lote_fiv_id: selectedLote.id,
          aspiracao_doadora_id: acasalamentoForm.aspiracao_doadora_id,
          dose_semen_id: acasalamentoForm.dose_semen_id,
          quantidade_fracionada: quantidadeFracionada,
          observacoes: acasalamentoForm.observacoes || null,
        },
      ]);

      if (error) throw error;

      toast({
        title: 'Acasalamento adicionado',
        description: 'Acasalamento adicionado com sucesso',
      });

      setShowAddAcasalamento(false);
      setAcasalamentoForm({
        aspiracao_doadora_id: '',
        dose_semen_id: '',
        quantidade_fracionada: '1.0',
        observacoes: '',
      });

      // Recarregar detalhes do lote
      await loadLoteDetail(selectedLote.id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao adicionar acasalamento',
        description: errorMessage.includes('RLS') || errorMessage.includes('policy')
          ? 'RLS está bloqueando escrita. Configure políticas anon no Supabase.'
          : errorMessage,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.pacote_aspiracao_id) {
      toast({
        title: 'Erro de validação',
        description: 'Pacote de aspiração é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedPacote) {
      toast({
        title: 'Erro de validação',
        description: 'Pacote selecionado não encontrado',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      // Verificar se o pacote existe antes de criar o lote
      const { data: pacoteVerificado, error: pacoteError } = await supabase
        .from('pacotes_aspiracao')
        .select('id, status')
        .eq('id', formData.pacote_aspiracao_id)
        .single();

      if (pacoteError || !pacoteVerificado) {
        toast({
          title: 'Erro de validação',
          description: 'Pacote de aspiração não encontrado ou inválido',
          variant: 'destructive',
        });
        return;
      }

      if (pacoteVerificado.status !== 'FINALIZADO') {
        toast({
          title: 'Erro de validação',
          description: 'Apenas pacotes FINALIZADOS podem ser usados para criar lotes FIV',
          variant: 'destructive',
        });
        return;
      }

      // Calcular data_abertura = data do pacote + 1 dia
      const dataPacote = new Date(selectedPacote.data_aspiracao);
      dataPacote.setDate(dataPacote.getDate() + 1);
      const dataAbertura = dataPacote.toISOString().split('T')[0];

      console.log('Dados que serão enviados:', {
        pacote_aspiracao_id: formData.pacote_aspiracao_id,
        data_abertura: dataAbertura,
        data_fecundacao: dataAbertura,
        status: 'ABERTO',
      });

      // Criar lote
      const { data: loteData, error: loteError } = await supabase
        .from('lotes_fiv')
        .insert([
          {
            pacote_aspiracao_id: formData.pacote_aspiracao_id,
            data_abertura: dataAbertura,
            data_fecundacao: dataAbertura, // data_fecundacao = data_abertura (mesma data)
            status: 'ABERTO',
            observacoes: formData.observacoes || null,
          },
        ])
        .select()
        .single();

      if (loteError) {
        console.error('Erro detalhado ao criar lote:', {
          message: loteError.message,
          details: loteError.details,
          hint: loteError.hint,
          code: loteError.code,
        });
        throw loteError;
      }

      // Inserir fazendas destino do pacote no lote
      const fazendasDestinoIds = selectedPacote.fazendas_destino_nomes
        ?.map((nome) => {
          const fazenda = fazendas.find((f) => f.nome === nome);
          return fazenda?.id;
        })
        .filter((id): id is string => !!id);

      if (fazendasDestinoIds && fazendasDestinoIds.length > 0) {
        const { error: fazendasError } = await supabase.from('lote_fiv_fazendas_destino').insert(
          fazendasDestinoIds.map((fazendaId) => ({
            lote_fiv_id: loteData.id,
            fazenda_id: fazendaId,
          }))
        );

        if (fazendasError) throw fazendasError;
      }

      toast({
        title: 'Lote FIV criado',
        description: 'Lote FIV criado com sucesso. Agora você pode adicionar acasalamentos.',
      });

      setShowDialog(false);
      setFormData({
        pacote_aspiracao_id: '',
        observacoes: '',
      });
      setSelectedPacote(null);
      setAspiracoesDoadoras([]);
      setDoadoras([]);

      // Navegar para o detalhe do lote
      navigate(`/lotes-fiv/${loteData.id}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao criar lote',
        description: errorMessage.includes('RLS') || errorMessage.includes('policy')
          ? 'RLS está bloqueando escrita. Configure políticas anon no Supabase.'
          : errorMessage,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !selectedLote) {
    return <LoadingSpinner />;
  }

  // Se estiver visualizando um lote específico
  if (selectedLote && showLoteDetail) {
    const dataAbertura = new Date(selectedLote.data_abertura);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    dataAbertura.setHours(0, 0, 0, 0);
    const diasAberto = Math.max(0, Math.floor((hoje.getTime() - dataAbertura.getTime()) / (1000 * 60 * 60 * 24)));
    const diasRestantes = Math.max(0, 7 - diasAberto);

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/lotes-fiv')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Detalhes do Lote FIV</h1>
            <div className="text-slate-600 mt-1 flex items-center gap-2">
              <span>Data de abertura: {formatDate(selectedLote.data_abertura)} | Status:</span>
              <Badge variant={selectedLote.status === 'FECHADO' ? 'default' : 'secondary'}>
                {selectedLote.status}
              </Badge>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Informações do Lote</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Dias Abertos</Label>
                <p className="text-2xl font-bold">{diasAberto}</p>
              </div>
              <div>
                <Label>Dias Restantes até Dia 7</Label>
                <p className="text-2xl font-bold text-orange-600">{diasRestantes}</p>
              </div>
            </div>

            {selectedLote.status === 'ABERTO' && diasAberto >= 7 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-orange-800 font-medium">
                  ⚠️ Este lote está no dia 7 ou depois. Informe a quantidade de embriões para cada acasalamento.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Acasalamentos</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Doadora</TableHead>
                  <TableHead>Dose de Sêmen</TableHead>
                  <TableHead>Quantidade Fracionada</TableHead>
                  <TableHead>Oócitos Viáveis</TableHead>
                  {selectedLote.status === 'ABERTO' && diasAberto >= 7 && (
                    <TableHead>Quantidade de Embriões</TableHead>
                  )}
                  {selectedLote.status === 'FECHADO' && <TableHead>Quantidade de Embriões</TableHead>}
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {acasalamentos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={selectedLote.status === 'FECHADO' || diasAberto >= 7 ? 6 : 5} className="text-center text-slate-500">
                      Nenhum acasalamento cadastrado
                    </TableCell>
                  </TableRow>
                ) : (
                  acasalamentos.map((acasalamento) => (
                    <TableRow key={acasalamento.id}>
                      <TableCell className="font-medium">
                        {acasalamento.doadora_nome}
                        {acasalamento.doadora_registro && (
                          <span className="text-slate-500 text-sm ml-2">
                            ({acasalamento.doadora_registro})
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{acasalamento.dose_nome}</TableCell>
                      <TableCell>{acasalamento.quantidade_fracionada}</TableCell>
                      <TableCell>{acasalamento.viaveis ?? '-'}</TableCell>
                      {(selectedLote.status === 'FECHADO' || (selectedLote.status === 'ABERTO' && diasAberto >= 7)) && (
                        <TableCell>
                          {selectedLote.status === 'ABERTO' && diasAberto >= 7 ? (
                            <Input
                              type="number"
                              min="0"
                              value={editQuantidadeEmbrioes[acasalamento.id] ?? acasalamento.quantidade_embrioes ?? ''}
                              onChange={(e) =>
                                setEditQuantidadeEmbrioes({
                                  ...editQuantidadeEmbrioes,
                                  [acasalamento.id]: e.target.value,
                                })
                              }
                              className="w-24"
                              placeholder="0"
                            />
                          ) : (
                            acasalamento.quantidade_embrioes ?? '-'
                          )}
                        </TableCell>
                      )}
                      <TableCell className="text-right">
                        {selectedLote.status === 'ABERTO' && diasAberto >= 7 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              const quantidade = parseInt(editQuantidadeEmbrioes[acasalamento.id] || '0');
                              if (isNaN(quantidade) || quantidade < 0) {
                                toast({
                                  title: 'Erro',
                                  description: 'Quantidade inválida',
                                  variant: 'destructive',
                                });
                                return;
                              }

                              try {
                                const { error } = await supabase
                                  .from('lote_fiv_acasalamentos')
                                  .update({ quantidade_embrioes: quantidade })
                                  .eq('id', acasalamento.id);

                                if (error) throw error;

                                toast({
                                  title: 'Quantidade atualizada',
                                  description: 'Quantidade de embriões atualizada com sucesso',
                                });

                                setEditQuantidadeEmbrioes({
                                  ...editQuantidadeEmbrioes,
                                  [acasalamento.id]: quantidade.toString(),
                                });

                                loadLoteDetail(selectedLote.id);
                              } catch (error) {
                                toast({
                                  title: 'Erro ao atualizar',
                                  description: error instanceof Error ? error.message : 'Erro desconhecido',
                                  variant: 'destructive',
                                });
                              }
                            }}
                          >
                            Salvar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {selectedLote.status === 'ABERTO' && diasAberto < 7 && (
              <div className="mt-4 flex justify-end">
                <Dialog open={showAddAcasalamento} onOpenChange={setShowAddAcasalamento}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar Acasalamento
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Adicionar Acasalamento</DialogTitle>
                      <DialogDescription>
                        Selecione uma doadora do pacote e uma dose de sêmen
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddAcasalamento} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="aspiracao_doadora_id">Doadora *</Label>
                        <Select
                          value={acasalamentoForm.aspiracao_doadora_id}
                          onValueChange={(value) =>
                            setAcasalamentoForm({ ...acasalamentoForm, aspiracao_doadora_id: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma doadora" />
                          </SelectTrigger>
                          <SelectContent>
                            {aspiracoesDisponiveis.map((aspiracao) => {
                              const doadora = doadoras.find((d) => d.id === aspiracao.doadora_id);
                              return (
                                <SelectItem key={aspiracao.id} value={aspiracao.id}>
                                  {doadora ? `${doadora.nome} (${doadora.registro})` : `Doadora ${aspiracao.doadora_id}`}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dose_semen_id">Dose de Sêmen *</Label>
                        <Select
                          value={acasalamentoForm.dose_semen_id}
                          onValueChange={(value) =>
                            setAcasalamentoForm({ ...acasalamentoForm, dose_semen_id: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma dose de sêmen" />
                          </SelectTrigger>
                          <SelectContent>
                            {dosesDisponiveis.map((dose) => (
                              <SelectItem key={dose.id} value={dose.id}>
                                {dose.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="quantidade_fracionada">Quantidade Fracionada *</Label>
                        <Input
                          id="quantidade_fracionada"
                          type="number"
                          step="0.1"
                          min="0.1"
                          value={acasalamentoForm.quantidade_fracionada}
                          onChange={(e) =>
                            setAcasalamentoForm({ ...acasalamentoForm, quantidade_fracionada: e.target.value })
                          }
                          placeholder="Ex: 1.0, 0.5, 1.5"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="observacoes">Observações</Label>
                        <Textarea
                          id="observacoes"
                          value={acasalamentoForm.observacoes}
                          onChange={(e) =>
                            setAcasalamentoForm({ ...acasalamentoForm, observacoes: e.target.value })
                          }
                          placeholder="Observações sobre este acasalamento"
                          rows={3}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setShowAddAcasalamento(false)}>
                          Cancelar
                        </Button>
                        <Button type="submit" disabled={submitting}>
                          {submitting ? 'Adicionando...' : 'Adicionar'}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Lista de lotes
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Lotes FIV</h1>
          <p className="text-slate-600 mt-1">Gerenciar lotes de fecundação in vitro</p>
        </div>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button className="bg-green-600 hover:bg-green-700">
              <Plus className="w-4 h-4 mr-2" />
              Novo Lote
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Criar Novo Lote FIV</DialogTitle>
              <DialogDescription>
                Selecione um pacote de aspiração FINALIZADO para criar o lote
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pacote_aspiracao_id">Pacote de Aspiração *</Label>
                <Select
                  value={formData.pacote_aspiracao_id}
                  onValueChange={handlePacoteChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o pacote" />
                  </SelectTrigger>
                  <SelectContent>
                    {pacotes.map((pacote) => (
                      <SelectItem key={pacote.id} value={pacote.id}>
                        {formatDate(pacote.data_aspiracao)} - {pacote.fazenda_nome} ({pacote.quantidade_doadoras} doadoras)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedPacote && (
                  <div className="text-sm text-slate-600 space-y-1 mt-2 p-3 bg-slate-50 rounded-lg">
                    <p>
                      <strong>Data do Pacote:</strong> {formatDate(selectedPacote.data_aspiracao)}
                    </p>
                    <p>
                      <strong>Data de Abertura do Lote:</strong>{' '}
                      {(() => {
                        const dataPacote = new Date(selectedPacote.data_aspiracao);
                        dataPacote.setDate(dataPacote.getDate() + 1);
                        return formatDate(dataPacote.toISOString().split('T')[0]);
                      })()}
                    </p>
                    <p>
                      <strong>Fazendas Destino:</strong>{' '}
                      {selectedPacote.fazendas_destino_nomes?.join(', ') || 'Nenhuma'}
                    </p>
                    <p>
                      <strong>Quantidade de Doadoras:</strong> {selectedPacote.quantidade_doadoras || 0}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Observações sobre o lote"
                  rows={3}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="submit"
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={submitting}
                >
                  {submitting ? 'Criando...' : 'Criar Lote'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowDialog(false);
                    setFormData({
                      pacote_aspiracao_id: '',
                      observacoes: '',
                    });
                    setSelectedPacote(null);
                    setAspiracoesDoadoras([]);
                    setDoadoras([]);
                  }}
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
          <CardTitle>Lista de Lotes FIV</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data de Abertura</TableHead>
                <TableHead>Pacote</TableHead>
                <TableHead>Fazendas Destino</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dias Abertos</TableHead>
                <TableHead>Acasalamentos</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-500">
                    Nenhum lote cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                lotes.map((lote) => (
                  <TableRow key={lote.id}>
                    <TableCell>{formatDate(lote.data_abertura)}</TableCell>
                    <TableCell>
                      {lote.pacote_data && formatDate(lote.pacote_data)} - {lote.pacote_nome}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {lote.fazendas_destino_nomes && lote.fazendas_destino_nomes.length > 0 ? (
                          lote.fazendas_destino_nomes.map((nome, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {nome}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={lote.status === 'FECHADO' ? 'default' : 'secondary'}>
                        {lote.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className={lote.dias_aberto && lote.dias_aberto >= 7 ? 'text-orange-600 font-bold' : ''}>
                        {lote.dias_aberto ?? 0}
                      </span>
                    </TableCell>
                    <TableCell>{lote.quantidade_acasalamentos ?? 0}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/lotes-fiv/${lote.id}`)}
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
