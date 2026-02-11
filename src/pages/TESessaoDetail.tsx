/**
 * Página de Relatório de Sessão de Transferência de Embriões
 *
 * Exibe detalhes de uma sessão de TE com lista de todas as transferências
 * Acesso via query params: /transferencia/sessao?fazenda=X&data_te=Y&vet=W
 */

import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { buscarDadosGenealogia } from '@/lib/dataEnrichment';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import CiclandoBadge from '@/components/shared/CiclandoBadge';
import QualidadeSemaforo from '@/components/shared/QualidadeSemaforo';
import CountBadge from '@/components/shared/CountBadge';
import ResultBadge from '@/components/shared/ResultBadge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Search } from 'lucide-react';
import { DataTable } from '@/components/shared/DataTable';

interface TransferenciaTE {
  id: string;
  receptora_id: string;
  receptora_brinco: string;
  receptora_nome?: string;
  ciclando_classificacao?: 'N' | 'CL' | null;
  qualidade_semaforo?: 1 | 2 | 3 | null;
  embriao_identificacao?: string;
  doadora_registro?: string;
  touro_nome?: string;
  classificacao?: string;
  tipo_te: string;
  observacoes?: string;
}

interface SessaoInfo {
  fazenda_nome: string;
  data_te: string;
  veterinario_responsavel?: string;
  tecnico_responsavel?: string;
}

export default function TESessaoDetail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  // Query params
  const fazendaParam = searchParams.get('fazenda') || '';
  const dataTeParam = searchParams.get('data_te') || '';
  const vetParam = searchParams.get('vet') || '';

  // State
  const [loading, setLoading] = useState(true);
  const [sessaoInfo, setSessaoInfo] = useState<SessaoInfo | null>(null);
  const [transferencias, setTransferencias] = useState<TransferenciaTE[]>([]);
  const [filtroBusca, setFiltroBusca] = useState('');

  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const ITENS_POR_PAGINA = 20;

  // Load data
  useEffect(() => {
    if (!fazendaParam || !dataTeParam) {
      toast({
        title: 'Parâmetros inválidos',
        description: 'Faltam parâmetros para identificar a sessão',
        variant: 'destructive',
      });
      navigate('/transferencia');
      return;
    }

    loadSessao();
  }, [fazendaParam, dataTeParam, vetParam]);

  const loadSessao = async () => {
    try {
      setLoading(true);

      // 1. Buscar transferências
      let query = supabase
        .from('transferencias_embrioes')
        .select(`
          id,
          receptora_id,
          embriao_id,
          protocolo_receptora_id,
          data_te,
          tipo_te,
          veterinario_responsavel,
          tecnico_responsavel,
          observacoes,
          status_te,
          embrioes (id, identificacao, classificacao),
          receptoras (id, identificacao, nome)
        `)
        .eq('status_te', 'REALIZADA')
        .eq('data_te', dataTeParam);

      if (vetParam) {
        query = query.eq('veterinario_responsavel', vetParam);
      }

      const { data: transferenciasData, error: transferenciasError } = await query;

      if (transferenciasError) throw transferenciasError;

      if (!transferenciasData || transferenciasData.length === 0) {
        setTransferencias([]);
        setSessaoInfo({
          fazenda_nome: fazendaParam,
          data_te: dataTeParam,
          veterinario_responsavel: vetParam || undefined,
        });
        setLoading(false);
        return;
      }

      // 2. Buscar fazenda das receptoras
      const receptoraIds = [...new Set(transferenciasData.map(t => t.receptora_id).filter(Boolean))];

      const { data: viewData } = await supabase
        .from('vw_receptoras_fazenda_atual')
        .select('receptora_id, fazenda_nome_atual')
        .in('receptora_id', receptoraIds);

      const fazendaMap = new Map(
        (viewData || []).map(v => [v.receptora_id, v.fazenda_nome_atual])
      );

      // 3. Buscar dados de protocolo_receptoras para ciclando e qualidade
      const protocoloReceptoraIds = transferenciasData
        .map(t => t.protocolo_receptora_id)
        .filter((id): id is string => !!id);

      let ciclandoMap = new Map<string, 'N' | 'CL' | null>();
      let qualidadeMap = new Map<string, 1 | 2 | 3 | null>();

      if (protocoloReceptoraIds.length > 0) {
        const { data: prData } = await supabase
          .from('protocolo_receptoras')
          .select('id, receptora_id, ciclando_classificacao, qualidade_semaforo')
          .in('id', protocoloReceptoraIds);

        (prData || []).forEach(pr => {
          ciclandoMap.set(pr.receptora_id, pr.ciclando_classificacao as 'N' | 'CL' | null);
          qualidadeMap.set(pr.receptora_id, pr.qualidade_semaforo as 1 | 2 | 3 | null);
        });
      }

      // 4. Buscar dados de genealogia dos embriões (query separada como no histórico)
      const embriaoIds = transferenciasData.map(t => t.embriao_id).filter(Boolean);

      const { data: embrioesData } = await supabase
        .from('embrioes')
        .select('id, lote_fiv_acasalamento_id')
        .in('id', embriaoIds);

      // Criar mapa de embriao_id para acasalamento_id
      const embriaoAcasalamentoMap = new Map(
        (embrioesData || []).map(e => [e.id, e.lote_fiv_acasalamento_id])
      );

      const acasalamentoIds = (embrioesData || [])
        .map(e => e.lote_fiv_acasalamento_id)
        .filter((id): id is string => !!id);

      // Usar função utilitária para buscar doadora e touro corretamente
      const { doadorasMap, tourosMap } = await buscarDadosGenealogia(acasalamentoIds);

      // 5. Filtrar por fazenda e montar lista
      const transferenciasFormatadas: TransferenciaTE[] = transferenciasData
        .filter(te => {
          const fazendaReceptora = fazendaMap.get(te.receptora_id);
          return fazendaReceptora === fazendaParam;
        })
        .map(te => {
          const acasalamentoId = embriaoAcasalamentoMap.get(te.embriao_id);
          return {
            id: te.id,
            receptora_id: te.receptora_id,
            receptora_brinco: te.receptoras?.identificacao || '-',
            receptora_nome: te.receptoras?.nome,
            ciclando_classificacao: ciclandoMap.get(te.receptora_id) || null,
            qualidade_semaforo: qualidadeMap.get(te.receptora_id) || null,
            embriao_identificacao: te.embrioes?.identificacao,
            doadora_registro: acasalamentoId ? doadorasMap.get(acasalamentoId) : undefined,
            touro_nome: acasalamentoId ? tourosMap.get(acasalamentoId) : undefined,
            classificacao: te.embrioes?.classificacao,
            tipo_te: te.tipo_te,
            observacoes: te.observacoes,
          };
        })
        .sort((a, b) => a.receptora_brinco.localeCompare(b.receptora_brinco));

      setTransferencias(transferenciasFormatadas);

      // Extrair info da sessão do primeiro registro
      const primeiroReg = transferenciasData.find(t => fazendaMap.get(t.receptora_id) === fazendaParam);
      setSessaoInfo({
        fazenda_nome: fazendaParam,
        data_te: dataTeParam,
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

  // Filtrar transferências
  const transferenciasFiltradas = useMemo(() => {
    if (!filtroBusca.trim()) return transferencias;

    const termo = filtroBusca.toLowerCase();
    return transferencias.filter(t =>
      t.receptora_brinco.toLowerCase().includes(termo) ||
      t.receptora_nome?.toLowerCase().includes(termo) ||
      t.embriao_identificacao?.toLowerCase().includes(termo) ||
      t.doadora_registro?.toLowerCase().includes(termo) ||
      t.touro_nome?.toLowerCase().includes(termo)
    );
  }, [transferencias, filtroBusca]);

  // Paginação
  const totalPaginas = Math.ceil(transferenciasFiltradas.length / ITENS_POR_PAGINA);
  const transferenciasPaginadas = transferenciasFiltradas.slice(
    (paginaAtual - 1) * ITENS_POR_PAGINA,
    paginaAtual * ITENS_POR_PAGINA
  );

  // Estatísticas
  const stats = useMemo(() => {
    const total = transferencias.length;
    const frescos = transferencias.filter(t => t.tipo_te === 'FRESCO').length;
    const congelados = transferencias.filter(t => t.tipo_te === 'CONGELADO').length;
    const receptorasUnicas = new Set(transferencias.map(t => t.receptora_id)).size;

    return { total, frescos, congelados, receptoras: receptorasUnicas };
  }, [transferencias]);

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
          <Button onClick={() => navigate('/transferencia')} variant="outline">
            Voltar para TE
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
        <h1 className="text-xl font-semibold text-foreground">Sessão de Transferência</h1>
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
              <Badge variant="default" className="bg-primary hover:bg-primary-dark">Realizada</Badge>
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground">Data TE</span>
              <p className="text-sm text-foreground">{formatarData(sessaoInfo.data_te)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-border">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Receptoras:</span>
                <CountBadge value={stats.receptoras} variant="default" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Total:</span>
                <CountBadge value={stats.total} variant="primary" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Frescos:</span>
                <CountBadge value={stats.frescos} variant="success" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Congelados:</span>
                <CountBadge value={stats.congelados} variant="cyan" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
              <div className="space-y-1">
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Veterinario</h4>
                <p className="text-xs text-foreground">{sessaoInfo.veterinario_responsavel || '—'}</p>
              </div>
              <div className="space-y-1">
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Tecnico</h4>
                <p className="text-xs text-foreground">{sessaoInfo.tecnico_responsavel || '—'}</p>
              </div>
            </div>
          </div>

          {/* Desktop layout */}
          <div className="hidden md:block">
            {/* Linha 1: Fazenda + Data + Resumo */}
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
                <Badge variant="default" className="bg-primary hover:bg-primary-dark">Realizada</Badge>
              </div>

              {/* Resumo inline */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Receptoras:</span>
                  <CountBadge value={stats.receptoras} variant="default" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Total:</span>
                  <CountBadge value={stats.total} variant="primary" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Frescos:</span>
                  <CountBadge value={stats.frescos} variant="success" />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Congelados:</span>
                  <CountBadge value={stats.congelados} variant="cyan" />
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

      {/* Lista de Transferências */}
      <Card>
        <CardHeader className="pb-2 pt-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-base">Transferências ({transferenciasFiltradas.length})</CardTitle>
              <CardDescription>Lista de todas as transferências realizadas na sessão</CardDescription>
            </div>

            {/* Busca */}
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar receptora, embrião..."
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
          {transferenciasFiltradas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {transferencias.length === 0
                ? 'Nenhuma transferência encontrada nesta sessão'
                : 'Nenhuma transferência corresponde à busca'
              }
            </div>
          ) : (
            <>
              {/* Mobile card layout */}
              <div className="md:hidden space-y-2">
                {transferenciasPaginadas.map((row, index) => (
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
                      <div className="flex items-center gap-1.5 shrink-0">
                        <ResultBadge result={row.tipo_te} />
                        {row.classificacao && <ResultBadge result={row.classificacao} size="sm" />}
                      </div>
                    </div>
                    {row.embriao_identificacao && (
                      <div className="mb-2">
                        <span className="text-xs text-muted-foreground">Embriao: </span>
                        <span className="text-xs font-mono font-medium text-foreground">{row.embriao_identificacao}</span>
                      </div>
                    )}
                    {(row.doadora_registro || row.touro_nome) && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                        {row.doadora_registro && <span className="text-foreground">{row.doadora_registro}</span>}
                        {row.doadora_registro && row.touro_nome && <span>x</span>}
                        {row.touro_nome && <span>{row.touro_nome}</span>}
                      </div>
                    )}
                    <div className="flex items-center gap-3 pt-2 border-t border-border/50">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">Ciclo:</span>
                        <CiclandoBadge value={row.ciclando_classificacao} variant="display" disabled={true} />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">Qual.:</span>
                        <QualidadeSemaforo value={row.qualidade_semaforo} variant="single" disabled={true} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table layout */}
              <div className="hidden md:block">
                <DataTable<TransferenciaTE>
                  data={transferenciasPaginadas}
                  rowKey="id"
                  rowNumber
                  emptyMessage="Nenhuma transferência encontrada"
                  columns={[
                    { key: 'receptora_brinco', label: 'Receptora' },
                    { key: 'ciclando_classificacao', label: 'Ciclo', align: 'center' },
                    { key: 'qualidade_semaforo', label: 'Qual.', align: 'center' },
                    { key: 'embriao_identificacao', label: 'Embrião' },
                    { key: 'doadora_registro', label: 'Doadora' },
                    { key: 'touro_nome', label: 'Touro' },
                    { key: 'classificacao', label: 'Class.', align: 'center' },
                    { key: 'tipo_te', label: 'Tipo', align: 'center' },
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
                      case 'ciclando_classificacao':
                        return (
                          <CiclandoBadge
                            value={row.ciclando_classificacao}
                            variant="display"
                            disabled={true}
                          />
                        );
                      case 'qualidade_semaforo':
                        return (
                          <QualidadeSemaforo
                            value={row.qualidade_semaforo}
                            variant="single"
                            disabled={true}
                          />
                        );
                      case 'embriao_identificacao':
                        return <span className="text-xs font-mono font-medium text-foreground">{row.embriao_identificacao || '-'}</span>;
                      case 'doadora_registro':
                        return <span className="text-foreground">{row.doadora_registro || '-'}</span>;
                      case 'touro_nome':
                        return <span className="text-muted-foreground">{row.touro_nome || '-'}</span>;
                      case 'classificacao':
                        return row.classificacao ? (
                          <ResultBadge result={row.classificacao} size="sm" />
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        );
                      case 'tipo_te':
                        return <ResultBadge result={row.tipo_te} />;
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
                    Mostrando {((paginaAtual - 1) * ITENS_POR_PAGINA) + 1} a {Math.min(paginaAtual * ITENS_POR_PAGINA, transferenciasFiltradas.length)} de {transferenciasFiltradas.length}
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
