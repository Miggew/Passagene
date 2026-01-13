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
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/utils';
import { Plus, Eye, Filter, X } from 'lucide-react';

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

  useEffect(() => {
    // A busca só é iniciada quando ambas as datas forem escolhidas
    if (filtroDataInicio && filtroDataFim) {
      // Validar que data início <= data fim
      if (filtroDataInicio > filtroDataFim) {
        // Limpar resultados se a validação falhar
        setPacotesFiltrados([]);
        setPacotes([]);
        setDadosCarregados(false);
        return;
      }
      // Se os dados ainda não foram carregados, carregar
      if (!dadosCarregados && pacotes.length === 0) {
        loadData();
      }
    } else {
      // Se não houver ambas as datas, limpar resultados
      setPacotesFiltrados([]);
      setPacotes([]);
      setDadosCarregados(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroDataInicio, filtroDataFim]);

  // Aplicar filtros quando os pacotes forem carregados ou quando os filtros mudarem
  useEffect(() => {
    if (pacotes.length > 0 && filtroDataInicio && filtroDataFim) {
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
    }
  }, [pacotes, filtroFazenda, filtroDataInicio, filtroDataFim]);

  if (loadingFazendas) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Aspirações</h1>
          <p className="text-slate-600 mt-1">Gerenciar aspirações</p>
        </div>
        <Button
          onClick={() => navigate('/aspiracoes/novo')}
          className="bg-green-600 hover:bg-green-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Aspiração
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Lista de Aspirações</CardTitle>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <span className="text-sm text-slate-500">Filtros</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex gap-4 items-end">
            <div className="flex-1 space-y-2">
              <Label>Filtrar por Fazenda</Label>
              <Select value={filtroFazenda || undefined} onValueChange={(value) => setFiltroFazenda(value || '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as fazendas" />
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
            <div className="flex-1 space-y-2">
              <Label>Data Inicial *</Label>
              <Input
                type="date"
                value={filtroDataInicio}
                onChange={(e) => setFiltroDataInicio(e.target.value)}
                max={filtroDataFim || undefined}
              />
              {filtroDataInicio && filtroDataFim && filtroDataInicio > filtroDataFim && (
                <p className="text-sm text-red-500">A data inicial deve ser anterior ou igual à data final</p>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <Label>Data Final *</Label>
              <Input
                type="date"
                value={filtroDataFim}
                onChange={(e) => setFiltroDataFim(e.target.value)}
                min={filtroDataInicio || undefined}
              />
            </div>
            {(filtroDataInicio || filtroDataFim) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFiltroFazenda('');
                  setFiltroDataInicio('');
                  setFiltroDataFim('');
                }}
              >
                <X className="w-4 h-4 mr-1" />
                Limpar Filtros
              </Button>
            )}
          </div>
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
              {!filtroDataInicio || !filtroDataFim ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-slate-500 py-12">
                    <div className="flex flex-col items-center gap-2">
                      <Filter className="w-8 h-8 text-slate-400" />
                      <p className="text-lg font-medium">Aplique filtros para visualizar as aspirações</p>
                      <p className="text-sm">Selecione um intervalo de datas (data inicial e data final) para buscar aspirações</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : loading ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-slate-500 py-12">
                    <LoadingSpinner />
                  </TableCell>
                </TableRow>
              ) : pacotesFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-slate-500 py-12">
                    Nenhuma aspiração encontrada com os filtros aplicados
                  </TableCell>
                </TableRow>
              ) : (
                pacotesFiltrados.map((pacote) => (
                  <TableRow
                    key={pacote.id}
                    className="cursor-pointer hover:bg-slate-50"
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
                          <span className="text-slate-400">-</span>
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
