import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatStatusLabel } from '@/lib/statusLabels';
import type { Fazenda, DoseSemenComTouro, EmbriaoComRelacionamentos } from '@/lib/types';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import { useToast } from '@/hooks/use-toast';
import {
  Home,
  Dna,
  Snowflake,
  Search,
  MapPin,
  User,
  Phone,
  ArrowLeft,
  Beef,
  FlaskConical,
  Syringe,
  Calendar,
  Container,
  ChevronRight,
  Baby,
  Stethoscope,
  Repeat2,
  GitBranch,
  ChevronDown,
} from 'lucide-react';

interface ReceptoraInfo {
  id: string;
  identificacao: string;
  nome?: string;
  status_reprodutivo?: string;
  data_provavel_parto?: string;
}

interface DoadoraInfo {
  id: string;
  registro?: string;
  nome?: string;
  raca?: string;
  fazenda_id?: string;
  fazenda_nome?: string;
}

interface ResumoData {
  totalFazendas: number;
  totalReceptoras: number;
  totalEmServico: number;
  totalPrenhes: number;
}

interface PipelineItem {
  status: string;
  statusLabel: string;
  total: number;
  proximoServico: string;
  proximoServicoLabel: string;
  cor: string;
  receptoras: ReceptoraInfo[];
}

interface FazendaDetalhada extends Fazenda {
  receptoras: ReceptoraInfo[];
  receptorasPorStatus: Array<{ status: string; total: number }>;
  pipeline: PipelineItem[];
}

export default function Portal() {
  const { toast } = useToast();
  const { permissions } = useAuth();
  const [loading, setLoading] = useState(true);
  const [clienteNome, setClienteNome] = useState<string>('');

  // Data states
  const [resumo, setResumo] = useState<ResumoData>({
    totalFazendas: 0,
    totalReceptoras: 0,
    totalEmServico: 0,
    totalPrenhes: 0,
  });
  const [fazendas, setFazendas] = useState<FazendaDetalhada[]>([]);
  const [doses, setDoses] = useState<DoseSemenComTouro[]>([]);
  const [embrioes, setEmbrioes] = useState<EmbriaoComRelacionamentos[]>([]);
  const [doadoras, setDoadoras] = useState<DoadoraInfo[]>([]);

  // View states
  const [selectedFazenda, setSelectedFazenda] = useState<FazendaDetalhada | null>(null);
  const [fazendaTab, setFazendaTab] = useState('resumo');

  // Filter states
  const [searchDoses, setSearchDoses] = useState('');
  const [searchEmbrioes, setSearchEmbrioes] = useState('');
  const [filtroClassificacao, setFiltroClassificacao] = useState('todos');

  // Check if user is a client type
  const isCliente = permissions?.isCliente;
  const userClienteId = permissions?.profile?.cliente_id;

  useEffect(() => {
    if (userClienteId) {
      loadData(userClienteId);
    } else if (permissions && !isCliente) {
      setLoading(false);
    }
  }, [userClienteId, permissions, isCliente]);

  const loadData = async (cId: string) => {
    try {
      setLoading(true);

      // Load cliente info
      const { data: clienteData } = await supabase
        .from('clientes')
        .select('nome')
        .eq('id', cId)
        .single();

      if (clienteData) {
        setClienteNome(clienteData.nome);
      }

      // Load fazendas
      const { data: fazendasData, error: fazendasError } = await supabase
        .from('fazendas')
        .select('*')
        .eq('cliente_id', cId)
        .order('nome');

      if (fazendasError) throw fazendasError;

      const fazendaIds = fazendasData?.map(f => f.id) || [];

      // Buscar todas as receptoras do cliente de uma vez usando a view
      const { data: receptorasViewData } = await supabase
        .from('vw_receptoras_fazenda_atual')
        .select('receptora_id, fazenda_id_atual')
        .eq('cliente_id', cId);

      // Buscar dados completos das receptoras
      const receptoraIds = receptorasViewData?.map(r => r.receptora_id) || [];
      let allReceptoras: ReceptoraInfo[] = [];

      if (receptoraIds.length > 0) {
        const { data: receptorasData } = await supabase
          .from('receptoras')
          .select('id, identificacao, nome, status_reprodutivo, data_provavel_parto')
          .in('id', receptoraIds);

        allReceptoras = receptorasData || [];
      }

      // Mapear receptoras por fazenda
      const receptorasPorFazenda = new Map<string, ReceptoraInfo[]>();
      receptorasViewData?.forEach(rv => {
        const receptora = allReceptoras.find(r => r.id === rv.receptora_id);
        if (receptora) {
          const current = receptorasPorFazenda.get(rv.fazenda_id_atual) || [];
          current.push(receptora);
          receptorasPorFazenda.set(rv.fazenda_id_atual, current);
        }
      });

      // Configuração do pipeline - define ordem e próximo serviço
      const pipelineConfig: Record<string, { label: string; proximo: string; proximoLabel: string; cor: string }> = {
        'EM_SINCRONIZACAO': { label: 'Em Sincronização', proximo: '2_PASSO', proximoLabel: '2º Passo', cor: 'bg-yellow-500' },
        'SINCRONIZADA': { label: 'Sincronizada', proximo: 'TE', proximoLabel: 'Transferência', cor: 'bg-blue-500' },
        'SERVIDA': { label: 'Servida', proximo: 'DG', proximoLabel: 'Diagnóstico', cor: 'bg-purple-500' },
        'PRENHE': { label: 'Prenhe', proximo: 'SEXAGEM', proximoLabel: 'Sexagem', cor: 'bg-pink-500' },
        'PRENHE_RETOQUE': { label: 'Prenhe (retoque)', proximo: 'SEXAGEM', proximoLabel: 'Sexagem', cor: 'bg-pink-400' },
        'PRENHE_FEMEA': { label: 'Prenhe de Fêmea', proximo: 'PARTO', proximoLabel: 'Parto', cor: 'bg-green-500' },
        'PRENHE_MACHO': { label: 'Prenhe de Macho', proximo: 'PARTO', proximoLabel: 'Parto', cor: 'bg-green-500' },
        'PRENHE_SEM_SEXO': { label: 'Prenhe (sem sexo)', proximo: 'PARTO', proximoLabel: 'Parto', cor: 'bg-green-400' },
        'PRENHE_2_SEXOS': { label: 'Prenhe de Gêmeos', proximo: 'PARTO', proximoLabel: 'Parto', cor: 'bg-primary' },
      };

      // Ordem desejada do pipeline (do início ao fim)
      const pipelineOrder = [
        'EM_SINCRONIZACAO',
        'SINCRONIZADA',
        'SERVIDA',
        'PRENHE',
        'PRENHE_RETOQUE',
        'PRENHE_FEMEA',
        'PRENHE_MACHO',
        'PRENHE_SEM_SEXO',
        'PRENHE_2_SEXOS',
      ];

      // Montar fazendas com detalhes
      const fazendasComDetalhes: FazendaDetalhada[] = [];
      let totalReceptoras = 0;

      for (const fazenda of (fazendasData || [])) {
        const receptoras = receptorasPorFazenda.get(fazenda.id) || [];
        totalReceptoras += receptoras.length;

        const statusMap = new Map<string, number>();
        const receptorasPorStatusMap = new Map<string, ReceptoraInfo[]>();

        receptoras.forEach(r => {
          const status = r.status_reprodutivo || 'VAZIA';
          statusMap.set(status, (statusMap.get(status) || 0) + 1);

          const current = receptorasPorStatusMap.get(status) || [];
          current.push(r);
          receptorasPorStatusMap.set(status, current);
        });

        const receptorasPorStatus = Array.from(statusMap.entries())
          .map(([status, total]) => ({ status, total }))
          .sort((a, b) => b.total - a.total);

        // Construir pipeline apenas com status que tem próximo serviço
        const pipeline: PipelineItem[] = [];
        for (const status of pipelineOrder) {
          const config = pipelineConfig[status];
          const receptorasDoStatus = receptorasPorStatusMap.get(status) || [];
          if (receptorasDoStatus.length > 0 && config) {
            pipeline.push({
              status,
              statusLabel: config.label,
              total: receptorasDoStatus.length,
              proximoServico: config.proximo,
              proximoServicoLabel: config.proximoLabel,
              cor: config.cor,
              receptoras: receptorasDoStatus,
            });
          }
        }

        fazendasComDetalhes.push({
          ...fazenda,
          receptoras,
          receptorasPorStatus,
          pipeline,
        });
      }

      setFazendas(fazendasComDetalhes);

      // Load doadoras das fazendas do cliente
      let doadorasData: DoadoraInfo[] = [];
      if (fazendaIds.length > 0) {
        const { data: doadorasResult } = await supabase
          .from('doadoras')
          .select('id, registro, nome, raca, fazenda_id, fazenda:fazendas(nome)')
          .in('fazenda_id', fazendaIds)
          .order('registro');

        doadorasData = (doadorasResult || []).map((d: any) => ({
          id: d.id,
          registro: d.registro,
          nome: d.nome,
          raca: d.raca,
          fazenda_id: d.fazenda_id,
          fazenda_nome: d.fazenda?.nome,
        }));
      }
      setDoadoras(doadorasData);

      // Load doses
      const { data: dosesData } = await supabase
        .from('doses_semen')
        .select(`*, touro:touros(id, nome, registro, raca)`)
        .eq('cliente_id', cId)
        .order('created_at', { ascending: false });

      setDoses(dosesData || []);

      // Load embrioes congelados
      const { data: embrioesData } = await supabase
        .from('embrioes')
        .select(`
          *,
          lote_fiv:lotes_fiv(id, data_abertura),
          acasalamento:lote_fiv_acasalamentos(
            id,
            dose_semen:doses_semen(id, touro:touros(id, nome, registro, raca)),
            aspiracao:aspiracoes_doadoras(id, data_aspiracao, doadora:doadoras(id, registro, nome))
          )
        `)
        .eq('cliente_id', cId)
        .eq('status_atual', 'CONGELADO')
        .order('data_congelamento', { ascending: false });

      setEmbrioes(embrioesData || []);

      // Contar receptoras em serviço e prenhes
      let totalEmServico = 0;
      let totalPrenhes = 0;
      fazendasComDetalhes.forEach(f => {
        f.pipeline.forEach(p => {
          totalEmServico += p.total;
          if (p.status.includes('PRENHE')) {
            totalPrenhes += p.total;
          }
        });
      });

      setResumo({
        totalFazendas: (fazendasData || []).length,
        totalReceptoras,
        totalEmServico,
        totalPrenhes,
      });

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

  // Filtered data for Botijão
  const filteredDoses = doses.filter((dose) => {
    const touro = dose.touro;
    return !searchDoses ||
      touro?.nome?.toLowerCase().includes(searchDoses.toLowerCase()) ||
      touro?.registro?.toLowerCase().includes(searchDoses.toLowerCase()) ||
      touro?.raca?.toLowerCase().includes(searchDoses.toLowerCase());
  });

  const classificacoes = [...new Set(embrioes.map(e => e.classificacao).filter(Boolean))].sort();

  const filteredEmbrioes = embrioes.filter((embriao) => {
    const acasalamento = embriao.acasalamento as any;
    const doadora = acasalamento?.aspiracao?.doadora;
    const touro = acasalamento?.dose_semen?.touro;

    const matchesSearch = !searchEmbrioes ||
      embriao.identificacao?.toLowerCase().includes(searchEmbrioes.toLowerCase()) ||
      doadora?.registro?.toLowerCase().includes(searchEmbrioes.toLowerCase()) ||
      touro?.nome?.toLowerCase().includes(searchEmbrioes.toLowerCase());

    const matchesClassificacao = filtroClassificacao === 'todos' ||
      embriao.classificacao === filtroClassificacao;

    return matchesSearch && matchesClassificacao;
  });

  // Doadoras filtradas por fazenda selecionada
  const doadorasDaFazenda = selectedFazenda
    ? doadoras.filter(d => d.fazenda_id === selectedFazenda.id)
    : [];

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  const handleSelectFazenda = (fazenda: FazendaDetalhada) => {
    setSelectedFazenda(fazenda);
    setFazendaTab('resumo');
  };

  const handleChangeFazenda = (fazendaId: string) => {
    const fazenda = fazendas.find(f => f.id === fazendaId);
    if (fazenda) {
      setSelectedFazenda(fazenda);
    }
  };

  if (!isCliente || !userClienteId) {
    return (
      <div className="space-y-6">
        <EmptyState
          title="Acesso restrito"
          description="Esta area e exclusiva para usuarios do tipo Cliente."
        />
      </div>
    );
  }

  if (loading) {
    return <LoadingSpinner />;
  }

  // ========================================
  // VISUALIZAÇÃO DE FAZENDA SELECIONADA
  // ========================================
  if (selectedFazenda) {
    // Contagem de prenhes e em serviço da fazenda selecionada
    const fazendaEmServico = selectedFazenda.pipeline.reduce((acc, p) => acc + p.total, 0);
    const fazendaPrenhes = selectedFazenda.pipeline
      .filter(p => p.status.includes('PRENHE'))
      .reduce((acc, p) => acc + p.total, 0);

    return (
      <div className="space-y-6">
        {/* Header com voltar + nome + seletor de fazenda */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => setSelectedFazenda(null)}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{selectedFazenda.nome}</h1>
              <p className="text-muted-foreground">
                {selectedFazenda.receptoras.length} receptoras
                {selectedFazenda.localizacao && ` • ${selectedFazenda.localizacao}`}
              </p>
            </div>
          </div>

          {/* Seletor para trocar de fazenda */}
          {fazendas.length > 1 && (
            <Select value={selectedFazenda.id} onValueChange={handleChangeFazenda}>
              <SelectTrigger className="w-[200px]">
                <div className="flex items-center gap-2">
                  <Home className="w-4 h-4" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                {fazendas.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nome} ({f.receptoras.length})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Tabs da Fazenda */}
        <Tabs value={fazendaTab} onValueChange={setFazendaTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="resumo">
              <Home className="w-4 h-4 mr-1" />
              Resumo
            </TabsTrigger>
            <TabsTrigger value="receptoras">
              <Beef className="w-4 h-4 mr-1" />
              Receptoras
            </TabsTrigger>
            <TabsTrigger value="doadoras">
              <Dna className="w-4 h-4 mr-1" />
              Doadoras
            </TabsTrigger>
            <TabsTrigger value="previsao">
              <GitBranch className="w-4 h-4 mr-1" />
              Previsao
            </TabsTrigger>
          </TabsList>

          {/* Tab Resumo */}
          <TabsContent value="resumo">
            <div className="space-y-6">
              {/* Cards de resumo da fazenda */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <Beef className="w-5 h-5 text-orange-600" />
                      <div>
                        <p className="text-xs text-muted-foreground">Receptoras</p>
                        <p className="text-2xl font-bold">{selectedFazenda.receptoras.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="text-xs text-muted-foreground">Em Servico</p>
                        <p className="text-2xl font-bold">{fazendaEmServico}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <Baby className="w-5 h-5 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">Prenhes</p>
                        <p className="text-2xl font-bold">{fazendaPrenhes}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <Dna className="w-5 h-5 text-pink-600" />
                      <div>
                        <p className="text-xs text-muted-foreground">Doadoras</p>
                        <p className="text-2xl font-bold">{doadorasDaFazenda.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Info da fazenda */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {selectedFazenda.sigla && (
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Sigla</p>
                      <p className="font-semibold text-lg">{selectedFazenda.sigla}</p>
                    </CardContent>
                  </Card>
                )}
                {selectedFazenda.localizacao && (
                  <Card>
                    <CardContent className="pt-4 flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-primary mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Localizacao</p>
                        <p className="font-medium">{selectedFazenda.localizacao}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
                {selectedFazenda.responsavel && (
                  <Card>
                    <CardContent className="pt-4 flex items-start gap-2">
                      <User className="w-4 h-4 text-blue-600 mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Responsavel</p>
                        <p className="font-medium">{selectedFazenda.responsavel}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
                {selectedFazenda.contato_responsavel && (
                  <Card>
                    <CardContent className="pt-4 flex items-start gap-2">
                      <Phone className="w-4 h-4 text-purple-600 mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Contato</p>
                        <p className="font-medium">{selectedFazenda.contato_responsavel}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Resumo por status */}
              {selectedFazenda.receptorasPorStatus.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Receptoras por Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {selectedFazenda.receptorasPorStatus.map(item => (
                        <Badge
                          key={item.status}
                          variant={item.status.includes('PRENHE') ? 'default' : 'secondary'}
                          className="text-sm py-1 px-3"
                        >
                          {formatStatusLabel(item.status)}: {item.total}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Tab Receptoras */}
          <TabsContent value="receptoras">
            <Card>
              <CardHeader>
                <CardTitle>Receptoras ({selectedFazenda.receptoras.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedFazenda.receptoras.length === 0 ? (
                  <EmptyState title="Nenhuma receptora" description="Esta fazenda nao possui receptoras" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Identificacao</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Previsao Parto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedFazenda.receptoras.map((receptora) => (
                        <TableRow key={receptora.id}>
                          <TableCell className="font-medium">{receptora.identificacao}</TableCell>
                          <TableCell>{receptora.nome || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={receptora.status_reprodutivo?.includes('PRENHE') ? 'default' : 'secondary'}>
                              {formatStatusLabel(receptora.status_reprodutivo || 'VAZIA')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {receptora.data_provavel_parto ? formatDate(receptora.data_provavel_parto) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Doadoras */}
          <TabsContent value="doadoras">
            <Card>
              <CardHeader>
                <CardTitle>Doadoras ({doadorasDaFazenda.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {doadorasDaFazenda.length === 0 ? (
                  <EmptyState title="Nenhuma doadora" description="Esta fazenda nao possui doadoras" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Registro</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Raca</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {doadorasDaFazenda.map((doadora) => (
                        <TableRow key={doadora.id}>
                          <TableCell className="font-medium">{doadora.registro || '-'}</TableCell>
                          <TableCell>{doadora.nome || '-'}</TableCell>
                          <TableCell>{doadora.raca || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Previsao (Pipeline) */}
          <TabsContent value="previsao">
            <div className="space-y-4">
              {selectedFazenda.pipeline.length === 0 ? (
                <Card>
                  <CardContent className="py-8">
                    <EmptyState
                      title="Nenhum servico pendente"
                      description="As receptoras desta fazenda estao todas vazias ou aguardando novo protocolo"
                    />
                  </CardContent>
                </Card>
              ) : (
                selectedFazenda.pipeline.map((item) => (
                  <Card key={item.status}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        {/* Status atual */}
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${item.cor}`} />
                          <div>
                            <p className="font-medium">{item.statusLabel}</p>
                            <p className="text-2xl font-bold">{item.total} receptora{item.total !== 1 ? 's' : ''}</p>
                          </div>
                        </div>

                        {/* Seta */}
                        <ChevronRight className="w-6 h-6 text-muted-foreground hidden sm:block" />

                        {/* Proximo servico */}
                        <div className="flex items-center gap-2">
                          <div className="text-right sm:text-left">
                            <p className="text-xs text-muted-foreground uppercase">Proximo</p>
                            <Badge
                              className={`text-sm ${
                                item.proximoServico === '2_PASSO' ? 'bg-yellow-100 text-yellow-800' :
                                item.proximoServico === 'TE' ? 'bg-blue-100 text-blue-800' :
                                item.proximoServico === 'DG' ? 'bg-purple-100 text-purple-800' :
                                item.proximoServico === 'SEXAGEM' ? 'bg-pink-100 text-pink-800' :
                                'bg-green-100 text-green-800'
                              }`}
                            >
                              {item.proximoServico === '2_PASSO' && <Repeat2 className="w-3 h-3 mr-1" />}
                              {item.proximoServico === 'TE' && <Syringe className="w-3 h-3 mr-1" />}
                              {item.proximoServico === 'DG' && <Stethoscope className="w-3 h-3 mr-1" />}
                              {item.proximoServico === 'SEXAGEM' && <Dna className="w-3 h-3 mr-1" />}
                              {item.proximoServico === 'PARTO' && <Baby className="w-3 h-3 mr-1" />}
                              {item.proximoServicoLabel}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* Mostrar datas de parto previstas se for status de parto */}
                      {item.proximoServico === 'PARTO' && item.receptoras.some(r => r.data_provavel_parto) && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Previsoes de Parto
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {item.receptoras
                              .filter(r => r.data_provavel_parto)
                              .sort((a, b) => new Date(a.data_provavel_parto!).getTime() - new Date(b.data_provavel_parto!).getTime())
                              .map(r => (
                                <Badge key={r.id} variant="outline" className="text-xs">
                                  {r.identificacao}: {formatDate(r.data_provavel_parto)}
                                </Badge>
                              ))
                            }
                          </div>
                        </div>
                      )}

                      {/* Lista de receptoras */}
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs text-muted-foreground mb-2">Receptoras</p>
                        <div className="flex flex-wrap gap-1">
                          {item.receptoras.slice(0, 10).map(r => (
                            <Badge key={r.id} variant="secondary" className="text-xs font-mono">
                              {r.identificacao}
                            </Badge>
                          ))}
                          {item.receptoras.length > 10 && (
                            <Badge variant="secondary" className="text-xs bg-muted">
                              +{item.receptoras.length - 10} mais
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // ========================================
  // VISUALIZAÇÃO PRINCIPAL (SEM FAZENDA SELECIONADA)
  // ========================================
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Ola, {clienteNome}</h1>
        <p className="text-muted-foreground">Bem-vindo ao seu portal</p>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Home className="w-5 h-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Fazendas</p>
                <p className="text-2xl font-bold">{resumo.totalFazendas}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Beef className="w-5 h-5 text-orange-600" />
              <div>
                <p className="text-xs text-muted-foreground">Receptoras</p>
                <p className="text-2xl font-bold">{resumo.totalReceptoras}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-xs text-muted-foreground">Em Servico</p>
                <p className="text-2xl font-bold">{resumo.totalEmServico}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Baby className="w-5 h-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Prenhes</p>
                <p className="text-2xl font-bold">{resumo.totalPrenhes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="fazendas" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="fazendas">
            <Home className="w-4 h-4 mr-1" />
            Fazendas
          </TabsTrigger>
          <TabsTrigger value="botijao">
            <Container className="w-4 h-4 mr-1" />
            Botijao
          </TabsTrigger>
        </TabsList>

        {/* Aba Fazendas - Cards clicáveis */}
        <TabsContent value="fazendas">
          {fazendas.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <EmptyState title="Nenhuma fazenda" description="Voce ainda nao possui fazendas cadastradas" />
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {fazendas.map((fazenda) => {
                const emServico = fazenda.pipeline.reduce((acc, p) => acc + p.total, 0);
                const prenhes = fazenda.pipeline
                  .filter(p => p.status.includes('PRENHE'))
                  .reduce((acc, p) => acc + p.total, 0);

                return (
                  <Card
                    key={fazenda.id}
                    className="cursor-pointer hover:shadow-md hover:border-green-300 transition-all"
                    onClick={() => handleSelectFazenda(fazenda)}
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Home className="w-5 h-5 text-primary" />
                        {fazenda.nome}
                        {fazenda.sigla && (
                          <Badge variant="outline" className="ml-auto">{fazenda.sigla}</Badge>
                        )}
                      </CardTitle>
                      {fazenda.localizacao && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {fazenda.localizacao}
                        </p>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-2xl font-bold text-orange-600">{fazenda.receptoras.length}</p>
                          <p className="text-xs text-muted-foreground">Receptoras</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-blue-600">{emServico}</p>
                          <p className="text-xs text-muted-foreground">Em Servico</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-primary">{prenhes}</p>
                          <p className="text-xs text-muted-foreground">Prenhes</p>
                        </div>
                      </div>

                      {/* Mini pipeline preview */}
                      {fazenda.pipeline.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-xs text-muted-foreground mb-2">Proximos servicos:</p>
                          <div className="flex flex-wrap gap-1">
                            {fazenda.pipeline.slice(0, 3).map(p => (
                              <Badge
                                key={p.status}
                                className={`text-xs ${
                                  p.proximoServico === '2_PASSO' ? 'bg-yellow-100 text-yellow-800' :
                                  p.proximoServico === 'TE' ? 'bg-blue-100 text-blue-800' :
                                  p.proximoServico === 'DG' ? 'bg-purple-100 text-purple-800' :
                                  p.proximoServico === 'SEXAGEM' ? 'bg-pink-100 text-pink-800' :
                                  'bg-green-100 text-green-800'
                                }`}
                              >
                                {p.proximoServicoLabel}: {p.total}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Aba Botijao - Estoque geral do cliente */}
        <TabsContent value="botijao">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <Container className="w-5 h-5" />
                Botijao - Estoque Criopreservado
              </CardTitle>
              <p className="text-sm text-muted-foreground">Embrioes congelados e doses de semen armazenados</p>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="embrioes" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="embrioes">
                    <Snowflake className="w-4 h-4 mr-1" />
                    Embrioes ({embrioes.length})
                  </TabsTrigger>
                  <TabsTrigger value="doses">
                    <FlaskConical className="w-4 h-4 mr-1" />
                    Doses ({doses.reduce((sum, d) => sum + (d.quantidade || 0), 0)})
                  </TabsTrigger>
                </TabsList>

                {/* Sub-aba Embrioes */}
                <TabsContent value="embrioes" className="mt-0">
                  <div className="flex flex-col sm:flex-row gap-4 justify-between mb-4">
                    <div className="relative max-w-xs">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar embriao..."
                        value={searchEmbrioes}
                        onChange={(e) => setSearchEmbrioes(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                    <Select value={filtroClassificacao} onValueChange={setFiltroClassificacao}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Classificacao" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todas</SelectItem>
                        {classificacoes.map((c) => (
                          <SelectItem key={c} value={c!}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {filteredEmbrioes.length === 0 ? (
                    <EmptyState
                      title="Nenhum embriao encontrado"
                      description={searchEmbrioes || filtroClassificacao !== 'todos'
                        ? "Tente ajustar os filtros"
                        : "Voce nao possui embrioes congelados"}
                    />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Identificacao</TableHead>
                          <TableHead>Classificacao</TableHead>
                          <TableHead>Doadora</TableHead>
                          <TableHead>Touro</TableHead>
                          <TableHead>Data Cong.</TableHead>
                          <TableHead>Localizacao</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredEmbrioes.map((embriao) => {
                          const acasalamento = embriao.acasalamento as any;
                          const doadora = acasalamento?.aspiracao?.doadora;
                          const touro = acasalamento?.dose_semen?.touro;

                          return (
                            <TableRow key={embriao.id}>
                              <TableCell className="font-medium font-mono text-sm">
                                {embriao.identificacao || '-'}
                              </TableCell>
                              <TableCell>
                                {embriao.classificacao ? <Badge variant="secondary">{embriao.classificacao}</Badge> : '-'}
                              </TableCell>
                              <TableCell>{doadora?.registro || doadora?.nome || '-'}</TableCell>
                              <TableCell>
                                {touro?.nome || '-'}
                                {touro?.registro && <span className="text-muted-foreground text-xs ml-1">({touro.registro})</span>}
                              </TableCell>
                              <TableCell>{formatDate(embriao.data_congelamento)}</TableCell>
                              <TableCell>{embriao.localizacao_atual || '-'}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>

                {/* Sub-aba Doses */}
                <TabsContent value="doses" className="mt-0">
                  <div className="flex flex-col sm:flex-row gap-4 justify-between mb-4">
                    <div className="relative max-w-xs">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar touro..."
                        value={searchDoses}
                        onChange={(e) => setSearchDoses(e.target.value)}
                        className="pl-8"
                      />
                    </div>
                  </div>

                  {filteredDoses.length === 0 ? (
                    <EmptyState
                      title="Nenhuma dose encontrada"
                      description={searchDoses ? "Tente ajustar a busca" : "Voce nao possui doses de semen em estoque"}
                    />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Touro</TableHead>
                          <TableHead>Raca</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead className="text-center">Quantidade</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredDoses.map((dose) => (
                          <TableRow key={dose.id}>
                            <TableCell className="font-medium">
                              {dose.touro?.nome || 'Touro desconhecido'}
                              {dose.touro?.registro && <span className="text-muted-foreground ml-2">({dose.touro.registro})</span>}
                            </TableCell>
                            <TableCell>{dose.touro?.raca || '-'}</TableCell>
                            <TableCell>
                              <Badge variant={dose.tipo_semen === 'SEXADO' ? 'default' : 'secondary'}>
                                {dose.tipo_semen || 'CONVENCIONAL'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center font-semibold">{dose.quantidade ?? 0}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
