import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { todayISO as getTodayDateString } from '@/lib/dateUtils';
import type { EmbriaoComRelacionamentos, DoseSemenComTouro } from '@/lib/types';
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
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { useToast } from '@/hooks/use-toast';
import { Search, Eye, Snowflake, Download, Filter, Users, Dna, X } from 'lucide-react';

interface Cliente {
  id: string;
  nome: string;
}

interface EmbriaoCongelado extends EmbriaoComRelacionamentos {
  cliente?: { id: string; nome: string };
}

export default function EmbrioesCongelados() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [embrioes, setEmbrioes] = useState<EmbriaoCongelado[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroCliente, setFiltroCliente] = useState<string>('todos');
  const [filtroRaca, setFiltroRaca] = useState<string>('todos');
  const [filtroClassificacao, setFiltroClassificacao] = useState<string>('todos');
  const [filtroTouro, setFiltroTouro] = useState<string>('todos');

  // Detalhe
  const [embriaoDetalhe, setEmbriaoDetalhe] = useState<EmbriaoCongelado | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load clientes
      const { data: clientesData, error: clientesError } = await supabase
        .from('clientes')
        .select('id, nome')
        .order('nome');

      if (clientesError) throw clientesError;
      setClientes(clientesData || []);

      // Load embriões congelados com relacionamentos
      const { data: embrioesData, error: embrioesError } = await supabase
        .from('embrioes')
        .select(`
          *,
          cliente:clientes(id, nome),
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
              horario_aspiracao,
              doadora:doadoras(id, registro, nome, raca)
            )
          )
        `)
        .eq('status_atual', 'CONGELADO')
        .order('data_congelamento', { ascending: false });

      if (embrioesError) throw embrioesError;
      setEmbrioes(embrioesData || []);
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

  // Extrair dados para filtros
  const { racas, classificacoes, touros } = useMemo(() => {
    const racaSet = new Set<string>();
    const classSet = new Set<string>();
    const touroMap = new Map<string, string>();

    embrioes.forEach((embriao) => {
      if (embriao.classificacao) {
        classSet.add(embriao.classificacao);
      }

      const acasalamento = embriao.acasalamento as any;
      const doadora = acasalamento?.aspiracao?.doadora;
      const touro = acasalamento?.dose_semen?.touro;

      // Raça pode vir da doadora ou do touro
      if (doadora?.raca) racaSet.add(doadora.raca);
      if (touro?.raca) racaSet.add(touro.raca);

      if (touro?.id) {
        touroMap.set(touro.id, touro.nome || touro.registro || touro.id);
      }
    });

    return {
      racas: Array.from(racaSet).sort(),
      classificacoes: Array.from(classSet).sort(),
      touros: Array.from(touroMap.entries()).sort((a, b) => a[1].localeCompare(b[1])),
    };
  }, [embrioes]);

  // Filtrar embriões
  const filteredEmbrioes = useMemo(() => {
    return embrioes.filter((embriao) => {
      const acasalamento = embriao.acasalamento as any;
      const doadora = acasalamento?.aspiracao?.doadora;
      const touro = acasalamento?.dose_semen?.touro;

      // Busca
      const matchesSearch = !searchTerm ||
        embriao.identificacao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        embriao.localizacao_atual?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        embriao.cliente?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doadora?.registro?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doadora?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        touro?.nome?.toLowerCase().includes(searchTerm.toLowerCase());

      // Filtro cliente
      const matchesCliente = filtroCliente === 'todos' ||
        embriao.cliente_id === filtroCliente;

      // Filtro raça
      const matchesRaca = filtroRaca === 'todos' ||
        doadora?.raca === filtroRaca ||
        touro?.raca === filtroRaca;

      // Filtro classificação
      const matchesClassificacao = filtroClassificacao === 'todos' ||
        embriao.classificacao === filtroClassificacao;

      // Filtro touro
      const matchesTouro = filtroTouro === 'todos' ||
        touro?.id === filtroTouro;

      return matchesSearch && matchesCliente && matchesRaca && matchesClassificacao && matchesTouro;
    });
  }, [embrioes, searchTerm, filtroCliente, filtroRaca, filtroClassificacao, filtroTouro]);

  // Estatísticas
  const estatisticas = useMemo(() => {
    const porCliente = new Map<string, number>();
    const porClassificacao = new Map<string, number>();

    filteredEmbrioes.forEach((embriao) => {
      const clienteNome = embriao.cliente?.nome || 'Sem cliente';
      porCliente.set(clienteNome, (porCliente.get(clienteNome) || 0) + 1);

      const classificacao = embriao.classificacao || 'Sem classificação';
      porClassificacao.set(classificacao, (porClassificacao.get(classificacao) || 0) + 1);
    });

    return {
      total: filteredEmbrioes.length,
      totalGeral: embrioes.length,
      porCliente: Array.from(porCliente.entries()).sort((a, b) => b[1] - a[1]),
      porClassificacao: Array.from(porClassificacao.entries()).sort((a, b) => b[1] - a[1]),
    };
  }, [filteredEmbrioes, embrioes]);

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  const handleExportCSV = () => {
    const headers = ['Identificação', 'Cliente', 'Classificação', 'Doadora', 'Touro', 'Raça', 'Data Cong.', 'Localização'];
    const rows = filteredEmbrioes.map((embriao) => {
      const acasalamento = embriao.acasalamento as any;
      const doadora = acasalamento?.aspiracao?.doadora;
      const touro = acasalamento?.dose_semen?.touro;
      return [
        embriao.identificacao || '',
        embriao.cliente?.nome || '',
        embriao.classificacao || '',
        doadora?.registro || doadora?.nome || '',
        touro?.nome || '',
        doadora?.raca || touro?.raca || '',
        formatDate(embriao.data_congelamento),
        embriao.localizacao_atual || '',
      ];
    });

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `embrioes-congelados-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Exportação concluída',
      description: `${filteredEmbrioes.length} embriões exportados`,
    });
  };

  const DialogDetalheContent = ({ embriao }: { embriao: EmbriaoCongelado }) => {
    const acasalamento = embriao.acasalamento as any;
    const dose = acasalamento?.dose_semen;
    const touro = dose?.touro;
    const aspiracao = acasalamento?.aspiracao;
    const doadora = aspiracao?.doadora;
    const loteFiv = embriao.lote_fiv;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-muted-foreground">Identificação</p>
          <p className="font-medium">{embriao.identificacao || '-'}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Cliente</p>
          <p className="font-medium">{embriao.cliente?.nome || '-'}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Classificação</p>
          <p className="font-medium">
            {embriao.classificacao ? (
              <Badge variant="secondary">{embriao.classificacao}</Badge>
            ) : '-'}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Status</p>
          <p className="font-medium">
            <Badge className="bg-cyan-100 text-cyan-800">
              <Snowflake className="w-3 h-3 mr-1" />
              CONGELADO
            </Badge>
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Data de Congelamento</p>
          <p className="font-medium">{formatDate(embriao.data_congelamento)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Localização</p>
          <p className="font-medium">{embriao.localizacao_atual || '-'}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Tipo</p>
          <p className="font-medium">{embriao.tipo_embriao || '-'}</p>
        </div>

        <div className="col-span-2 border-t pt-4 mt-2">
          <p className="text-muted-foreground font-medium mb-2">Origem</p>
        </div>

        <div>
          <p className="text-muted-foreground">Doadora</p>
          <p className="font-medium">
            {doadora?.registro || doadora?.nome || '-'}
            {doadora?.raca && <span className="text-muted-foreground ml-1">({doadora.raca})</span>}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Touro</p>
          <p className="font-medium">
            {touro?.nome || '-'}
            {touro?.registro && <span className="text-muted-foreground ml-1">({touro.registro})</span>}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Raça do Touro</p>
          <p className="font-medium">{touro?.raca || '-'}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Data D0 (Lote FIV)</p>
          <p className="font-medium">{formatDate(loteFiv?.data_abertura)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Data de Aspiração</p>
          <p className="font-medium">{formatDate(aspiracao?.data_aspiracao)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Hora de Aspiração</p>
          <p className="font-medium">{aspiracao?.horario_aspiracao || '-'}</p>
        </div>

        {embriao.observacoes && (
          <div className="col-span-2 border-t pt-4 mt-2">
            <p className="text-muted-foreground">Observações</p>
            <p className="font-medium">{embriao.observacoes}</p>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Embriões Congelados"
        description="Estoque geral de embriões congelados"
        actions={
          <Button variant="outline" onClick={handleExportCSV} disabled={filteredEmbrioes.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
        }
      />

      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Snowflake className="w-5 h-5 text-cyan-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Congelados</p>
                <p className="text-2xl font-bold">{estatisticas.totalGeral}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Filtrados</p>
            <p className="text-2xl font-bold">{estatisticas.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Clientes</p>
            <p className="text-2xl font-bold">{estatisticas.porCliente.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Classificações</p>
            <p className="text-2xl font-bold">{estatisticas.porClassificacao.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Por classificação */}
      {estatisticas.porClassificacao.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Por Classificação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {estatisticas.porClassificacao.map(([classificacao, quantidade]) => (
                <div key={classificacao} className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg">
                  <Badge variant="secondary">{classificacao}</Badge>
                  <span className="font-semibold text-sm">{quantidade}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Barra de Filtros Premium */}
      <div className="rounded-xl border border-border bg-gradient-to-r from-card via-card to-muted/30 p-4">
        <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end md:gap-6">
          {/* Grupo: Busca */}
          <div className="flex items-end gap-3">
            <div className="w-1 h-6 rounded-full bg-primary/40 self-center" />
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground self-center">
              <Filter className="w-3.5 h-3.5" />
              <span>Busca</span>
            </div>
            <div className="relative w-full md:w-auto md:flex-1 md:min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar embrião..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-11 md:h-9"
              />
            </div>
          </div>

          {/* Separador */}
          <div className="h-10 w-px bg-border hidden md:block" />

          {/* Grupo: Cliente */}
          <div className="flex items-end gap-3">
            <div className="w-1 h-6 rounded-full bg-emerald-500/40 self-center" />
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground self-center">
              <Users className="w-3.5 h-3.5" />
              <span>Cliente</span>
            </div>
            <div className="w-full md:w-[180px]">
              <Select value={filtroCliente} onValueChange={setFiltroCliente}>
                <SelectTrigger className="h-11 md:h-9">
                  <SelectValue placeholder="Cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos Clientes</SelectItem>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Separador */}
          <div className="h-10 w-px bg-border hidden md:block" />

          {/* Grupo: Genética */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-1 h-6 rounded-full bg-blue-500/40 self-center" />
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground self-center">
              <Dna className="w-3.5 h-3.5" />
              <span>Genética</span>
            </div>
            <div className="w-[calc(50%-0.5rem)] md:w-[150px]">
              <Select value={filtroRaca} onValueChange={setFiltroRaca}>
                <SelectTrigger className="h-11 md:h-9">
                  <SelectValue placeholder="Raça" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas Raças</SelectItem>
                  {racas.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[calc(50%-0.5rem)] md:w-[150px]">
              <Select value={filtroClassificacao} onValueChange={setFiltroClassificacao}>
                <SelectTrigger className="h-11 md:h-9">
                  <SelectValue placeholder="Classificação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {classificacoes.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:w-[180px]">
              <Select value={filtroTouro} onValueChange={setFiltroTouro}>
                <SelectTrigger className="h-11 md:h-9">
                  <SelectValue placeholder="Touro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos Touros</SelectItem>
                  {touros.map(([id, nome]) => (
                    <SelectItem key={id} value={id}>{nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Botão Limpar */}
          {(searchTerm || filtroCliente !== 'todos' || filtroRaca !== 'todos' || filtroClassificacao !== 'todos' || filtroTouro !== 'todos') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setFiltroCliente('todos');
                setFiltroRaca('todos');
                setFiltroClassificacao('todos');
                setFiltroTouro('todos');
              }}
              className="h-11 md:h-9 ml-auto"
            >
              <X className="w-4 h-4 mr-2" />
              Limpar Filtros
            </Button>
          )}
        </div>
      </div>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>Embriões Congelados ({filteredEmbrioes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filteredEmbrioes.length === 0 ? (
              <EmptyState
                title="Nenhum embrião encontrado"
                description={searchTerm || filtroCliente !== 'todos' || filtroRaca !== 'todos' || filtroClassificacao !== 'todos' || filtroTouro !== 'todos'
                  ? "Tente ajustar os filtros"
                  : "Nenhum embrião congelado no estoque"
                }
              />
            ) : (
              filteredEmbrioes.map((embriao) => {
                const acasalamento = embriao.acasalamento as any;
                const doadora = acasalamento?.aspiracao?.doadora;
                const touro = acasalamento?.dose_semen?.touro;
                const raca = doadora?.raca || touro?.raca;

                return (
                  <div
                    key={embriao.id}
                    className="rounded-xl border border-border/60 bg-card shadow-sm p-3.5 active:bg-muted/50"
                    onClick={() => setEmbriaoDetalhe(embriao)}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-medium text-base font-mono">{embriao.identificacao || '-'}</span>
                      {embriao.classificacao && <Badge variant="secondary">{embriao.classificacao}</Badge>}
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase block">Doadora</span>
                        <span className="font-medium">{doadora?.registro || doadora?.nome || '-'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase block">Touro</span>
                        <span className="font-medium">{touro?.nome || '-'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase block">Cliente</span>
                        <span className="font-medium">{embriao.cliente?.nome || '-'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase block">Raça</span>
                        <span className="font-medium">{raca || '-'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase block">Data Cong.</span>
                        <span className="font-medium">{formatDate(embriao.data_congelamento)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase block">Localização</span>
                        <span className="font-medium">{embriao.localizacao_atual || '-'}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block">
            {filteredEmbrioes.length === 0 ? (
              <EmptyState
                title="Nenhum embrião encontrado"
                description={searchTerm || filtroCliente !== 'todos' || filtroRaca !== 'todos' || filtroClassificacao !== 'todos' || filtroTouro !== 'todos'
                  ? "Tente ajustar os filtros"
                  : "Nenhum embrião congelado no estoque"
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Identificação</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Classificação</TableHead>
                    <TableHead>Doadora</TableHead>
                    <TableHead>Touro</TableHead>
                    <TableHead>Raça</TableHead>
                    <TableHead>Data Cong.</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmbrioes.map((embriao) => {
                    const acasalamento = embriao.acasalamento as any;
                    const doadora = acasalamento?.aspiracao?.doadora;
                    const touro = acasalamento?.dose_semen?.touro;
                    const raca = doadora?.raca || touro?.raca;

                    return (
                      <TableRow key={embriao.id}>
                        <TableCell className="font-medium font-mono text-sm">
                          {embriao.identificacao || '-'}
                        </TableCell>
                        <TableCell>{embriao.cliente?.nome || '-'}</TableCell>
                        <TableCell>
                          {embriao.classificacao ? (
                            <Badge variant="secondary">{embriao.classificacao}</Badge>
                          ) : '-'}
                        </TableCell>
                        <TableCell>{doadora?.registro || doadora?.nome || '-'}</TableCell>
                        <TableCell>
                          {touro?.nome || '-'}
                          {touro?.registro && (
                            <span className="text-muted-foreground text-xs ml-1">({touro.registro})</span>
                          )}
                        </TableCell>
                        <TableCell>{raca || '-'}</TableCell>
                        <TableCell>{formatDate(embriao.data_congelamento)}</TableCell>
                        <TableCell>{embriao.localizacao_atual || '-'}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEmbriaoDetalhe(embriao)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Detalhar
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialog de detalhes */}
      <Dialog open={!!embriaoDetalhe} onOpenChange={(open) => !open && setEmbriaoDetalhe(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Embrião</DialogTitle>
            <DialogDescription>
              Informações completas do embrião congelado
            </DialogDescription>
          </DialogHeader>
          {embriaoDetalhe && <DialogDetalheContent embriao={embriaoDetalhe} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
