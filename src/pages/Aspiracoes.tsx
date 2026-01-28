import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { PacoteAspiracao, Fazenda } from '@/lib/types';
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
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/utils';
import { Plus, Eye, Filter, X, Search } from 'lucide-react';
import DatePickerBR from '@/components/shared/DatePickerBR';

interface PacoteComNomes extends PacoteAspiracao {
  fazenda_nome?: string;
  fazendas_destino_nomes?: string[];
  quantidade_doadoras?: number;
}

export default function Aspiracoes() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [pacotes, setPacotes] = useState<PacoteComNomes[]>([]);
  const [pacotesFiltrados, setPacotesFiltrados] = useState<PacoteComNomes[]>([]);
  const [fazendas, setFazendas] = useState<Fazenda[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingFazendas, setLoadingFazendas] = useState(true);
  const [dadosCarregados, setDadosCarregados] = useState(false);
  const [filtroFazenda, setFiltroFazenda] = useState<string>('');
  const [filtroDataInicio, setFiltroDataInicio] = useState<string>('');
  const [filtroDataFim, setFiltroDataFim] = useState<string>('');

  useEffect(() => {
    loadFazendas();
  }, []);

  const loadFazendas = async () => {
    try {
      setLoadingFazendas(true);
      const { data: fazendasData, error: fazendasError } = await supabase
        .from('fazendas')
        .select('id, nome')
        .order('nome', { ascending: true });

      if (fazendasError) throw fazendasError;
      setFazendas(fazendasData || []);
    } catch (error) {
      toast({
        title: 'Erro ao carregar fazendas',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoadingFazendas(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);

      // Load pacotes
      const { data: pacotesData, error: pacotesError } = await supabase
        .from('pacotes_aspiracao')
        .select('*')
        .order('data_aspiracao', { ascending: false })
        .order('created_at', { ascending: false });

      if (pacotesError) throw pacotesError;

      const fazendasMap = new Map(fazendas.map((f) => [f.id, f.nome]));

      // Load quantidade de doadoras por pacote
      const pacoteIds = pacotesData?.map((p) => p.id) || [];
      const { data: aspiracoesData, error: aspiracoesError } = await supabase
        .from('aspiracoes_doadoras')
        .select('pacote_aspiracao_id')
        .in('pacote_aspiracao_id', pacoteIds);

      if (aspiracoesError) throw aspiracoesError;

      // Contar doadoras por pacote
      const quantidadePorPacote = new Map<string, number>();
      aspiracoesData?.forEach((a) => {
        if (a.pacote_aspiracao_id) {
          quantidadePorPacote.set(
            a.pacote_aspiracao_id,
            (quantidadePorPacote.get(a.pacote_aspiracao_id) || 0) + 1
          );
        }
      });

      // Load múltiplas fazendas destino
      const { data: fazendasDestinoData } = await supabase
        .from('pacotes_aspiracao_fazendas_destino')
        .select('pacote_aspiracao_id, fazenda_destino_id')
        .in('pacote_aspiracao_id', pacoteIds);

      // Agrupar fazendas destino por pacote
      const fazendasDestinoPorPacote = new Map<string, string[]>();
      fazendasDestinoData?.forEach((item) => {
        const nomes = fazendasDestinoPorPacote.get(item.pacote_aspiracao_id) || [];
        const nome = fazendasMap.get(item.fazenda_destino_id);
        if (nome && !nomes.includes(nome)) {
          nomes.push(nome);
        }
        fazendasDestinoPorPacote.set(item.pacote_aspiracao_id, nomes);
      });

      const pacotesComNomes: PacoteComNomes[] = (pacotesData || []).map((p) => {
        // Se não houver na tabela de relacionamento, usar a fazenda_destino_id legacy
        let fazendasDestinoNomes = fazendasDestinoPorPacote.get(p.id);
        if (!fazendasDestinoNomes || fazendasDestinoNomes.length === 0) {
          if (p.fazenda_destino_id) {
            const nomeLegacy = fazendasMap.get(p.fazenda_destino_id);
            fazendasDestinoNomes = nomeLegacy ? [nomeLegacy] : [];
          } else {
            fazendasDestinoNomes = [];
          }
        }

        return {
          ...p,
          fazenda_nome: fazendasMap.get(p.fazenda_id),
          fazendas_destino_nomes: fazendasDestinoNomes,
          quantidade_doadoras: quantidadePorPacote.get(p.id) || 0,
        };
      });

      setPacotes(pacotesComNomes);
      setDadosCarregados(true);
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

  const handleBuscar = () => {
    // Validar que ambas as datas foram preenchidas
    if (!filtroDataInicio || !filtroDataFim) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Por favor, preencha a data inicial e a data final para realizar a busca',
        variant: 'destructive',
      });
      return;
    }

    // Validar que data início <= data fim
    if (filtroDataInicio > filtroDataFim) {
      toast({
        title: 'Data inválida',
        description: 'A data inicial deve ser anterior ou igual à data final',
        variant: 'destructive',
      });
      return;
    }

    // Carregar dados se ainda não foram carregados
    if (!dadosCarregados || pacotes.length === 0) {
      loadData();
    } else {
      // Se os dados já foram carregados, apenas aplicar os filtros
      aplicarFiltros();
    }
  };

  const aplicarFiltros = () => {
    if (pacotes.length === 0) return;

    let pacotesFiltrados = [...pacotes];

    // Filtrar por intervalo de data (obrigatório)
    pacotesFiltrados = pacotesFiltrados.filter((p) => {
      const dataPacote = p.data_aspiracao.split('T')[0];
      return dataPacote >= filtroDataInicio && dataPacote <= filtroDataFim;
    });

    // Filtrar por fazenda (opcional, se escolhida)
    if (filtroFazenda) {
      pacotesFiltrados = pacotesFiltrados.filter((p) => p.fazenda_id === filtroFazenda);
    }

    setPacotesFiltrados(pacotesFiltrados);
  };

  const handleLimparFiltros = () => {
    setFiltroFazenda('');
    setFiltroDataInicio('');
    setFiltroDataFim('');
    setPacotesFiltrados([]);
    setPacotes([]);
    setDadosCarregados(false);
  };

  // Aplicar filtros quando os pacotes forem carregados (apenas se já houver filtros aplicados)
  useEffect(() => {
    if (pacotes.length > 0 && filtroDataInicio && filtroDataFim && dadosCarregados) {
      aplicarFiltros();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacotes]);

  if (loadingFazendas) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aspirações"
        description="Gerenciar aspirações"
        actions={
          <Button
            onClick={() => navigate('/aspiracoes/novo')}
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Aspiração
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Filtro de Fazenda */}
            <div className="space-y-2">
              <Label>Fazenda</Label>
              <Select 
                value={filtroFazenda || 'all'} 
                onValueChange={(value) => {
                  const fazendaValue = value === 'all' ? '' : value;
                  setFiltroFazenda(fazendaValue);
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

            {/* Filtro de Data Inicial */}
            <div className="space-y-2">
              <Label>Data Inicial *</Label>
              <DatePickerBR
                value={filtroDataInicio}
                onChange={setFiltroDataInicio}
                max={filtroDataFim || ''}
              />
              {filtroDataInicio && filtroDataFim && filtroDataInicio > filtroDataFim && (
                <p className="text-sm text-red-500">A data inicial deve ser anterior ou igual à data final</p>
              )}
            </div>

            {/* Filtro de Data Final */}
            <div className="space-y-2">
              <Label>Data Final *</Label>
              <DatePickerBR
                value={filtroDataFim}
                onChange={setFiltroDataFim}
                min={filtroDataInicio || ''}
              />
            </div>
          </div>

          {/* Botão de Buscar e Atalhos rápidos de data */}
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-wrap gap-2 flex-1">
              <Label className="w-full text-sm font-medium text-muted-foreground">Atalhos rápidos:</Label>
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
              onClick={handleBuscar}
              disabled={!filtroDataInicio || !filtroDataFim || loading}
            >
              <Search className="w-4 h-4 mr-2" />
              Buscar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Aspirações</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Fazenda</TableHead>
                <TableHead>Fazenda Destino</TableHead>
                <TableHead>Horário Início</TableHead>
                <TableHead>Doadoras</TableHead>
                <TableHead>Total Oócitos</TableHead>
                <TableHead>Veterinário</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Usado em Lote FIV</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!dadosCarregados && pacotesFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground py-12">
                    <div className="flex flex-col items-center gap-2">
                      <Filter className="w-8 h-8 text-muted-foreground" />
                      <p className="text-lg font-medium">Aplique filtros para visualizar as aspirações</p>
                      <p className="text-sm">Preencha a data inicial e data final, depois clique em "Buscar"</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : loading ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground py-12">
                    <LoadingSpinner />
                  </TableCell>
                </TableRow>
              ) : pacotesFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground py-12">
                    <EmptyState
                      title="Nenhuma aspiração encontrada"
                      description="Ajuste os filtros ou tente outro período."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                pacotesFiltrados.map((pacote) => (
                  <TableRow
                    key={pacote.id}
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => navigate(`/aspiracoes/${pacote.id}`)}
                  >
                    <TableCell>{formatDate(pacote.data_aspiracao)}</TableCell>
                    <TableCell className="font-medium">{pacote.fazenda_nome || '-'}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {pacote.fazendas_destino_nomes && pacote.fazendas_destino_nomes.length > 0 ? (
                          pacote.fazendas_destino_nomes.map((nome, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {nome}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{pacote.horario_inicio || '-'}</TableCell>
                    <TableCell>{pacote.quantidade_doadoras || 0}</TableCell>
                    <TableCell className="font-medium">{pacote.total_oocitos || 0}</TableCell>
                    <TableCell>{pacote.veterinario_responsavel || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={pacote.status === 'FINALIZADO' ? 'default' : 'secondary'}>
                        {pacote.status === 'FINALIZADO' ? 'FINALIZADO' : 'EM ANDAMENTO'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {pacote.usado_em_lote_fiv ? (
                        <Badge variant="destructive">Usado</Badge>
                      ) : (
                        <Badge variant="outline">Disponível</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/aspiracoes/${pacote.id}`)}
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
