import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
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
  Syringe,
  Search,
  Eye,
  TrendingUp,
  MapPin,
} from 'lucide-react';

interface Protocolo {
  id: string;
  codigo: string;
  status: string;
  data_inicio: string;
  fazenda?: { nome: string };
}

interface ResumoData {
  totalFazendas: number;
  totalDoses: number;
  totalEmbrioes: number;
  protocolosAtivos: number;
}

export default function Portal() {
  const { toast } = useToast();
  const { permissions } = useAuth();
  const [loading, setLoading] = useState(true);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [clienteNome, setClienteNome] = useState<string>('');

  // Data states
  const [resumo, setResumo] = useState<ResumoData>({
    totalFazendas: 0,
    totalDoses: 0,
    totalEmbrioes: 0,
    protocolosAtivos: 0,
  });
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [doses, setDoses] = useState<DoseSemenComTouro[]>([]);
  const [embrioes, setEmbrioes] = useState<EmbriaoComRelacionamentos[]>([]);
  const [protocolos, setProtocolos] = useState<Protocolo[]>([]);

  // Filter states
  const [searchDoses, setSearchDoses] = useState('');
  const [searchEmbrioes, setSearchEmbrioes] = useState('');
  const [filtroClassificacao, setFiltroClassificacao] = useState('todos');

  // Check if user is a client type
  const isCliente = permissions?.isCliente;
  const userClienteId = permissions?.profile?.cliente_id;

  useEffect(() => {
    if (userClienteId) {
      setClienteId(userClienteId);
      loadData(userClienteId);
    } else if (permissions && !isCliente) {
      // Not a client user - show message
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
      setFazendas(fazendasData || []);

      // Load doses
      const { data: dosesData, error: dosesError } = await supabase
        .from('doses_semen')
        .select(`
          *,
          touro:touros(id, nome, registro, raca)
        `)
        .eq('cliente_id', cId)
        .order('created_at', { ascending: false });

      if (dosesError) throw dosesError;
      setDoses(dosesData || []);

      // Load embriões congelados
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
              doadora:doadoras(id, registro, nome)
            )
          )
        `)
        .eq('cliente_id', cId)
        .eq('status_atual', 'CONGELADO')
        .order('data_congelamento', { ascending: false });

      if (embrioesError) throw embrioesError;
      setEmbrioes(embrioesData || []);

      // Load protocolos ativos
      const { data: protocolosData, error: protocolosError } = await supabase
        .from('protocolos')
        .select(`
          id,
          codigo,
          status,
          data_inicio,
          fazenda:fazendas!inner(nome, cliente_id)
        `)
        .eq('fazenda.cliente_id', cId)
        .in('status', ['ATIVO', 'EM_ANDAMENTO', 'AGUARDANDO_TE'])
        .order('data_inicio', { ascending: false })
        .limit(10);

      if (protocolosError) throw protocolosError;
      setProtocolos(protocolosData || []);

      // Calculate resumo
      const totalDoses = (dosesData || []).reduce((sum, d) => sum + (d.quantidade || 0), 0);

      setResumo({
        totalFazendas: (fazendasData || []).length,
        totalDoses,
        totalEmbrioes: (embrioesData || []).length,
        protocolosAtivos: (protocolosData || []).length,
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

  // Filtered data
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

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      'ATIVO': { label: 'Ativo', className: 'bg-green-100 text-green-800' },
      'EM_ANDAMENTO': { label: 'Em Andamento', className: 'bg-blue-100 text-blue-800' },
      'AGUARDANDO_TE': { label: 'Aguardando TE', className: 'bg-yellow-100 text-yellow-800' },
    };
    const config = statusConfig[status] || { label: status, className: 'bg-gray-100 text-gray-800' };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  if (!isCliente || !userClienteId) {
    return (
      <div className="space-y-6">
        <EmptyState
          title="Acesso restrito"
          description="Esta área é exclusiva para usuários do tipo Cliente."
        />
      </div>
    );
  }

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Olá, {clienteNome}</h1>
        <p className="text-slate-500">Bem-vindo ao seu portal</p>
      </div>

      <Tabs defaultValue="resumo" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="resumo">
            <TrendingUp className="w-4 h-4 mr-2" />
            Resumo
          </TabsTrigger>
          <TabsTrigger value="fazendas">
            <Home className="w-4 h-4 mr-2" />
            Fazendas
          </TabsTrigger>
          <TabsTrigger value="doses">
            <Dna className="w-4 h-4 mr-2" />
            Doses
          </TabsTrigger>
          <TabsTrigger value="embrioes">
            <Snowflake className="w-4 h-4 mr-2" />
            Embriões
          </TabsTrigger>
          <TabsTrigger value="protocolos">
            <Syringe className="w-4 h-4 mr-2" />
            Protocolos
          </TabsTrigger>
        </TabsList>

        {/* Aba Resumo */}
        <TabsContent value="resumo">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Home className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Fazendas</p>
                    <p className="text-3xl font-bold">{resumo.totalFazendas}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Dna className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Doses de Sêmen</p>
                    <p className="text-3xl font-bold">{resumo.totalDoses}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-100 rounded-lg">
                    <Snowflake className="w-6 h-6 text-cyan-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Embriões Congelados</p>
                    <p className="text-3xl font-bold">{resumo.totalEmbrioes}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Syringe className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Protocolos Ativos</p>
                    <p className="text-3xl font-bold">{resumo.protocolosAtivos}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick stats by classification */}
          {embrioes.length > 0 && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-lg">Embriões por Classificação</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {classificacoes.map(classificacao => {
                    const count = embrioes.filter(e => e.classificacao === classificacao).length;
                    return (
                      <div key={classificacao} className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg">
                        <Badge variant="secondary">{classificacao}</Badge>
                        <span className="font-semibold">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Aba Fazendas */}
        <TabsContent value="fazendas">
          <Card>
            <CardHeader>
              <CardTitle>Minhas Fazendas ({fazendas.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {fazendas.length === 0 ? (
                <EmptyState
                  title="Nenhuma fazenda"
                  description="Você ainda não possui fazendas cadastradas"
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {fazendas.map((fazenda) => (
                    <Card key={fazenda.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-lg">{fazenda.nome}</h3>
                            {fazenda.sigla && (
                              <Badge variant="outline" className="mt-1">{fazenda.sigla}</Badge>
                            )}
                          </div>
                          <Home className="w-5 h-5 text-slate-400" />
                        </div>
                        {fazenda.localizacao && (
                          <p className="text-sm text-slate-500 mt-2 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {fazenda.localizacao}
                          </p>
                        )}
                        {fazenda.responsavel && (
                          <p className="text-sm text-slate-500 mt-1">
                            Responsável: {fazenda.responsavel}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba Doses */}
        <TabsContent value="doses">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row gap-4 justify-between">
                <CardTitle>Estoque de Doses de Sêmen</CardTitle>
                <div className="relative max-w-xs">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Buscar touro..."
                    value={searchDoses}
                    onChange={(e) => setSearchDoses(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredDoses.length === 0 ? (
                <EmptyState
                  title="Nenhuma dose encontrada"
                  description={searchDoses ? "Tente ajustar a busca" : "Você não possui doses de sêmen em estoque"}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Touro</TableHead>
                      <TableHead>Raça</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-center">Quantidade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDoses.map((dose) => (
                      <TableRow key={dose.id}>
                        <TableCell className="font-medium">
                          {dose.touro?.nome || 'Touro desconhecido'}
                          {dose.touro?.registro && (
                            <span className="text-slate-500 ml-2">({dose.touro.registro})</span>
                          )}
                        </TableCell>
                        <TableCell>{dose.touro?.raca || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={dose.tipo_semen === 'SEXADO' ? 'default' : 'secondary'}>
                            {dose.tipo_semen || 'CONVENCIONAL'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {dose.quantidade ?? 0}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba Embriões */}
        <TabsContent value="embrioes">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row gap-4 justify-between">
                <CardTitle>Embriões Congelados ({filteredEmbrioes.length})</CardTitle>
                <div className="flex gap-2">
                  <div className="relative max-w-xs">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Buscar..."
                      value={searchEmbrioes}
                      onChange={(e) => setSearchEmbrioes(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  <Select value={filtroClassificacao} onValueChange={setFiltroClassificacao}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Classificação" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todas</SelectItem>
                      {classificacoes.map((c) => (
                        <SelectItem key={c} value={c!}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredEmbrioes.length === 0 ? (
                <EmptyState
                  title="Nenhum embrião encontrado"
                  description={searchEmbrioes || filtroClassificacao !== 'todos'
                    ? "Tente ajustar os filtros"
                    : "Você não possui embriões congelados"
                  }
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Identificação</TableHead>
                      <TableHead>Classificação</TableHead>
                      <TableHead>Doadora</TableHead>
                      <TableHead>Touro</TableHead>
                      <TableHead>Data Cong.</TableHead>
                      <TableHead>Localização</TableHead>
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
                            {embriao.classificacao ? (
                              <Badge variant="secondary">{embriao.classificacao}</Badge>
                            ) : '-'}
                          </TableCell>
                          <TableCell>{doadora?.registro || doadora?.nome || '-'}</TableCell>
                          <TableCell>
                            {touro?.nome || '-'}
                            {touro?.registro && (
                              <span className="text-slate-500 text-xs ml-1">({touro.registro})</span>
                            )}
                          </TableCell>
                          <TableCell>{formatDate(embriao.data_congelamento)}</TableCell>
                          <TableCell>{embriao.localizacao_atual || '-'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba Protocolos */}
        <TabsContent value="protocolos">
          <Card>
            <CardHeader>
              <CardTitle>Protocolos Ativos</CardTitle>
            </CardHeader>
            <CardContent>
              {protocolos.length === 0 ? (
                <EmptyState
                  title="Nenhum protocolo ativo"
                  description="Você não possui protocolos em andamento"
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Fazenda</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data Início</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {protocolos.map((protocolo) => (
                      <TableRow key={protocolo.id}>
                        <TableCell className="font-medium">{protocolo.codigo}</TableCell>
                        <TableCell>{protocolo.fazenda?.nome || '-'}</TableCell>
                        <TableCell>{getStatusBadge(protocolo.status)}</TableCell>
                        <TableCell>{formatDate(protocolo.data_inicio)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
