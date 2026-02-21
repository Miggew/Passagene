import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import StatusBadge from '@/components/shared/StatusBadge';
import {
  EmbryoScoreBadge,
  EmbryoAnalysisBar,
  EmbryoScoreCard,
  getDiscrepancy,
} from '@/components/embryoscore';
import { useEmbryoScoresBatch, useEmbryoAnalysisStatusBatch, useRetryAnalysis, useCancelAnalysis } from '@/hooks/useEmbryoScores';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  Snowflake,
  Tag,
  Trash2,
  CheckSquare,
  Square,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Star,
  Brain,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import type { EmbrioCompleto, PacoteEmbrioes } from '@/hooks/embrioes';

const STAGE_LABELS: Record<number, string> = {
  3: 'Mórula Inicial',
  4: 'Mórula',
  5: 'Blasto Inicial',
  6: 'Blastocisto',
  7: 'Blasto Expandido',
  8: 'Blasto Eclodido',
  9: 'Blasto Eclodido Exp.'
};

interface PacoteEmbrioesTableProps {
  pacote: PacoteEmbrioes;
  embrioesSelecionados: Set<string>;
  paginaAtual: number;
  pageSize: number;
  totalSelecionados: number;
  getClassificacaoAtual: (e: EmbrioCompleto) => string;
  onToggleSelecionarEmbriao: (id: string) => void;
  onSelecionarTodosDaPagina: (embrioes: EmbrioCompleto[]) => void;
  onSetPagina: (p: number) => void;
  onClassificar: (e: EmbrioCompleto) => void;
  onCongelar: (e: EmbrioCompleto) => void;
  onDescartar: (e: EmbrioCompleto) => void;
  onToggleEstrela?: (e: EmbrioCompleto) => void;
}

export function PacoteEmbrioesTable({
  pacote,
  embrioesSelecionados,
  paginaAtual,
  pageSize,
  totalSelecionados,
  getClassificacaoAtual,
  onToggleSelecionarEmbriao,
  onSelecionarTodosDaPagina,
  onSetPagina,
  onClassificar,
  onCongelar,
  onDescartar,
  onToggleEstrela,
}: PacoteEmbrioesTableProps) {
  const [expandedScoreId, setExpandedScoreId] = useState<string | null>(null);
  const [redetectProgress, setRedetectProgress] = useState<{ id: string; step: number; label: string } | null>(null);
  const [redetectedMap, setRedetectedMap] = useState<Map<string, number>>(new Map());
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const retryAnalysis = useRetryAnalysis();
  const cancelAnalysis = useCancelAnalysis();
  const { toast } = useToast();

  // Polling forçado de scores enquanto houver embriões redetectados aguardando novo score
  const redetectedMapRef = useRef(redetectedMap);
  redetectedMapRef.current = redetectedMap;
  const completionHandledRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (redetectedMap.size === 0) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['embryo-scores-batch'] });
      queryClient.invalidateQueries({ queryKey: ['embryo-analysis-status-batch'] });
    }, 5000);
    return () => clearInterval(interval);
  }, [redetectedMap.size, queryClient]);

  // (detection cache removed — detection is now server-side)

  // Redetectar IA: buscar media → criar queue job (sem bboxes/crops) → invocar edge function (server-side detection)
  const handleRedetect = useCallback(async (embriao: EmbrioCompleto) => {
    if (!embriao.lote_fiv_acasalamento_id && !embriao.acasalamento_media_id) return;

    const TOTAL_STEPS = 3;
    const progress = (step: number, label: string) =>
      setRedetectProgress({ id: embriao.id, step, label });

    try {
      // 1. Buscar vídeo
      progress(1, 'Buscando vídeo...');
      let mediaData: { id: string; lote_fiv_acasalamento_id: string } | null = null;

      if (embriao.lote_fiv_acasalamento_id) {
        const { data } = await supabase
          .from('acasalamento_embrioes_media')
          .select('id, lote_fiv_acasalamento_id')
          .eq('lote_fiv_acasalamento_id', embriao.lote_fiv_acasalamento_id)
          .eq('tipo_media', 'VIDEO')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) mediaData = data;
      }

      if (!mediaData && embriao.acasalamento_media_id) {
        const { data } = await supabase
          .from('acasalamento_embrioes_media')
          .select('id, lote_fiv_acasalamento_id')
          .eq('id', embriao.acasalamento_media_id)
          .single();
        if (data) mediaData = data;
      }

      if (!mediaData) {
        toast({ title: 'Erro', description: 'Vídeo não encontrado.', variant: 'destructive' });
        return;
      }

      // Buscar expected count (irmãos no acasalamento)
      const acasId = mediaData.lote_fiv_acasalamento_id || embriao.lote_fiv_acasalamento_id;
      let expectedCount = 1;
      if (acasId) {
        const { count } = await supabase
          .from('embrioes')
          .select('*', { count: 'exact', head: true })
          .eq('lote_fiv_acasalamento_id', acasId);
        if (count && count > 0) expectedCount = count;
      }

      // 2. Reutilizar job ativo existente ou criar novo
      progress(2, 'Criando job de análise...');

      // Verificar se já existe job ativo para este vídeo (evita duplicatas)
      const { data: existingJob } = await supabase
        .from('embryo_analysis_queue')
        .select('id')
        .eq('media_id', mediaData.id)
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let queueId: string;

      if (existingJob) {
        queueId = existingJob.id;
        // Resetar job existente para pending (pode estar travado)
        const { error: resetError } = await supabase
          .from('embryo_analysis_queue')
          .update({
            status: 'pending',
            error_message: null,
            started_at: null,
            retry_count: 0,
            detected_bboxes: [] // Force re-detection logic in Edge Function
          })
          .eq('id', existingJob.id);
        if (resetError) { toast({ title: 'Erro ao resetar análise', variant: 'destructive' }); return; }
      } else {
        const { data: queueData, error: queueError } = await supabase
          .from('embryo_analysis_queue')
          .insert({
            media_id: mediaData.id,
            lote_fiv_acasalamento_id: embriao.lote_fiv_acasalamento_id,
            status: 'pending',
            expected_count: expectedCount,
            detected_bboxes: [],
          })
          .select('id')
          .single();

        if (queueError || !queueData) {
          toast({ title: 'Erro', description: 'Falha ao criar job de análise.', variant: 'destructive' });
          return;
        }
        queueId = queueData.id;
      }

      // Vincular TODOS os embriões do acasalamento ao queue_id (matching por índice na Edge Function)
      const acasIdForUpdate = mediaData.lote_fiv_acasalamento_id || embriao.lote_fiv_acasalamento_id;
      if (acasIdForUpdate) {
        const updateFields: Record<string, unknown> = { queue_id: queueId };
        if (mediaData.id !== embriao.acasalamento_media_id) {
          updateFields.acasalamento_media_id = mediaData.id;
        }
        const { error: linkError } = await supabase
          .from('embrioes')
          .update(updateFields)
          .eq('lote_fiv_acasalamento_id', acasIdForUpdate);
        if (linkError) { toast({ title: 'Erro ao vincular embriões', variant: 'destructive' }); return; }
      } else {
        const { error: linkError } = await supabase
          .from('embrioes')
          .update({ queue_id: queueId })
          .eq('id', embriao.id);
        if (linkError) { toast({ title: 'Erro ao vincular embrião', variant: 'destructive' }); return; }
      }

      // 3. Invocar Edge Function com retry
      progress(3, 'Iniciando análise IA...');
      let invokeOk = false;
      for (let attempt = 0; attempt < 3 && !invokeOk; attempt++) {
        try {
          const { data: fnData, error: fnError } = await supabase.functions.invoke('embryo-analyze', {
            body: { queue_id: queueId },
          });
          if (fnError) {
            // Capturar body real do erro da Edge Function
            let errorBody = '';
            try {
              if (fnError && typeof fnError === 'object' && 'context' in fnError) {
                const ctx = (fnError as { context: Response }).context;
                errorBody = await ctx.text();
              }
            } catch { /* ignore */ }
            console.error(`[Redetect] Edge Function error body:`, errorBody || fnData);
            throw fnError;
          }
          invokeOk = true;
        } catch (invokeErr) {
          console.warn(`[Redetect] invoke tentativa ${attempt + 1}/3 falhou:`, invokeErr);
          if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
        }
      }

      // Se falhou, buscar error_message da fila para diagnóstico
      if (!invokeOk) {
        const { data: failedJob } = await supabase
          .from('embryo_analysis_queue')
          .select('status, error_message, retry_count')
          .eq('id', queueId)
          .maybeSingle();
        console.error('[Redetect] Estado da fila após falha:', failedJob);
      }
      if (!invokeOk) {
        toast({ title: 'Erro', description: 'Falha ao invocar análise IA após 3 tentativas. Tente novamente.', variant: 'destructive' });
        return;
      }

      // Registrar como redetectado → suprime score antigo na UI + inicia polling forçado
      setRedetectedMap(prev => new Map(prev).set(embriao.id, Date.now()));
      queryClient.invalidateQueries({ queryKey: ['embryo-scores-batch'] });
      queryClient.invalidateQueries({ queryKey: ['embryo-analysis-status-batch'] });

      // Sucesso — barra some após 1.5s
      progress(TOTAL_STEPS, 'Análise IA em andamento');
      setTimeout(() => setRedetectProgress(prev => prev?.id === embriao.id ? null : prev), 1500);
      return;
    } catch (err: any) {
      console.error('[Redetect] Fatal Error:', err);
      toast({
        title: 'Erro na redetecção',
        description: err.message || 'Erro desconhecido ao invocar análise.',
        variant: 'destructive',
        duration: 5000
      });
    } finally {
      setRedetectProgress(prev => {
        if (!prev || prev.id !== embriao.id) return prev;
        if (prev.step >= TOTAL_STEPS) return prev;
        return null;
      });
    }
  }, [toast, queryClient]);

  // Após despacho, só permite descarte
  const jaFoiDespachado = pacote.disponivel_para_transferencia === true;
  const embrioesOrdenados = [...pacote.embrioes].sort((a, b) => {
    const idA = a.identificacao || '';
    const idB = b.identificacao || '';
    if (idA && idB) return idA.localeCompare(idB);
    if (idA && !idB) return -1;
    if (!idA && idB) return 1;
    return (a.created_at || '').localeCompare(b.created_at || '');
  });

  const totalPaginas = Math.max(1, Math.ceil(embrioesOrdenados.length / pageSize));
  const pagina = Math.min(paginaAtual, totalPaginas);
  const inicio = (pagina - 1) * pageSize;
  const embrioesPagina = embrioesOrdenados.slice(inicio, inicio + pageSize);
  const todosSelecionadosPagina = embrioesPagina.every((e) => embrioesSelecionados.has(e.id));
  const algunsSelecionadosPagina = embrioesPagina.some((e) => embrioesSelecionados.has(e.id));

  // EmbryoScore: buscar scores em batch para todos os embriões do pacote
  const allEmbriaoIds = embrioesOrdenados.map(e => e.id);
  const { data: scoresMap = {} } = useEmbryoScoresBatch(allEmbriaoIds);

  // Limpar redetectedMap quando novo score chegar (created_at > redetect timestamp)
  useEffect(() => {
    if (redetectedMap.size === 0) return;
    let changed = false;
    const next = new Map(redetectedMap);
    for (const [embId, redetectTime] of redetectedMap) {
      const score = scoresMap[embId];
      if (score?.created_at && new Date(score.created_at).getTime() > redetectTime) {
        next.delete(embId);
        changed = true;
      }
    }
    if (changed) setRedetectedMap(next);
  }, [scoresMap, redetectedMap]);

  // Helper: score efetivo (null se aguardando redetect)
  const getEffectiveScore = (embId: string) => {
    const redetectTime = redetectedMap.get(embId);
    if (!redetectTime) return scoresMap[embId] ?? null;
    const score = scoresMap[embId];
    // Score é novo (posterior ao redetect) → mostrar
    if (score?.created_at && new Date(score.created_at).getTime() > redetectTime) return score;
    // Score é antigo → suprimir
    return null;
  };

  // Acasalamentos com redetect em andamento (para evitar que irmãos mostrem barra de análise)
  const acasWithRedetect = new Set<string>();
  if (redetectedMap.size > 0) {
    for (const e of embrioesOrdenados) {
      if (redetectedMap.has(e.id) && e.lote_fiv_acasalamento_id) {
        acasWithRedetect.add(e.lote_fiv_acasalamento_id);
      }
    }
  }

  // Monitorar status da fila — embriões sem score efetivo (inclui redetectados)
  const acasalamentoIdsWithoutScore = embrioesOrdenados
    .filter(e => e.lote_fiv_acasalamento_id && !getEffectiveScore(e.id))
    .map(e => e.lote_fiv_acasalamento_id!);
  const { data: analysisStatusMap = {} } = useEmbryoAnalysisStatusBatch(acasalamentoIdsWithoutScore);

  // Quando qualquer análise completa, forçar refetch dos scores
  const prevStatusRef = useRef<Record<string, string>>({});
  useEffect(() => {
    const prevStatuses = prevStatusRef.current;
    let shouldRefetch = false;

    for (const [acasId, queue] of Object.entries(analysisStatusMap)) {
      const prevStatus = prevStatuses[acasId];
      if (queue.status === 'completed' && prevStatus && prevStatus !== 'completed') {
        shouldRefetch = true;
      }
      prevStatuses[acasId] = queue.status;
    }

    if (shouldRefetch) {
      // Refetch com pequeno delay para garantir que scores foram escritos no DB
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['embryo-scores-batch'] });
      }, 1000);
    }
  }, [analysisStatusMap, queryClient]);

  // Event-driven: quando análise completa para embrião redetectado, buscar score novo
  useEffect(() => {
    if (redetectedMap.size === 0) {
      completionHandledRef.current.clear();
      return;
    }

    for (const [embId, redetectTime] of redetectedMap) {
      if (completionHandledRef.current.has(embId)) continue;

      const embriao = pacote.embrioes.find(e => e.id === embId);
      if (!embriao?.lote_fiv_acasalamento_id) continue;

      const status = analysisStatusMap[embriao.lote_fiv_acasalamento_id];
      if (status?.status === 'completed' && status.completed_at) {
        const completedAt = new Date(status.completed_at).getTime();
        if (completedAt > redetectTime) {
          completionHandledRef.current.add(embId);
          queryClient.refetchQueries({ queryKey: ['embryo-scores-batch'] });
          return;
        }
      }
    }
  }, [analysisStatusMap, redetectedMap, pacote.embrioes, queryClient]);

  return (
    <div className="space-y-3">
      {/* Header com seleção e paginação */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-border">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSelecionarTodosDaPagina(embrioesPagina)}
            className="h-8 px-2"
          >
            {todosSelecionadosPagina ? (
              <CheckSquare className="w-4 h-4 text-primary" />
            ) : (
              <Square className="w-4 h-4 text-muted-foreground" />
            )}
            <span className="ml-2 text-xs">
              {todosSelecionadosPagina ? 'Desmarcar' : 'Selecionar página'}
            </span>
          </Button>
          {(algunsSelecionadosPagina || totalSelecionados > 0) && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
              {embrioesPagina.filter((e) => embrioesSelecionados.has(e.id)).length} selecionados
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>{embrioesOrdenados.length} embriões</span>
          <span className="mx-1">•</span>
          <span>Pág. {pagina}/{totalPaginas}</span>
        </div>
      </div>

      {/* Lista de embriões - Desktop/Tablet (md+) */}
      <div className="hidden md:grid gap-2">
        {embrioesPagina.map((embriao, index) => {
          const selecionado = embrioesSelecionados.has(embriao.id);
          const classificacao = getClassificacaoAtual(embriao);
          const isFresco = embriao.status_atual === 'FRESCO';
          const isCongelado = embriao.status_atual === 'CONGELADO';
          const score = getEffectiveScore(embriao.id);
          const analysisStatus = embriao.lote_fiv_acasalamento_id
            ? analysisStatusMap[embriao.lote_fiv_acasalamento_id]
            : undefined;

          return (
            <div
              key={embriao.id}
              className={`
                group relative flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border transition-all
                ${selecionado
                  ? 'bg-primary-subtle border-primary/30 shadow-sm'
                  : 'bg-card border-border hover:border-primary/30 hover:shadow-sm'
                }
              `}
            >
              {/* Checkbox + Código */}
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => onToggleSelecionarEmbriao(embriao.id)}
                  className="flex-shrink-0 p-1 rounded hover:bg-muted"
                  aria-label="Selecionar embrião"
                >
                  {selecionado ? (
                    <CheckSquare className="w-5 h-5 text-primary" />
                  ) : (
                    <Square className="w-5 h-5 text-muted-foreground/50 group-hover:text-muted-foreground" />
                  )}
                </button>
                <div className="flex flex-col min-w-0">
                  {embriao.identificacao ? (
                    <span className="font-mono text-sm font-medium text-foreground truncate">
                      {embriao.identificacao}
                    </span>
                  ) : (
                    <span className="text-sm text-amber-600 dark:text-amber-400 italic" title="Embrião sem código de rastreabilidade">
                      Sem código
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground sm:hidden">
                    {embriao.doadora_registro || '-'} × {embriao.touro_nome || '-'}
                  </span>
                </div>
              </div>

              {/* Info principal - Desktop */}
              <div className="hidden sm:flex flex-1 items-center gap-4 min-w-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-foreground truncate" title={embriao.doadora_registro || '-'}>
                      {embriao.doadora_registro || '-'}
                    </span>
                    <span className="text-muted-foreground">×</span>
                    <span className="text-foreground truncate" title={embriao.touro_nome || '-'}>
                      {embriao.touro_nome || '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Badges e Status */}
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                {embriao.estrela && (
                  <div title="Embrião Top">
                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  </div>
                )}
                {classificacao ? (
                  <Badge
                    variant="outline"
                    className="bg-primary-subtle text-primary-subtle-foreground border-primary/30 text-xs"
                  >
                    {classificacao}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground border-dashed text-xs">
                    Sem classificação
                  </Badge>
                )}
                {/* EmbryoScore badge */}
                {score ? (
                  <button
                    onClick={() => setExpandedScoreId(expandedScoreId === embriao.id ? null : embriao.id)}
                    className="flex items-center gap-0.5"
                    aria-label="Ver detalhes do score"
                  >
                    <EmbryoScoreBadge score={score} compact />
                    {classificacao && getDiscrepancy(classificacao, score.gemini_classification) && (
                      <AlertTriangle className="w-3 h-3 text-amber-500" />
                    )}
                  </button>
                ) : null}
                <StatusBadge status={embriao.status_atual} />
                {embriao.localizacao_atual && (
                  <Badge variant="outline" className="bg-secondary text-secondary-foreground border-primary/20 text-xs hidden lg:inline-flex">
                    {embriao.localizacao_atual}
                  </Badge>
                )}
              </div>

              {/* Actions (View Only) */}
              <div className="flex items-center gap-1 sm:ml-2">
                {score && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedScoreId(expandedScoreId === embriao.id ? null : embriao.id)}
                    className={`h-8 w-8 p-0 ${expandedScoreId === embriao.id ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-primary hover:bg-primary/5'}`}
                    title="Ver análise detalhada"
                    aria-label="Ver análise detalhada"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {/* EmbryoScore expandido */}
              {expandedScoreId === embriao.id && score && (
                <div className="col-span-full mt-2 sm:ml-8">
                  <EmbryoScoreCard
                    score={score}
                    allScores={Object.values(scoresMap)}
                    defaultExpanded
                    classificacaoManual={classificacao || undefined}
                  />
                </div>
              )}

              {/* Barra de redetecção inline */}
              {redetectProgress?.id === embriao.id && (
                <div className="mt-2 -mx-3 -mb-3 px-3 py-1.5 rounded-b-lg bg-violet-500/5 border-t border-violet-500/20">
                  <div className="h-1 rounded-full overflow-hidden mb-1 bg-violet-500/10">
                    <div
                      className="h-full bg-violet-500/60 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${(redetectProgress.step / 3) * 100}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ScanSearch className="w-3 h-3 text-violet-500 animate-pulse" />
                    <span className="text-[10px] text-violet-600 dark:text-violet-400 font-medium">
                      {redetectProgress.label}
                    </span>
                    <span className="text-[10px] text-violet-500/50 ml-auto">
                      {redetectProgress.step}/3
                    </span>
                  </div>
                </div>
              )}

              {/* Barra de análise IA no rodapé do card */}
              {redetectProgress?.id !== embriao.id && !score && analysisStatus?.status && ['pending', 'processing', 'failed'].includes(analysisStatus.status) && (redetectedMap.has(embriao.id) || !acasWithRedetect.has(embriao.lote_fiv_acasalamento_id || '')) && (
                <EmbryoAnalysisBar
                  status={analysisStatus.status as 'pending' | 'processing' | 'failed'}
                  startedAt={analysisStatus.started_at}
                  retryCount={analysisStatus.retry_count}
                  onRetry={analysisStatus.status === 'failed' ? () => retryAnalysis.mutate(analysisStatus.id) : undefined}
                  onCancel={analysisStatus.status !== 'failed' ? () => cancelAnalysis.mutate(analysisStatus.id) : undefined}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Lista de embriões - Mobile (< md) */}
      <div className="md:hidden space-y-2">
        {embrioesPagina.map((embriao) => {
          const selecionado = embrioesSelecionados.has(embriao.id);
          const classificacao = getClassificacaoAtual(embriao);
          const isFresco = embriao.status_atual === 'FRESCO';
          const score = getEffectiveScore(embriao.id);
          const analysisStatus = embriao.lote_fiv_acasalamento_id
            ? analysisStatusMap[embriao.lote_fiv_acasalamento_id]
            : undefined;

          return (
            <div
              key={embriao.id}
              className={`
                rounded-lg border p-3 transition-all
                ${selecionado
                  ? 'bg-primary-subtle border-primary/30 shadow-sm'
                  : 'bg-card border-border'
                }
              `}
            >
              {/* Linha 1: Checkbox + Código + Badges */}
              <div className="flex items-start gap-3">
                {/* Checkbox - 44x44px touch target */}
                <button
                  onClick={() => onToggleSelecionarEmbriao(embriao.id)}
                  className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded hover:bg-muted active:bg-muted/80"
                >
                  {selecionado ? (
                    <CheckSquare className="w-5 h-5 text-primary" />
                  ) : (
                    <Square className="w-5 h-5 text-muted-foreground/50" />
                  )}
                </button>

                {/* Código + Badges */}
                <div className="flex-1 min-w-0 space-y-2">
                  {/* Código */}
                  <div>
                    {embriao.identificacao ? (
                      <span className="font-mono text-sm font-medium text-foreground">
                        {embriao.identificacao}
                      </span>
                    ) : (
                      <span className="text-sm text-amber-600 dark:text-amber-400 italic">
                        Sem código
                      </span>
                    )}
                  </div>

                  {/* Badges linha */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {embriao.estrela && (
                      <Star className="w-4 h-4 text-amber-500 fill-amber-500 flex-shrink-0" />
                    )}
                    {classificacao ? (
                      <Badge
                        variant="outline"
                        className="bg-primary-subtle text-primary-subtle-foreground border-primary/30 text-xs"
                      >
                        {classificacao}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground border-dashed text-xs">
                        Sem class.
                      </Badge>
                    )}
                    {score ? (
                      <div className="flex items-center gap-1">
                        <EmbryoScoreBadge score={score} compact />
                        {classificacao && getDiscrepancy(classificacao, score.gemini_classification) && (
                          <AlertTriangle className="w-3 h-3 text-amber-500" />
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Menu ações - 44x44px touch target */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded hover:bg-muted active:bg-muted/80" aria-label="Mais opções">
                      <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {score && (
                      <>
                        <DropdownMenuItem onClick={() => setExpandedScoreId(expandedScoreId === embriao.id ? null : embriao.id)}>
                          <Brain className="w-4 h-4 mr-2 text-primary" />
                          {expandedScoreId === embriao.id ? 'Fechar análise IA' : 'Ver análise IA'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}

                    {/* Revisar embriões */}
                    {embriao.queue_id && score && (
                      <DropdownMenuItem onClick={() => navigate(`/embryoscore/review/${embriao.queue_id}`)}>
                        <Eye className="w-4 h-4 mr-2 text-green-500" />
                        Revisar embriões
                      </DropdownMenuItem>
                    )}

                    {/* Redetectar IA */}
                    {embriao.acasalamento_media_id && (
                      <DropdownMenuItem
                        onClick={() => handleRedetect(embriao)}
                        disabled={redetectProgress?.id === embriao.id}
                      >
                        <ScanSearch className={`w-4 h-4 mr-2 text-violet-500 ${redetectProgress?.id === embriao.id ? 'animate-pulse' : ''}`} />
                        {redetectProgress?.id === embriao.id ? 'Redetectando...' : 'Redetectar IA'}
                      </DropdownMenuItem>
                    )}

                    {/* Reanalisar IA */}
                    {embriao.queue_id && analysisStatus?.status === 'failed' && (
                      <DropdownMenuItem
                        onClick={() => retryAnalysis.mutate(embriao.queue_id!)}
                        disabled={retryAnalysis.isPending}
                      >
                        <RefreshCw className={`w-4 h-4 mr-2 text-amber-500 ${retryAnalysis.isPending ? 'animate-spin' : ''}`} />
                        Reanalisar IA
                      </DropdownMenuItem>
                    )}

                    {(embriao.acasalamento_media_id || (embriao.queue_id && analysisStatus?.status === 'failed')) && (
                      <DropdownMenuSeparator />
                    )}

                    {!jaFoiDespachado && (
                      <>
                        <DropdownMenuItem onClick={() => onClassificar(embriao)}>
                          <Tag className="w-4 h-4 mr-2 text-primary" />
                          Classificar
                        </DropdownMenuItem>

                        {isFresco && (
                          <DropdownMenuItem
                            onClick={() => onCongelar(embriao)}
                            disabled={!classificacao}
                            className={!classificacao ? 'opacity-50' : ''}
                          >
                            <Snowflake className="w-4 h-4 mr-2 text-blue-500" />
                            Congelar
                            {!classificacao && <span className="ml-auto text-xs text-muted-foreground">Class. 1º</span>}
                          </DropdownMenuItem>
                        )}

                        {onToggleEstrela && (
                          <DropdownMenuItem onClick={() => onToggleEstrela(embriao)}>
                            <Star className={`w-4 h-4 mr-2 ${embriao.estrela ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground'}`} />
                            {embriao.estrela ? 'Remover estrela' : 'Marcar Top'}
                          </DropdownMenuItem>
                        )}

                        <DropdownMenuSeparator />
                      </>
                    )}

                    <DropdownMenuItem
                      onClick={() => onDescartar(embriao)}
                      className="text-destructive focus:text-destructive focus:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Descartar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Linha 2: Estágio/Grau + Status */}
              <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                <div className="text-muted-foreground truncate flex items-center gap-1.5">
                  {score?.stage_code != null && (
                    <span>{STAGE_LABELS[score.stage_code] || `Est. ${score.stage_code}`}</span>
                  )}
                  {score?.stage_code != null && score?.quality_grade != null && (
                    <span className="text-muted-foreground/50">·</span>
                  )}
                  {score?.quality_grade != null && (
                    <span>Grau {score.quality_grade}</span>
                  )}
                  {!score?.stage_code && !score?.quality_grade && (
                    <span>{embriao.doadora_registro || '-'} × {embriao.touro_nome || '-'}</span>
                  )}
                </div>
                <StatusBadge status={embriao.status_atual} />
              </div>

              {/* Linha 3: Cruzamento (se estágio/grau já mostrados) */}
              {(score?.stage_code != null || score?.quality_grade != null) && (
                <div className="mt-1 text-xs text-muted-foreground truncate">
                  {embriao.doadora_registro || '-'} × {embriao.touro_nome || '-'}
                </div>
              )}

              {/* Barra de redetecção inline */}
              {redetectProgress?.id === embriao.id && (
                <div className="mt-2 -mx-3 -mb-3 px-3 py-1.5 rounded-b-lg bg-violet-500/5 border-t border-violet-500/20">
                  <div className="h-1 rounded-full overflow-hidden mb-1 bg-violet-500/10">
                    <div
                      className="h-full bg-violet-500/60 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${(redetectProgress.step / 3) * 100}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ScanSearch className="w-3 h-3 text-violet-500 animate-pulse" />
                    <span className="text-[10px] text-violet-600 dark:text-violet-400 font-medium">
                      {redetectProgress.label}
                    </span>
                    <span className="text-[10px] text-violet-500/50 ml-auto">
                      {redetectProgress.step}/3
                    </span>
                  </div>
                </div>
              )}

              {/* Barra de análise IA no rodapé do card */}
              {redetectProgress?.id !== embriao.id && !score && analysisStatus?.status && ['pending', 'processing', 'failed'].includes(analysisStatus.status) && (redetectedMap.has(embriao.id) || !acasWithRedetect.has(embriao.lote_fiv_acasalamento_id || '')) && (
                <EmbryoAnalysisBar
                  status={analysisStatus.status as 'pending' | 'processing' | 'failed'}
                  startedAt={analysisStatus.started_at}
                  retryCount={analysisStatus.retry_count}
                  onRetry={analysisStatus.status === 'failed' ? () => retryAnalysis.mutate(analysisStatus.id) : undefined}
                  onCancel={analysisStatus.status !== 'failed' ? () => cancelAnalysis.mutate(analysisStatus.id) : undefined}
                />
              )}

              {/* EmbryoScore expandido */}
              {expandedScoreId === embriao.id && score && (
                <div className="mt-3 pt-3 border-t border-border">
                  <EmbryoScoreCard
                    score={score}
                    allScores={Object.values(scoresMap)}
                    defaultExpanded
                    classificacaoManual={classificacao || undefined}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Paginação */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <span className="text-xs text-muted-foreground">
            Mostrando {inicio + 1}-{Math.min(inicio + pageSize, embrioesOrdenados.length)} de {embrioesOrdenados.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSetPagina(Math.max(1, pagina - 1))}
              disabled={pagina === 1}
              className="h-8 w-8 p-0"
              aria-label="Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            {/* Números de página */}
            <div className="hidden sm:flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
                let pageNum: number;
                if (totalPaginas <= 5) {
                  pageNum = i + 1;
                } else if (pagina <= 3) {
                  pageNum = i + 1;
                } else if (pagina >= totalPaginas - 2) {
                  pageNum = totalPaginas - 4 + i;
                } else {
                  pageNum = pagina - 2 + i;
                }

                return (
                  <Button
                    key={pageNum}
                    variant={pagina === pageNum ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => onSetPagina(pageNum)}
                    className="h-8 w-8 p-0 text-xs"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onSetPagina(Math.min(totalPaginas, pagina + 1))}
              disabled={pagina === totalPaginas}
              className="h-8 w-8 p-0"
              aria-label="Próximo"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
