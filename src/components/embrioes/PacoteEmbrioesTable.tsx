import { useState, useCallback } from 'react';
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
  ScanSearch,
} from 'lucide-react';
import type { EmbrioCompleto, PacoteEmbrioes } from '@/hooks/embrioes';

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
  const [redetecting, setRedetecting] = useState<string | null>(null);
  const retryAnalysis = useRetryAnalysis();
  const cancelAnalysis = useCancelAnalysis();
  const { toast } = useToast();

  // Redetectar IA: baixar video → OpenCV → novo crop → criar queue → invocar edge function
  const handleRedetect = useCallback(async (embriao: EmbrioCompleto) => {
    const mediaId = embriao.acasalamento_media_id;
    if (!mediaId) return;

    setRedetecting(embriao.id);
    try {
      // 1. Buscar path do video no Storage
      const { data: mediaData } = await supabase
        .from('acasalamento_embrioes_media')
        .select('arquivo_path, lote_fiv_acasalamento_id')
        .eq('id', mediaId)
        .single();

      if (!mediaData?.arquivo_path) {
        toast({ title: 'Erro', description: 'Video nao encontrado no Storage.', variant: 'destructive' });
        return;
      }

      // 2. Baixar video
      const { data: videoBlob } = await supabase.storage
        .from('embryo-videos')
        .download(mediaData.arquivo_path);

      if (!videoBlob) {
        toast({ title: 'Erro', description: 'Falha ao baixar video para redeteccao.', variant: 'destructive' });
        return;
      }

      // 3. Converter para File e rodar OpenCV
      const ext = mediaData.arquivo_path.split('.').pop() || 'mp4';
      const mimeType = ext === 'mov' ? 'video/quicktime' : ext === 'webm' ? 'video/webm' : 'video/mp4';
      const file = new File([videoBlob], `redetect.${ext}`, { type: mimeType });

      const { detectEmbryoCircles, isOpenCVAvailable, loadOpenCV } = await import('@/lib/embryoscore/detectCircles');
      if (!isOpenCVAvailable()) {
        toast({ title: 'Carregando OpenCV...', description: 'Aguarde alguns segundos.' });
        try {
          await loadOpenCV(20_000);
        } catch {
          toast({ title: 'OpenCV nao carregou', description: 'Falha ao carregar OpenCV. Tente novamente.', variant: 'destructive' });
          return;
        }
      }

      toast({ title: 'Redetectando...', description: 'Analisando video com OpenCV.' });
      const detection = await detectEmbryoCircles(file, 20);

      if (!detection.bboxes.length) {
        toast({ title: 'Nenhum embriao detectado', description: 'OpenCV nao encontrou circulos no video.', variant: 'destructive' });
        return;
      }

      // 4. Upload crops
      let cropPaths: string[] | null = null;
      if (detection.cropBlobs.length > 0) {
        const cropTimestamp = Date.now();
        const acId = mediaData.lote_fiv_acasalamento_id || embriao.lote_fiv_acasalamento_id;
        const uploadedPaths = await Promise.all(
          detection.cropBlobs.map(async (blob, i) => {
            const cropPath = `${embriao.lote_fiv_id}/${acId}/crops/${cropTimestamp}_${i}.jpg`;
            const { error: cropErr } = await supabase.storage
              .from('embryo-videos')
              .upload(cropPath, blob, { contentType: 'image/jpeg', upsert: false });
            if (cropErr) return null;
            return cropPath;
          })
        );
        const validPaths = uploadedPaths.filter((p): p is string => p !== null);
        cropPaths = validPaths.length > 0 ? validPaths : null;
      }

      // 5. Criar queue entry para este embriao
      const { data: queueData, error: queueError } = await supabase
        .from('embryo_analysis_queue')
        .insert({
          media_id: mediaId,
          lote_fiv_acasalamento_id: embriao.lote_fiv_acasalamento_id,
          status: 'pending',
          detected_bboxes: detection.bboxes,
          detection_confidence: detection.confidence,
          expected_count: 1,
          crop_paths: cropPaths,
        })
        .select('id')
        .single();

      if (queueError) {
        toast({ title: 'Erro', description: 'Falha ao criar job de analise.', variant: 'destructive' });
        return;
      }

      // 6. Vincular queue_id ao embriao
      await supabase
        .from('embrioes')
        .update({ queue_id: queueData.id })
        .eq('id', embriao.id);

      // 7. Invocar Edge Function
      supabase.functions.invoke('embryo-analyze', {
        body: { queue_id: queueData.id },
      }).catch((err: unknown) => {
        console.warn('EmbryoScore: falha ao invocar analise:', err);
      });

      toast({ title: 'Redeteccao iniciada', description: `${detection.bboxes.length} embriao(es) detectado(s). Analise IA em andamento.` });
    } catch (err) {
      console.error('[Redetect]', err);
      toast({ title: 'Erro na redeteccao', description: err instanceof Error ? err.message : 'Erro desconhecido', variant: 'destructive' });
    } finally {
      setRedetecting(null);
    }
  }, [toast]);

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

  // Monitorar status da fila por acasalamento_id (batch) — apenas embriões sem score
  const acasalamentoIdsWithoutScore = embrioesOrdenados
    .filter(e => e.lote_fiv_acasalamento_id && !scoresMap[e.id])
    .map(e => e.lote_fiv_acasalamento_id!);
  const { data: analysisStatusMap = {} } = useEmbryoAnalysisStatusBatch(acasalamentoIdsWithoutScore);

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
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" title="Embrião Top" />
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
                {scoresMap[embriao.id] ? (
                  <button
                    onClick={() => setExpandedScoreId(expandedScoreId === embriao.id ? null : embriao.id)}
                    className="flex items-center gap-0.5"
                  >
                    <EmbryoScoreBadge score={scoresMap[embriao.id]} compact />
                    {classificacao && getDiscrepancy(classificacao, scoresMap[embriao.id].embryo_score) && (
                      <AlertTriangle className="w-3 h-3 text-amber-500" title="Divergência IA vs Biólogo" />
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

              {/* Menu de ações */}
              <div className="flex items-center gap-1 sm:ml-2">
                {/* Botão expandir score (se tiver) */}
                {scoresMap[embriao.id] && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedScoreId(expandedScoreId === embriao.id ? null : embriao.id)}
                    className={`h-8 w-8 p-0 ${expandedScoreId === embriao.id ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-primary hover:bg-primary/5'}`}
                    title="Ver análise IA"
                  >
                    <Brain className="w-4 h-4" />
                  </Button>
                )}

                {/* Ações rápidas visíveis - desabilitadas após despacho */}
                {!jaFoiDespachado && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onClassificar(embriao)}
                      className="h-8 w-8 p-0 text-primary hover:text-primary-dark hover:bg-primary-subtle"
                      title="Classificar"
                    >
                      <Tag className="w-4 h-4" />
                    </Button>

                    {isFresco && classificacao && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onCongelar(embriao)}
                        className="h-8 w-8 p-0 text-blue-500 hover:text-blue-600 hover:bg-secondary"
                        title="Congelar"
                      >
                        <Snowflake className="w-4 h-4" />
                      </Button>
                    )}
                  </>
                )}

                {/* Menu dropdown para mais ações */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {scoresMap[embriao.id] && (
                      <>
                        <DropdownMenuItem onClick={() => setExpandedScoreId(expandedScoreId === embriao.id ? null : embriao.id)}>
                          <Brain className="w-4 h-4 mr-2 text-primary" />
                          {expandedScoreId === embriao.id ? 'Fechar análise IA' : 'Ver análise IA'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}

                    {/* Redetectar IA: disponível quando embrião tem vídeo vinculado */}
                    {embriao.acasalamento_media_id && (
                      <DropdownMenuItem
                        onClick={() => handleRedetect(embriao)}
                        disabled={redetecting === embriao.id}
                      >
                        <ScanSearch className={`w-4 h-4 mr-2 text-violet-500 ${redetecting === embriao.id ? 'animate-pulse' : ''}`} />
                        {redetecting === embriao.id ? 'Redetectando...' : 'Redetectar IA'}
                      </DropdownMenuItem>
                    )}

                    {/* Reanalisar IA: disponível quando análise falhou */}
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
                            {!classificacao && <span className="ml-auto text-xs text-muted-foreground">Classificar primeiro</span>}
                          </DropdownMenuItem>
                        )}

                        {onToggleEstrela && (
                          <DropdownMenuItem onClick={() => onToggleEstrela(embriao)}>
                            <Star className={`w-4 h-4 mr-2 ${embriao.estrela ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground'}`} />
                            {embriao.estrela ? 'Remover estrela' : 'Marcar como Top'}
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

              {/* EmbryoScore expandido */}
              {expandedScoreId === embriao.id && scoresMap[embriao.id] && (
                <div className="col-span-full mt-2 sm:ml-8">
                  <EmbryoScoreCard
                    score={scoresMap[embriao.id]}
                    allScores={Object.values(scoresMap)}
                    defaultExpanded
                    classificacaoManual={classificacao || undefined}
                  />
                </div>
              )}

              {/* Barra de análise IA no rodapé do card */}
              {!scoresMap[embriao.id] && analysisStatus?.status && ['pending', 'processing', 'failed'].includes(analysisStatus.status) && (
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
          const score = scoresMap[embriao.id];
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
                        {classificacao && getDiscrepancy(classificacao, score.embryo_score) && (
                          <AlertTriangle className="w-3 h-3 text-amber-500" />
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Menu ações - 44x44px touch target */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded hover:bg-muted active:bg-muted/80">
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

                    {/* Redetectar IA */}
                    {embriao.acasalamento_media_id && (
                      <DropdownMenuItem
                        onClick={() => handleRedetect(embriao)}
                        disabled={redetecting === embriao.id}
                      >
                        <ScanSearch className={`w-4 h-4 mr-2 text-violet-500 ${redetecting === embriao.id ? 'animate-pulse' : ''}`} />
                        {redetecting === embriao.id ? 'Redetectando...' : 'Redetectar IA'}
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

              {/* Linha 2: Info + Status */}
              <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                <div className="text-muted-foreground truncate">
                  {score?.stage || 'Estágio desconhecido'} | {score?.recommendation || 'Sem recomendação'}
                </div>
                <StatusBadge status={embriao.status_atual} />
              </div>

              {/* Linha 3 (opcional): Cruzamento */}
              <div className="mt-1 text-xs text-muted-foreground truncate">
                {embriao.doadora_registro || '-'} × {embriao.touro_nome || '-'}
              </div>

              {/* Barra de análise IA no rodapé do card */}
              {!score && analysisStatus?.status && ['pending', 'processing', 'failed'].includes(analysisStatus.status) && (
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
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
