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
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { handleError } from '@/lib/error-handler';
import { formatDate } from '@/lib/utils';
import { Plus, Eye, PlayCircle, Search, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import DatePickerBR from '@/components/shared/DatePickerBR';

interface ProtocoloWithFazenda extends ProtocoloSincronizacao {
  fazenda_nome: string;
  receptoras_count: number;
}

const PROTOCOLOS_FILTROS_KEY = 'protocolos_filtros';

type ProtocolosFiltrosPersistidos = {
  filtroStatus?: string;
  fazendaFilter?: string;
  filtroDataInicio?: string;
  filtroDataFim?: string;
  protocolosPage?: number;
};

const carregarFiltrosPersistidos = (): ProtocolosFiltrosPersistidos => {
  try {
    const raw = localStorage.getItem(PROTOCOLOS_FILTROS_KEY);
    return raw ? (JSON.parse(raw) as ProtocolosFiltrosPersistidos) : {};
  } catch {
    return {};
  }
};

export default function Protocolos() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [protocolos, setProtocolos] = useState<ProtocoloWithFazenda[]>([]);
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const filtrosPersistidos = carregarFiltrosPersistidos();
  const [fazendaFilter, setFazendaFilter] = useState(filtrosPersistidos.fazendaFilter ?? '');
  const [filtroDataInicio, setFiltroDataInicio] = useState(filtrosPersistidos.filtroDataInicio ?? '');
  const [filtroDataFim, setFiltroDataFim] = useState(filtrosPersistidos.filtroDataFim ?? '');
  const [filtroStatus, setFiltroStatus] = useState<string>(filtrosPersistidos.filtroStatus ?? 'all'); // 'all', 'aguardando_2_passo', 'sincronizado', 'fechado'
  const [loadingProtocolos, setLoadingProtocolos] = useState(false);
  const [protocolosPage, setProtocolosPage] = useState(filtrosPersistidos.protocolosPage ?? 1);
  const [protocolosTotalCount, setProtocolosTotalCount] = useState(0);
  const PROTOCOLOS_PAGE_SIZE = 50;

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const payload: ProtocolosFiltrosPersistidos = {
      filtroStatus,
      fazendaFilter,
      filtroDataInicio,
      filtroDataFim,
      protocolosPage,
    };
    localStorage.setItem(PROTOCOLOS_FILTROS_KEY, JSON.stringify(payload));
  }, [filtroStatus, fazendaFilter, filtroDataInicio, filtroDataFim, protocolosPage]);

  const loadData = async () => {
    try {
      setLoading(true);
      await loadFazendas();
      await loadProtocolos();
    } catch (error) {
      handleError(error, 'Erro ao carregar dados');
    } finally {
      setLoading(false);
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

  const loadProtocolos = async (
    pageOverride?: number,
    filters?: {
      fazenda?: string;
      dataInicio?: string;
      dataFim?: string;
      status?: string;
    }
  ) => {
    try {
      setLoadingProtocolos(true);

      // Usar filtros passados como parâmetro ou os do estado
      const fazenda = filters?.fazenda !== undefined ? filters.fazenda : fazendaFilter;
      const dataInicio = filters?.dataInicio !== undefined ? filters.dataInicio : filtroDataInicio;
      const dataFim = filters?.dataFim !== undefined ? filters.dataFim : filtroDataFim;
      const status = filters?.status !== undefined ? filters.status : filtroStatus;

      // Usar page override se fornecido, senão usar estado atual
      const currentPage = pageOverride !== undefined ? pageOverride : protocolosPage;
      
      // Query base
      const from = (currentPage - 1) * PROTOCOLOS_PAGE_SIZE;
      const to = from + (PROTOCOLOS_PAGE_SIZE * 2) - 1; // Buscar mais para compensar filtros de zumbis

      let query = supabase
        .from('protocolos_sincronizacao')
        .select('*', { count: 'exact' });

      // Aplicar filtros
      if (fazenda && fazenda !== 'all') {
        query = query.eq('fazenda_id', fazenda);
      }

      if (dataInicio) {
        query = query.gte('data_inicio', dataInicio);
      }

      if (dataFim) {
        query = query.lte('data_inicio', dataFim);
      }

      // Filtro de status
      if (status === 'aguardando_2_passo') {
        query = query.in('status', ['PASSO1_FECHADO', 'PRIMEIRO_PASSO_FECHADO']);
      } else if (status === 'sincronizado') {
        query = query.in('status', ['SINCRONIZADO', 'PASSO2_FECHADO']); // PASSO2_FECHADO é status antigo, será migrado
      } else if (status === 'fechado') {
        query = query.in('status', ['FECHADO', 'EM_TE']); // EM_TE é status antigo, será migrado
      }
      // 'all' não aplica filtro de status
      // Nota: Status 'ABERTO' e 'PASSO1_ABERTO' foram removidos - protocolos são criados já com PASSO1_FECHADO

      query = query.order('data_inicio', { ascending: false }).range(from, to);

      const { data: protocolosData, error, count } = await query;

      if (error) throw error;

      // Otimização: Buscar todos os dados de uma vez ao invés de queries individuais
      const protocolosIds = (protocolosData || []).map(p => p.id);
      const fazendaIds = [...new Set((protocolosData || []).map(p => p.fazenda_id))];

      // Buscar contagens de receptoras para todos os protocolos de uma vez
      const { data: receptorasCounts, error: countError } = await supabase
        .from('protocolo_receptoras')
        .select('protocolo_id')
        .in('protocolo_id', protocolosIds);

      if (countError) {
        console.error('Erro ao contar receptoras:', countError);
      }

      // Agrupar contagens por protocolo_id
      const contagemPorProtocolo = (receptorasCounts || []).reduce((acc, pr) => {
        acc[pr.protocolo_id] = (acc[pr.protocolo_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Buscar nomes de todas as fazendas de uma vez
      const { data: fazendasData } = await supabase
        .from('fazendas')
        .select('id, nome')
        .in('id', fazendaIds);

      // Criar mapa de fazenda_id -> nome
      const fazendasMap = (fazendasData || []).reduce((acc, fazenda) => {
        acc[fazenda.id] = fazenda.nome;
        return acc;
      }, {} as Record<string, string>);

      // Processar protocolos: filtrar zumbis e adicionar dados
      const protocolosComContagem = (protocolosData || [])
        .map((protocolo) => {
          const receptorasCount = contagemPorProtocolo[protocolo.id] || 0;

          // Se não tem receptoras, pular (é zumbi)
          if (receptorasCount === 0) {
            return null;
          }

          return {
            ...protocolo,
            fazenda_nome: fazendasMap[protocolo.fazenda_id] || 'N/A',
            receptoras_count: receptorasCount,
          };
        })
        .filter((p): p is ProtocoloWithFazenda => p !== null);

      // Limitar ao tamanho da página (já filtrado anteriormente)
      const protocolosValidos = protocolosComContagem.slice(0, PROTOCOLOS_PAGE_SIZE);

      setProtocolos(protocolosValidos);
      setProtocolosTotalCount(count || 0);
    } catch (error) {
      console.error('Erro ao carregar protocolos:', error);
      handleError(error, 'Erro ao carregar protocolos');
      setProtocolos([]);
    } finally {
      setLoadingProtocolos(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Protocolos de Sincronização"
        description="Gerenciar protocolos em 2 passos"
        actions={
          <Button
            onClick={() => navigate('/protocolos/novo')}
            className="bg-green-600 hover:bg-green-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Protocolo (1º Passo)
          </Button>
        }
      />

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Filtro Rápido de Status */}
            <div className="space-y-2">
              <Label>Filtro Rápido</Label>
              <Select 
                value={filtroStatus} 
                onValueChange={setFiltroStatus}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os protocolos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os protocolos</SelectItem>
                  <SelectItem value="aguardando_2_passo">Aguardando 2º Passo</SelectItem>
                  <SelectItem value="sincronizado">Sincronizados</SelectItem>
                  <SelectItem value="fechado">Fechados</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filtro de Fazenda */}
            <div className="space-y-2">
              <Label>Fazenda</Label>
              <Select 
                value={fazendaFilter || 'all'} 
                onValueChange={(value) => {
                  const fazendaValue = value === 'all' ? '' : value;
                  setFazendaFilter(fazendaValue);
                }}
              >
                <SelectTrigger>
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
            </div>

            {/* Filtro de Data Início */}
            <div className="space-y-2">
              <Label>Data Início (de)</Label>
              <DatePickerBR value={filtroDataInicio} onChange={setFiltroDataInicio} />
            </div>

            {/* Filtro de Data Fim */}
            <div className="space-y-2">
              <Label>Data Início (até)</Label>
              <DatePickerBR value={filtroDataFim} onChange={setFiltroDataFim} />
            </div>
          </div>

          {/* Botão de Buscar e Atalhos rápidos de data */}
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-wrap gap-2 flex-1">
              <Label className="w-full text-sm font-medium text-slate-700">Atalhos rápidos:</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const hoje = new Date();
                  const seteDiasAtras = new Date(hoje);
                  seteDiasAtras.setDate(hoje.getDate() - 7);
                  const dataInicio = seteDiasAtras.toISOString().split('T')[0];
                  const dataFim = hoje.toISOString().split('T')[0];
                  setFiltroDataInicio(dataInicio);
                  setFiltroDataFim(dataFim);
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
                  const dataInicio = trintaDiasAtras.toISOString().split('T')[0];
                  const dataFim = hoje.toISOString().split('T')[0];
                  setFiltroDataInicio(dataInicio);
                  setFiltroDataFim(dataFim);
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
                  const dataInicio = noventaDiasAtras.toISOString().split('T')[0];
                  const dataFim = hoje.toISOString().split('T')[0];
                  setFiltroDataInicio(dataInicio);
                  setFiltroDataFim(dataFim);
                }}
              >
                Últimos 90 dias
              </Button>
            </div>
            {/* Botão de Buscar */}
            <Button
              type="button"
              onClick={() => {
                setProtocolosPage(1);
                loadProtocolos(1, {
                  fazenda: fazendaFilter,
                  dataInicio: filtroDataInicio,
                  dataFim: filtroDataFim,
                  status: filtroStatus,
                });
              }}
              disabled={loadingProtocolos}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Search className="w-4 h-4 mr-2" />
              Buscar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Protocolos */}
      <Card>
        <CardHeader>
          <CardTitle>Protocolos de Sincronização ({protocolos.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingProtocolos ? (
            <div className="py-8">
              <LoadingSpinner />
            </div>
          ) : protocolos.length === 0 ? (
            <EmptyState
              title="Nenhum protocolo encontrado"
              description="Ajuste os filtros ou adicione um novo protocolo."
              action={
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFazendaFilter('');
                      setFiltroDataInicio('');
                      setFiltroDataFim('');
                      setFiltroStatus('all');
                      setProtocolosPage(1);
                      loadProtocolos(1, {
                        fazenda: '',
                        dataInicio: '',
                        dataFim: '',
                        status: 'all',
                      });
                    }}
                  >
                    Limpar filtros
                  </Button>
                  <Button
                    onClick={() => navigate('/protocolos/novo')}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Protocolo
                  </Button>
                </div>
              }
            />
          ) : (
            <>
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
                  {protocolos.map((protocolo) => {
                    const isAguardando2Passo = protocolo.status === 'PASSO1_FECHADO' || protocolo.status === 'PRIMEIRO_PASSO_FECHADO';
                    const isFechado = protocolo.status === 'FECHADO' || protocolo.status === 'EM_TE'; // EM_TE é status antigo, será migrado
                    
                    return (
                      <TableRow key={protocolo.id}>
                        <TableCell className="font-medium">{protocolo.fazenda_nome}</TableCell>
                        <TableCell>{formatDate(protocolo.data_inicio)}</TableCell>
                        <TableCell>{protocolo.passo2_data ? formatDate(protocolo.passo2_data) : '-'}</TableCell>
                        <TableCell>{protocolo.passo2_tecnico_responsavel || '-'}</TableCell>
                        <TableCell>{protocolo.receptoras_count}</TableCell>
                        <TableCell>
                          {isFechado || protocolo.status === 'FECHADO' || protocolo.status === 'EM_TE' ? (
                            <Badge variant="secondary" className="bg-slate-500 hover:bg-slate-600 text-white">Fechado</Badge>
                          ) : protocolo.status === 'SINCRONIZADO' || protocolo.status === 'PASSO2_FECHADO' ? (
                            <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white">Sincronizado</Badge>
                          ) : isAguardando2Passo ? (
                            <Badge variant="secondary" className="bg-yellow-500 hover:bg-yellow-600 text-white">Aguardando 2º Passo</Badge>
                          ) : (
                            <Badge variant="default">{protocolo.status || 'N/A'}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            {/* Botão Iniciar 2º Passo - apenas para protocolos aguardando 2º passo */}
                            {isAguardando2Passo && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => navigate(`/protocolos/${protocolo.id}/passo2`)}
                              >
                                <PlayCircle className="w-4 h-4 mr-2" />
                                Iniciar 2º Passo
                              </Button>
                            )}
                            
                            {/* Botão Ver Relatório - sempre visível */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/protocolos/${protocolo.id}/relatorio`)}
                            >
                              <FileText className="w-4 h-4 mr-2" />
                              Ver Relatório
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Paginação */}
              {protocolos.length > 0 && (
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="text-sm text-slate-600">
                    Página {protocolosPage} - Mostrando {protocolos.length} protocolos
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const newPage = Math.max(1, protocolosPage - 1);
                        setProtocolosPage(newPage);
                        await loadProtocolos(newPage);
                      }}
                      disabled={protocolosPage === 1 || loadingProtocolos}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        const newPage = protocolosPage + 1;
                        setProtocolosPage(newPage);
                        await loadProtocolos(newPage);
                      }}
                      disabled={protocolos.length < PROTOCOLOS_PAGE_SIZE || loadingProtocolos}
                    >
                      Próxima
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

    </div>
  );
}