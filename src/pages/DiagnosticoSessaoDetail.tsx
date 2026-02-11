/**
 * Página de Relatório de Sessão de Diagnóstico de Gestação
 *
 * Exibe detalhes de uma sessão de DG com lista de todas as receptoras
 * Acesso via query params: /dg/sessao?fazenda=X&data_te=Y&data_dg=Z&vet=W
 */

import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import CountBadge, { getTaxaVariant } from '@/components/shared/CountBadge';
import ResultBadge from '@/components/shared/ResultBadge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Search } from 'lucide-react';
import { DataTable } from '@/components/shared/DataTable';

interface ReceptoraDG {
  id: string;
  receptora_id: string;
  receptora_brinco: string;
  receptora_nome?: string;
  data_te: string;
  data_diagnostico: string;
  resultado: string;
  numero_gestacoes?: number;
  observacoes?: string;
  data_provavel_parto?: string;
}

interface SessaoInfo {
  fazenda_nome: string;
  data_te: string;
  data_diagnostico: string;
  veterinario_responsavel?: string;
  tecnico_responsavel?: string;
}

export default function DiagnosticoSessaoDetail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  // Query params
  const fazendaParam = searchParams.get('fazenda') || '';
  const dataTeParam = searchParams.get('data_te') || '';
  const dataDgParam = searchParams.get('data_dg') || '';
  const vetParam = searchParams.get('vet') || '';

  // State
  const [loading, setLoading] = useState(true);
  const [sessaoInfo, setSessaoInfo] = useState<SessaoInfo | null>(null);
  const [receptoras, setReceptoras] = useState<ReceptoraDG[]>([]);
  const [filtroBusca, setFiltroBusca] = useState('');

  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const ITENS_POR_PAGINA = 20;

  // Load data
  useEffect(() => {
    if (!fazendaParam || !dataTeParam || !dataDgParam) {
      toast({
        title: 'Parâmetros inválidos',
        description: 'Faltam parâmetros para identificar a sessão',
        variant: 'destructive',
      });
      navigate('/dg');
      return;
    }

    loadSessao();
  }, [fazendaParam, dataTeParam, dataDgParam, vetParam]);

  const loadSessao = async () => {
    try {
      setLoading(true);

      // 1. Buscar diagnósticos que correspondem aos filtros
      let query = supabase
        .from('diagnosticos_gestacao')
        .select('*')
        .eq('tipo_diagnostico', 'DG')
        .eq('data_te', dataTeParam)
        .eq('data_diagnostico', dataDgParam);

      if (vetParam) {
        query = query.eq('veterinario_responsavel', vetParam);
      }

      const { data: diagnosticosData, error: diagnosticosError } = await query;

      if (diagnosticosError) throw diagnosticosError;

      if (!diagnosticosData || diagnosticosData.length === 0) {
        setReceptoras([]);
        setSessaoInfo({
          fazenda_nome: fazendaParam,
          data_te: dataTeParam,
          data_diagnostico: dataDgParam,
          veterinario_responsavel: vetParam || undefined,
        });
        setLoading(false);
        return;
      }

      // 2. Buscar receptoras
      const receptoraIds = [...new Set(diagnosticosData.map(dg => dg.receptora_id))];

      const { data: receptorasData, error: receptorasError } = await supabase
        .from('receptoras')
        .select('id, identificacao, nome, data_provavel_parto')
        .in('id', receptoraIds);

      if (receptorasError) throw receptorasError;

      const receptorasMap = new Map(
        (receptorasData || []).map(r => [r.id, r])
      );

      // 3. Buscar fazendas das receptoras
      const { data: viewData } = await supabase
        .from('vw_receptoras_fazenda_atual')
        .select('receptora_id, fazenda_nome_atual')
        .in('receptora_id', receptoraIds);

      const fazendaMap = new Map(
        (viewData || []).map(v => [v.receptora_id, v.fazenda_nome_atual])
      );

      // 4. Filtrar por fazenda e montar lista
      const receptorasFormatadas: ReceptoraDG[] = diagnosticosData
        .filter(dg => {
          const fazendaReceptora = fazendaMap.get(dg.receptora_id);
          return fazendaReceptora === fazendaParam;
        })
        .map(dg => {
          const receptora = receptorasMap.get(dg.receptora_id);
          return {
            id: dg.id,
            receptora_id: dg.receptora_id,
            receptora_brinco: receptora?.identificacao || '-',
            receptora_nome: receptora?.nome,
            data_te: dg.data_te,
            data_diagnostico: dg.data_diagnostico,
            resultado: dg.resultado,
            numero_gestacoes: dg.numero_gestacoes,
            observacoes: dg.observacoes,
            data_provavel_parto: receptora?.data_provavel_parto || undefined,
          };
        })
        .sort((a, b) => a.receptora_brinco.localeCompare(b.receptora_brinco));

      setReceptoras(receptorasFormatadas);

      // Extrair info da sessão do primeiro registro
      const primeiroReg = diagnosticosData[0];
      setSessaoInfo({
        fazenda_nome: fazendaParam,
        data_te: dataTeParam,
        data_diagnostico: dataDgParam,
        veterinario_responsavel: primeiroReg?.veterinario_responsavel || vetParam || undefined,
        tecnico_responsavel: primeiroReg?.tecnico_responsavel,
      });

    } catch (error) {
      console.error('Erro ao carregar sessão:', error);
      toast({
        title: 'Erro ao carregar dados',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Filtrar receptoras
  const receptorasFiltradas = useMemo(() => {
    if (!filtroBusca.trim()) return receptoras;

    const termo = filtroBusca.toLowerCase();
    return receptoras.filter(r =>
      r.receptora_brinco.toLowerCase().includes(termo) ||
      r.receptora_nome?.toLowerCase().includes(termo)
    );
  }, [receptoras, filtroBusca]);

  // Paginação
  const totalPaginas = Math.ceil(receptorasFiltradas.length / ITENS_POR_PAGINA);
  const receptorasPaginadas = receptorasFiltradas.slice(
    (paginaAtual - 1) * ITENS_POR_PAGINA,
    paginaAtual * ITENS_POR_PAGINA
  );

  // Estatísticas
  const stats = useMemo(() => {
    const total = receptorasFiltradas.length;
    const prenhes = receptorasFiltradas.filter(r => r.resultado === 'PRENHE').length;
    const vazias = receptorasFiltradas.filter(r => r.resultado === 'VAZIA').length;
    const retoques = receptorasFiltradas.filter(r => r.resultado === 'RETOQUE').length;
    const taxa = total > 0 ? Math.round(((prenhes + retoques) / total) * 100) : 0;

    return { total, prenhes, vazias, retoques, taxa };
  }, [receptorasFiltradas]);

  const formatarData = (data: string) => {
    if (!data) return '-';
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!sessaoInfo) {
    return (
      <EmptyState
        title="Sessão não encontrada"
        description="Não foi possível carregar os dados da sessão."
        action={
          <Button onClick={() => navigate('/dg')} variant="outline">
            Voltar para DG
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header compacto */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-xl font-semibold text-foreground">Sessão de Diagnóstico</h1>
      </div>

      {/* Card principal com informações da sessão */}
      <Card>
        <CardContent className="pt-4 pb-4">
          {/* Mobile layout */}
          <div className="md:hidden space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-muted-foreground">Fazenda</span>
                <p className="text-base font-semibold text-foreground">{sessaoInfo.fazenda_nome}</p>
              </div>
              <Badge variant="default" className="bg-primary hover:bg-primary-dark">Realizado</Badge>
            </div>
            <div className="flex items-center gap-4">
              <div>
                <span className="text-xs font-medium text-muted-foreground">Data TE</span>
                <p className="text-sm text-foreground">{formatarData(sessaoInfo.data_te)}</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div>
                <span className="text-xs font-medium text-muted-foreground">Data DG</span>
                <p className="text-sm text-foreground">{formatarData(sessaoInfo.data_diagnostico)}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-border">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Total:</span>
                <CountBadge value={stats.total} variant="default" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Prenhes:</span>
                <CountBadge value={stats.prenhes + stats.retoques} variant="success" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Vazias:</span>
                <CountBadge value={stats.vazias} variant="danger" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Taxa:</span>
                <CountBadge value={stats.taxa} suffix="%" variant={getTaxaVariant(stats.taxa)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
              <div className="space-y-1">
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Veterinário</h4>
                <p className="text-xs text-foreground">{sessaoInfo.veterinario_responsavel || '—'}</p>
              </div>
              <div className="space-y-1">
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Técnico</h4>
                <p className="text-xs text-foreground">{sessaoInfo.tecnico_responsavel || '—'}</p>
              </div>
            </div>
          </div>

          {/* Desktop layout */}
          <div className="hidden md:block">
            {/* Linha 1: Fazenda + Datas + Resumo */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Fazenda</span>
                  <p className="text-base font-semibold text-foreground">{sessaoInfo.fazenda_nome}</p>
                </div>
                <div className="h-8 w-px bg-border" />
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Data TE</span>
                  <p className="text-sm text-foreground">{formatarData(sessaoInfo.data_te)}</p>
                </div>
                <div className="h-8 w-px bg-border" />
                <div>
                  <span className="text-xs font-medium text-muted-foreground">Data DG</span>
                  <p className="text-sm text-foreground">{formatarData(sessaoInfo.data_diagnostico)}</p>
                </div>
                <div className="h-8 w-px bg-border" />
                <Badge variant="default" className="bg-primary hover:bg-primary-dark">Realizado</Badge>
              </div>

              {/* Resumo inline */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Total:</span>
                  <CountBadge value={stats.total} variant="default" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Prenhes:</span>
                  <CountBadge value={stats.prenhes + stats.retoques} variant="success" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Vazias:</span>
                  <CountBadge value={stats.vazias} variant="danger" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Taxa:</span>
                  <CountBadge value={stats.taxa} suffix="%" variant={getTaxaVariant(stats.taxa)} />
                </div>
              </div>
            </div>

            {/* Linha 2: Grid com detalhes */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t border-border">
              <div className="space-y-1">
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Veterinário</h4>
                <p className="text-xs text-foreground">{sessaoInfo.veterinario_responsavel || '—'}</p>
              </div>
              <div className="space-y-1">
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Técnico</h4>
                <p className="text-xs text-foreground">{sessaoInfo.tecnico_responsavel || '—'}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Receptoras */}
      <Card>
        <CardHeader className="pb-2 pt-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-base">Receptoras ({receptorasFiltradas.length})</CardTitle>
              <CardDescription>Lista de todas as receptoras diagnosticadas na sessão</CardDescription>
            </div>

            {/* Busca */}
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar brinco ou nome..."
                value={filtroBusca}
                onChange={(e) => {
                  setFiltroBusca(e.target.value);
                  setPaginaAtual(1);
                }}
                className="pl-9 h-11 md:h-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 pb-2">
          {receptorasFiltradas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {receptoras.length === 0
                ? 'Nenhuma receptora encontrada nesta sessão'
                : 'Nenhuma receptora corresponde à busca'
              }
            </div>
          ) : (
            <>
              {/* Mobile card layout */}
              <div className="md:hidden space-y-2">
                {receptorasPaginadas.map((row, index) => (
                  <div key={row.id} className="rounded-xl border border-border/60 bg-card shadow-sm p-3.5">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-muted-foreground shrink-0">
                          {((paginaAtual - 1) * ITENS_POR_PAGINA) + index + 1}.
                        </span>
                        <div className="min-w-0">
                          <p className="text-base font-medium text-foreground truncate">{row.receptora_brinco}</p>
                          {row.receptora_nome && (
                            <p className="text-xs text-muted-foreground truncate">{row.receptora_nome}</p>
                          )}
                        </div>
                      </div>
                      <ResultBadge result={row.resultado} />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>TE: {formatarData(row.data_te)}</span>
                      <span>DG: {formatarData(row.data_diagnostico)}</span>
                      {row.data_provavel_parto && (
                        <span>Parto: {formatarData(row.data_provavel_parto)}</span>
                      )}
                      {row.numero_gestacoes && (
                        <span>Gest.: {row.numero_gestacoes}</span>
                      )}
                    </div>
                    {row.observacoes && (
                      <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border/50">
                        {row.observacoes}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop table layout */}
              <div className="hidden md:block">
                <DataTable<ReceptoraDG>
                  data={receptorasPaginadas}
                  rowKey="id"
                  rowNumber
                  emptyMessage="Nenhuma receptora encontrada"
                  columns={[
                    { key: 'receptora_brinco', label: 'Receptora' },
                    { key: 'data_te', label: 'Data TE', align: 'center' },
                    { key: 'data_diagnostico', label: 'Data DG', align: 'center' },
                    { key: 'data_provavel_parto', label: 'Data Parto', align: 'center' },
                    { key: 'resultado', label: 'Resultado', align: 'center' },
                    { key: 'numero_gestacoes', label: 'Nº Gest.', align: 'center' },
                    { key: 'observacoes', label: 'Observações' },
                  ]}
                  renderCell={(row, column) => {
                    switch (column.key) {
                      case 'receptora_brinco':
                        return (
                          <div>
                            <span className="font-medium text-sm text-foreground">{row.receptora_brinco}</span>
                            {row.receptora_nome && (
                              <span className="text-[10px] text-muted-foreground block">{row.receptora_nome}</span>
                            )}
                          </div>
                        );
                      case 'data_te':
                        return <span className="text-muted-foreground">{formatarData(row.data_te)}</span>;
                      case 'data_diagnostico':
                        return <span className="text-foreground">{formatarData(row.data_diagnostico)}</span>;
                      case 'data_provavel_parto':
                        return <span className="text-muted-foreground">{row.data_provavel_parto ? formatarData(row.data_provavel_parto) : '—'}</span>;
                      case 'resultado':
                        return <ResultBadge result={row.resultado} />;
                      case 'numero_gestacoes':
                        return <span className="text-muted-foreground">{row.numero_gestacoes || '—'}</span>;
                      case 'observacoes':
                        return <span className="text-muted-foreground truncate">{row.observacoes || '—'}</span>;
                      default:
                        return null;
                    }
                  }}
                />
              </div>

              {/* Paginação */}
              {totalPaginas > 1 && (
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mt-4 pt-4 border-t border-border">
                  <span className="text-sm text-muted-foreground text-center md:text-left">
                    Mostrando {((paginaAtual - 1) * ITENS_POR_PAGINA) + 1} a {Math.min(paginaAtual * ITENS_POR_PAGINA, receptorasFiltradas.length)} de {receptorasFiltradas.length}
                  </span>
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-11 md:h-9"
                      onClick={() => setPaginaAtual(prev => Math.max(1, prev - 1))}
                      disabled={paginaAtual === 1}
                    >
                      Anterior
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
                        let pageNum;
                        if (totalPaginas <= 5) {
                          pageNum = i + 1;
                        } else if (paginaAtual <= 3) {
                          pageNum = i + 1;
                        } else if (paginaAtual >= totalPaginas - 2) {
                          pageNum = totalPaginas - 4 + i;
                        } else {
                          pageNum = paginaAtual - 2 + i;
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={paginaAtual === pageNum ? 'default' : 'outline'}
                            size="sm"
                            className={`w-11 h-11 md:w-9 md:h-9 p-0 ${paginaAtual === pageNum ? 'bg-primary hover:bg-primary-dark' : ''}`}
                            onClick={() => setPaginaAtual(pageNum)}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-11 md:h-9"
                      onClick={() => setPaginaAtual(prev => Math.min(totalPaginas, prev + 1))}
                      disabled={paginaAtual === totalPaginas}
                    >
                      Próximo
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
