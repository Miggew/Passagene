import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { ProtocoloSincronizacao, Fazenda } from '@/lib/types';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/utils';
import { Plus, Eye, PlayCircle, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ProtocoloWithFazenda extends ProtocoloSincronizacao {
  fazenda_nome: string;
  receptoras_count: number;
}

interface ProtocoloFechadoComFazenda extends ProtocoloSincronizacao {
  fazenda_nome: string;
  receptoras_count: number;
}

export default function Protocolos() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [protocolosPasso2, setProtocolosPasso2] = useState<ProtocoloWithFazenda[]>([]);
  const [protocolosHistorico, setProtocolosHistorico] = useState<ProtocoloFechadoComFazenda[]>([]);
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [fazendaFilterPasso2, setFazendaFilterPasso2] = useState('');
  const [fazendaFilterHistorico, setFazendaFilterHistorico] = useState('');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [historicoPage, setHistoricoPage] = useState(1);
  const [historicoTotalCount, setHistoricoTotalCount] = useState(0);
  const HISTORICO_PAGE_SIZE = 50;
  const [showPasso2Dialog, setShowPasso2Dialog] = useState(false);
  const [selectedProtocoloId, setSelectedProtocoloId] = useState<string | null>(null);
  const [passo2Form, setPasso2Form] = useState({
    data: new Date().toISOString().split('T')[0],
    tecnico: '',
  });
  const [submittingPasso2, setSubmittingPasso2] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadFazendas(),
        loadProtocolosPasso2(),
      ]);
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

  const loadProtocolosHistorico = async (pageOverride?: number) => {
    // Validar filtros obrigatórios
    if (!fazendaFilterHistorico || fazendaFilterHistorico === 'all' || !filtroDataInicio || !filtroDataFim) {
      toast({
        title: 'Filtros obrigatórios',
        description: 'Fazenda, data inicial e data final são obrigatórios para buscar no histórico',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoadingHistorico(true);

      // Usar page override se fornecido (para quando mudar página), senão usar estado atual
      const currentPage = pageOverride !== undefined ? pageOverride : historicoPage;
      
      // Query otimizada: buscar protocolos com paginação e filtro por fazenda + data
      // Buscar um pouco mais para compensar filtros de zumbis (sem receptoras)
      const from = (currentPage - 1) * HISTORICO_PAGE_SIZE;
      const to = from + (HISTORICO_PAGE_SIZE * 2) - 1; // Buscar mais para compensar filtros

      let query = supabase
        .from('protocolos_sincronizacao')
        .select('*', { count: 'exact' })
        .eq('fazenda_id', fazendaFilterHistorico)
        .gte('data_inicio', filtroDataInicio)
        .lte('data_inicio', filtroDataFim)
        .order('data_inicio', { ascending: false })
        .range(from, to);

      const { data: protocolos, error, count } = await query;

      if (error) throw error;

      // Buscar fazenda nome uma vez
      const { data: fazendaData } = await supabase
        .from('fazendas')
        .select('nome')
        .eq('id', fazendaFilterHistorico)
        .single();

      const fazendaNome = fazendaData?.nome || 'N/A';

      // Processar protocolos: contar receptoras e filtrar zumbis
      const protocolosComContagem = await Promise.all(
        (protocolos || []).map(async (protocolo) => {
          // Verificar se protocolo tem receptoras (filtrar zumbis)
          const { count: receptorasCount, error: countError } = await supabase
            .from('protocolo_receptoras')
            .select('*', { count: 'exact', head: true })
            .eq('protocolo_id', protocolo.id);

          if (countError) {
            console.error('Erro ao contar receptoras:', countError);
            return null;
          }

          // Se não tem receptoras, pular (é zumbi)
          if (!receptorasCount || receptorasCount === 0) {
            return null;
          }

          return {
            ...protocolo,
            fazenda_nome: fazendaNome,
            receptoras_count: receptorasCount,
          };
        })
      );

      // Filtrar nulos (protocolos sem receptoras) e limitar ao tamanho da página
      const protocolosValidos = protocolosComContagem
        .filter((p): p is ProtocoloFechadoComFazenda => p !== null)
        .slice(0, HISTORICO_PAGE_SIZE);

      setProtocolosHistorico(protocolosValidos);
      setHistoricoTotalCount(count || 0);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
      toast({
        title: 'Erro ao carregar histórico',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
      setProtocolosHistorico([]);
    } finally {
      setLoadingHistorico(false);
    }
  };

  const loadFazendas = async () => {
    const { data, error } = await supabase
      .from('fazendas')
      .select('*')
      .order('nome', { ascending: true });

    if (error) throw error;
    setFazendas(data || []);
  };


  const loadProtocolosPasso2 = async () => {
    try {
      // Load protocols with status PASSO1_FECHADO or PRIMEIRO_PASSO_FECHADO (waiting for 2nd step)
      const { data: protocolos, error: protocolosError } = await supabase
        .from('protocolos_sincronizacao')
        .select('*')
        .in('status', ['PASSO1_FECHADO', 'PRIMEIRO_PASSO_FECHADO'])
        .order('data_inicio', { ascending: false });

      if (protocolosError) throw protocolosError;

      const protocolosWithDetails: ProtocoloWithFazenda[] = [];

      for (const protocolo of protocolos || []) {
        // Get fazenda name
        const { data: fazendaData } = await supabase
          .from('fazendas')
          .select('nome')
          .eq('id', protocolo.fazenda_id)
          .single();

        // Count receptoras with status INICIADA (EM SINCRONIZAÇÃO)
        const { count } = await supabase
          .from('protocolo_receptoras')
          .select('*', { count: 'exact', head: true })
          .eq('protocolo_id', protocolo.id)
          .eq('status', 'INICIADA');

        protocolosWithDetails.push({
          ...protocolo,
          fazenda_nome: fazendaData?.nome || 'N/A',
          receptoras_count: count || 0,
        });
      }

      setProtocolosPasso2(protocolosWithDetails);
    } catch (error) {
      console.error('Error loading protocolos passo 2:', error);
    }
  };

  const filteredProtocolosPasso2 = fazendaFilterPasso2 && fazendaFilterPasso2 !== 'all'
    ? protocolosPasso2.filter((p) => p.fazenda_id === fazendaFilterPasso2)
    : protocolosPasso2;

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Protocolos de Sincronização</h1>
          <p className="text-slate-600 mt-1">Gerenciar protocolos em 2 passos</p>
        </div>
        <Button
          onClick={() => navigate('/protocolos/novo')}
          className="bg-green-600 hover:bg-green-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Protocolo (1º Passo)
        </Button>
      </div>

      <Tabs defaultValue="aguardando" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="aguardando">
            Aguardando 2º Passo - {protocolosPasso2.length}
          </TabsTrigger>
          <TabsTrigger value="historico">
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="aguardando" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Filtrar por Fazenda</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={fazendaFilterPasso2 || 'all'} onValueChange={(value) => setFazendaFilterPasso2(value === 'all' ? '' : value)}>
                <SelectTrigger className="w-full md:w-[300px]">
                  <SelectValue placeholder="Todas as fazendas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as fazendas</SelectItem>
                  {fazendas.map((fazenda) => (
                    <SelectItem key={fazenda.id} value={fazenda.id}>
                      {fazenda.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Protocolos Aguardando 2º Passo</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fazenda</TableHead>
                    <TableHead>Data Início</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Receptoras Pendentes</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProtocolosPasso2.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-slate-500">
                        {fazendaFilterPasso2
                          ? 'Nenhum protocolo aguardando 2º passo nesta fazenda'
                          : 'Nenhum protocolo aguardando 2º passo'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProtocolosPasso2.map((protocolo) => (
                      <TableRow key={protocolo.id}>
                        <TableCell className="font-medium">{protocolo.fazenda_nome}</TableCell>
                        <TableCell>
                          {formatDate(protocolo.data_inicio)}
                        </TableCell>
                        <TableCell>{protocolo.responsavel_inicio}</TableCell>
                        <TableCell>{protocolo.receptoras_count}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">Aguardando 2º Passo</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700"
                            onClick={() => {
                              setSelectedProtocoloId(protocolo.id);
                              setPasso2Form({
                                data: new Date().toISOString().split('T')[0],
                                tecnico: '',
                              });
                              setShowPasso2Dialog(true);
                            }}
                          >
                            <PlayCircle className="w-4 h-4 mr-2" />
                            INICIAR 2º PASSO
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Filtros de Busca (Obrigatórios)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Fazenda *</Label>
                    <Select 
                      value={fazendaFilterHistorico || 'all'} 
                      onValueChange={(value) => {
                        setFazendaFilterHistorico(value === 'all' ? '' : value);
                        setHistoricoPage(1); // Reset page ao mudar filtro
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a fazenda" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Selecione...</SelectItem>
                        {fazendas.map((fazenda) => (
                          <SelectItem key={fazenda.id} value={fazenda.id}>
                            {fazenda.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Data Início (de) *</Label>
                    <Input
                      type="date"
                      value={filtroDataInicio}
                      onChange={(e) => {
                        setFiltroDataInicio(e.target.value);
                        setHistoricoPage(1); // Reset page ao mudar filtro
                      }}
                      placeholder="Data inicial"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Data Início (até) *</Label>
                    <Input
                      type="date"
                      value={filtroDataFim}
                      onChange={(e) => {
                        setFiltroDataFim(e.target.value);
                        setHistoricoPage(1); // Reset page ao mudar filtro
                      }}
                      placeholder="Data final"
                    />
                  </div>
                </div>

                {/* Atalhos rápidos de data */}
                <div className="flex flex-wrap gap-2">
                  <Label className="w-full text-sm font-medium text-slate-700">Atalhos rápidos:</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const hoje = new Date();
                      const seteDiasAtras = new Date(hoje);
                      seteDiasAtras.setDate(hoje.getDate() - 7);
                      setFiltroDataInicio(seteDiasAtras.toISOString().split('T')[0]);
                      setFiltroDataFim(hoje.toISOString().split('T')[0]);
                      setHistoricoPage(1);
                    }}
                  >
                    Últimos 7 dias
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const hoje = new Date();
                      const trintaDiasAtras = new Date(hoje);
                      trintaDiasAtras.setDate(hoje.getDate() - 30);
                      setFiltroDataInicio(trintaDiasAtras.toISOString().split('T')[0]);
                      setFiltroDataFim(hoje.toISOString().split('T')[0]);
                      setHistoricoPage(1);
                    }}
                  >
                    Últimos 30 dias
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const hoje = new Date();
                      const noventaDiasAtras = new Date(hoje);
                      noventaDiasAtras.setDate(hoje.getDate() - 90);
                      setFiltroDataInicio(noventaDiasAtras.toISOString().split('T')[0]);
                      setFiltroDataFim(hoje.toISOString().split('T')[0]);
                      setHistoricoPage(1);
                    }}
                  >
                    Últimos 90 dias
                  </Button>
                </div>
              </div>

              <Button
                onClick={() => {
                  setHistoricoPage(1); // Resetar página ao buscar
                  loadProtocolosHistorico();
                }}
                className="w-full md:w-auto"
                disabled={loadingHistorico || !fazendaFilterHistorico || fazendaFilterHistorico === 'all' || !filtroDataInicio || !filtroDataFim}
              >
                <Search className="w-4 h-4 mr-2" />
                {loadingHistorico ? 'Buscando...' : 'Buscar Protocolos'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Histórico de Protocolos ({protocolosHistorico.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingHistorico ? (
                <div className="py-8">
                  <LoadingSpinner />
                </div>
              ) : protocolosHistorico.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <p className="text-lg">Nenhum protocolo encontrado</p>
                  <p className="text-sm mt-2">Preencha os filtros obrigatórios e clique em "Buscar Protocolos"</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fazenda</TableHead>
                      <TableHead>Data Início</TableHead>
                      <TableHead>Data 2º Passo</TableHead>
                      <TableHead>Técnico 2º Passo</TableHead>
                      <TableHead>Receptoras</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {protocolosHistorico.map((protocolo) => (
                      <TableRow key={protocolo.id}>
                        <TableCell className="font-medium">{protocolo.fazenda_nome}</TableCell>
                        <TableCell>{formatDate(protocolo.data_inicio)}</TableCell>
                        <TableCell>{protocolo.passo2_data ? formatDate(protocolo.passo2_data) : '-'}</TableCell>
                        <TableCell>{protocolo.passo2_tecnico_responsavel || '-'}</TableCell>
                        <TableCell>{protocolo.receptoras_count}</TableCell>
                        <TableCell>
                          <Badge variant={protocolo.status === 'PASSO2_FECHADO' ? 'secondary' : 'default'}>
                            {protocolo.status === 'PASSO2_FECHADO' ? 'Fechado' : protocolo.status || 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {protocolo.status === 'PASSO2_FECHADO' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/protocolos/fechados/${protocolo.id}/relatorio`)}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              Ver Relatório
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (protocolo.status === 'PASSO1_FECHADO' || protocolo.status === 'PRIMEIRO_PASSO_FECHADO') {
                                  // Pode iniciar passo 2
                                  setSelectedProtocoloId(protocolo.id);
                                  setPasso2Form({
                                    data: new Date().toISOString().split('T')[0],
                                    tecnico: '',
                                  });
                                  setShowPasso2Dialog(true);
                                } else {
                                  navigate(`/protocolos/${protocolo.id}`);
                                }
                              }}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              Ver Detalhes
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {/* Paginação */}
              {protocolosHistorico.length > 0 && (
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="text-sm text-slate-600">
                    Página {historicoPage} - Mostrando {protocolosHistorico.length} protocolos
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const newPage = Math.max(1, historicoPage - 1);
                        setHistoricoPage(newPage);
                        // Passar a nova página diretamente para evitar problemas de sincronização
                        await loadProtocolosHistorico(newPage);
                      }}
                      disabled={historicoPage === 1 || loadingHistorico}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const newPage = historicoPage + 1;
                        setHistoricoPage(newPage);
                        // Passar a nova página diretamente para evitar problemas de sincronização
                        await loadProtocolosHistorico(newPage);
                      }}
                      disabled={protocolosHistorico.length < HISTORICO_PAGE_SIZE || loadingHistorico}
                    >
                      Próxima
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog para iniciar 2º passo */}
      <Dialog open={showPasso2Dialog} onOpenChange={setShowPasso2Dialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Iniciar 2º Passo</DialogTitle>
            <DialogDescription>
              Informe a data de realização do 2º passo e o técnico responsável
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="passo2_data">Data de Realização do 2º Passo *</Label>
              <Input
                id="passo2_data"
                type="date"
                value={passo2Form.data}
                onChange={(e) => setPasso2Form({ ...passo2Form, data: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="passo2_tecnico">Técnico Responsável *</Label>
              <Input
                id="passo2_tecnico"
                value={passo2Form.tecnico}
                onChange={(e) => setPasso2Form({ ...passo2Form, tecnico: e.target.value })}
                placeholder="Nome do técnico responsável"
                required
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={async () => {
                  if (!passo2Form.data || !passo2Form.tecnico.trim()) {
                    toast({
                      title: 'Erro de validação',
                      description: 'Data e técnico são obrigatórios',
                      variant: 'destructive',
                    });
                    return;
                  }

                  try {
                    setSubmittingPasso2(true);

                    // Salvar dados do passo 2 no protocolo
                    const { error } = await supabase
                      .from('protocolos_sincronizacao')
                      .update({
                        passo2_data: passo2Form.data,
                        passo2_tecnico_responsavel: passo2Form.tecnico.trim(),
                      })
                      .eq('id', selectedProtocoloId);

                    if (error) throw error;

                    toast({
                      title: '2º passo iniciado',
                      description: 'Dados do 2º passo registrados com sucesso',
                    });

                    setShowPasso2Dialog(false);
                    // Navegar para a tela do passo 2
                    navigate(`/protocolos/${selectedProtocoloId}/passo2`);
                  } catch (error) {
                    toast({
                      title: 'Erro ao iniciar 2º passo',
                      description: error instanceof Error ? error.message : 'Erro desconhecido',
                      variant: 'destructive',
                    });
                  } finally {
                    setSubmittingPasso2(false);
                  }
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                disabled={submittingPasso2}
              >
                {submittingPasso2 ? 'Salvando...' : 'Confirmar e Iniciar'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowPasso2Dialog(false)}
                disabled={submittingPasso2}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}