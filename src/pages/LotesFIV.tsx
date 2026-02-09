import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { DoseSemen } from '@/lib/types';
import { AcasalamentoComNomes, LoteFIVComNomes, PacoteComNomes } from '@/lib/types/lotesFiv';
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
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { useToast } from '@/hooks/use-toast';
import { useLotesFiltros } from '@/hooks/useLotesFiltros';
import { useLotesFIVData } from '@/hooks/useLotesFIVData';
import { Eye, X, Filter, Calendar, ChevronRight } from 'lucide-react';
import { formatDate, extractDateOnly, diffDays, getTodayDateString } from '@/lib/utils';
import { loadOpenCV } from '@/lib/embryoscore/detectCircles';
import { getNomeDia, getCorDia } from '@/lib/lotesFivUtils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NovoLoteDialog } from '@/components/lotes/NovoLoteDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { LoteDetailView, AcasalamentoForm } from '@/components/lotes/LoteDetailView';
import { LotesHistoricoTab } from '@/components/lotes/LotesHistoricoTab';
import { carregarFiltrosLotesFiv } from '@/lib/lotesFivUtils';

export default function LotesFIV() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Estados locais (não movidos para o hook)
  const [submitting, setSubmitting] = useState(false);
  const [showDespachoSemVideoWarning, setShowDespachoSemVideoWarning] = useState(false);
  const [showDespachoSemBboxWarning, setShowDespachoSemBboxWarning] = useState(false);
  const [acsSemVideoNomes, setAcsSemVideoNomes] = useState<string[]>([]);
  const [editQuantidadeEmbrioes, setEditQuantidadeEmbrioes] = useState<{ [key: string]: string }>({});
  const [editClivados, setEditClivados] = useState<{ [key: string]: string }>({});
  const [editOocitos, setEditOocitos] = useState<{ [key: string]: string }>({});
  const [videoMediaIds, setVideoMediaIds] = useState<{ [acasalamentoId: string]: string[] }>({});
  const [videoDetections, setVideoDetections] = useState<{
    [acasalamentoId: string]: Array<{
      mediaId: string;
      bboxes: import('@/lib/types').DetectedBbox[];
      confidence: 'high' | 'medium' | 'low';
      cropPaths?: string[] | null;
    }>;
  }>({});

  // Estado local de paginação do histórico para quebrar dependência circular
  const [historicoPageLocal, setHistoricoPageLocal] = useState<number>(() => {
    const filtrosPersistidos = carregarFiltrosLotesFiv();
    return filtrosPersistidos.historicoPage ?? 1;
  });

  // Callback estável para setHistoricoPage
  const handleSetHistoricoPage = useCallback((page: number) => {
    setHistoricoPageLocal(page);
  }, []);

  // Hook de filtros - chamado UMA ÚNICA VEZ com valores iniciais vazios
  // Os dados serão passados depois que carregarem
  const {
    filtroFazendaAspiracao,
    setFiltroFazendaAspiracao,
    filtroFazendaAspiracaoBusca,
    setFiltroFazendaAspiracaoBusca,
    filtroDiaCultivo,
    setFiltroDiaCultivo,
    showFazendaBusca,
    setShowFazendaBusca,
    filtroHistoricoDataInicio,
    setFiltroHistoricoDataInicio,
    filtroHistoricoDataFim,
    setFiltroHistoricoDataFim,
    filtroHistoricoFazenda,
    setFiltroHistoricoFazenda,
    filtroHistoricoFazendaBusca,
    setFiltroHistoricoFazendaBusca,
    showFazendaBuscaHistorico,
    setShowFazendaBuscaHistorico,
    abaAtiva,
    setAbaAtiva,
    HISTORICO_PAGE_SIZE,
  } = useLotesFiltros({
    lotes: [],
    pacotesParaFiltro: [],
    fazendasAspiracaoUnicas: [],
    lotesHistoricos: [],
  });

  // Hook de dados (gerencia carregamento e estados de dados)
  const {
    lotes,
    pacotes,
    fazendas,
    doadoras,
    clientes,
    loading,
    selectedLote,
    setSelectedLote,
    showLoteDetail,
    setShowLoteDetail,
    acasalamentos,
    fazendasDestinoIds,
    historicoDespachos,
    setHistoricoDespachos,
    aspiracoesDisponiveis,
    dosesDisponiveis,
    fazendaOrigemNome,
    fazendasDestinoNomes,
    dosesDisponiveisNoLote,
    dataAspiracao,
    pacotesParaFiltro,
    fazendasAspiracaoUnicas,
    lotesHistoricos,
    loadingHistorico,
    loteExpandido,
    detalhesLoteExpandido,
    loadingDetalhes,
    loadData,
    loadLoteDetail,
    loadLotesHistoricos,
    handleExpandirLote,
  } = useLotesFIVData({
    id,
    filtroHistoricoDataInicio,
    filtroHistoricoDataFim,
    filtroHistoricoFazenda,
    setHistoricoPage: handleSetHistoricoPage,
  });

  // Computar lotes filtrados e fazendas filtradas com os dados carregados
  const lotesFiltrados = useLotesFiltradosComputed(lotes, pacotesParaFiltro, filtroFazendaAspiracao, filtroDiaCultivo);
  const fazendasFiltradas = useFazendasFiltradasComputed(fazendasAspiracaoUnicas, filtroFazendaAspiracaoBusca);

  // Limpar filtros ativos
  const limparFiltrosAtivos = useCallback(() => {
    setFiltroFazendaAspiracao('');
    setFiltroFazendaAspiracaoBusca('');
    setFiltroDiaCultivo('');
    setShowFazendaBusca(false);
  }, [setFiltroFazendaAspiracao, setFiltroFazendaAspiracaoBusca, setFiltroDiaCultivo, setShowFazendaBusca]);

  // Usar o estado local de paginação
  const historicoPage = historicoPageLocal;
  const setHistoricoPage = handleSetHistoricoPage;

  // Pre-load OpenCV.js em background quando a página abre
  useEffect(() => {
    loadOpenCV().catch(() => {
      // Silencioso — será carregado sob demanda quando necessário
    });
  }, []);

  // Carregar vídeos existentes do banco quando o lote é selecionado
  useEffect(() => {
    if (!selectedLote || !showLoteDetail || acasalamentos.length === 0) return;

    const acIds = acasalamentos.map(ac => ac.id);

    (async () => {
      // Buscar vídeos já enviados para esses acasalamentos
      const { data: medias } = await supabase
        .from('acasalamento_embrioes_media')
        .select('id, lote_fiv_acasalamento_id')
        .in('lote_fiv_acasalamento_id', acIds)
        .eq('tipo_media', 'VIDEO')
        .order('created_at', { ascending: false });

      if (medias && medias.length > 0) {
        const ids: { [acId: string]: string[] } = {};
        for (const m of medias) {
          if (!ids[m.lote_fiv_acasalamento_id]) {
            ids[m.lote_fiv_acasalamento_id] = [];
          }
          ids[m.lote_fiv_acasalamento_id].push(m.id);
        }
        setVideoMediaIds(prev => ({ ...prev, ...ids }));
      }

      // Buscar detecções (bboxes) da fila de análise
      const { data: queues } = await supabase
        .from('embryo_analysis_queue')
        .select('lote_fiv_acasalamento_id, media_id, detected_bboxes, detection_confidence, crop_paths')
        .in('lote_fiv_acasalamento_id', acIds)
        .order('created_at', { ascending: false });

      if (queues && queues.length > 0) {
        const dets: typeof videoDetections = {};
        const seenMediaIds = new Set<string>();
        for (const q of queues) {
          if (!q.detected_bboxes || !q.media_id) continue;
          // Evitar duplicatas do mesmo media_id (pegar só o mais recente)
          if (seenMediaIds.has(q.media_id)) continue;
          seenMediaIds.add(q.media_id);

          if (!dets[q.lote_fiv_acasalamento_id]) {
            dets[q.lote_fiv_acasalamento_id] = [];
          }
          dets[q.lote_fiv_acasalamento_id].push({
            mediaId: q.media_id,
            bboxes: q.detected_bboxes,
            confidence: q.detection_confidence || 'medium',
            cropPaths: q.crop_paths || null,
          });
        }
        setVideoDetections(prev => ({ ...prev, ...dets }));
      }
    })();
  }, [selectedLote?.id, showLoteDetail, acasalamentos.length]);

  // Despachar embriões no D7
  const despacharEmbrioes = async () => {
    if (!selectedLote) return;

    try {
      setSubmitting(true);

      // Calcular dia atual para validar se ainda está no período permitido (até D8)
      const pacote = pacotes.find(p => p.id === selectedLote.pacote_aspiracao_id);
      let dataAspiracaoStr = extractDateOnly(pacote?.data_aspiracao || null);

      if (!dataAspiracaoStr) {
        const dataAberturaStr = extractDateOnly(selectedLote.data_abertura);
        if (dataAberturaStr) {
          const [year, month, day] = dataAberturaStr.split('-').map(Number);
          const dataAberturaDate = new Date(year, month - 1, day);
          dataAberturaDate.setDate(dataAberturaDate.getDate() - 1);
          const yearStr = dataAberturaDate.getFullYear();
          const monthStr = String(dataAberturaDate.getMonth() + 1).padStart(2, '0');
          const dayStr = String(dataAberturaDate.getDate()).padStart(2, '0');
          dataAspiracaoStr = `${yearStr}-${monthStr}-${dayStr}`;
        }
      }

      const hojeStr = getTodayDateString();
      const diaAtual = dataAspiracaoStr ? Math.max(0, diffDays(dataAspiracaoStr, hojeStr)) : 0;

      if (diaAtual > 9) {
        toast({
          title: 'Prazo expirado',
          description: 'D8 é o último dia. Não é possível criar embriões após o D8. O lote será fechado e não aparecerá mais na lista.',
          variant: 'destructive',
        });
        setSubmitting(false);
        return;
      }

      const acasalamentosComQuantidade = acasalamentos.filter(ac => {
        const quantidade = parseInt(editQuantidadeEmbrioes[ac.id] || '0');
        return quantidade > 0;
      });

      if (acasalamentosComQuantidade.length === 0) {
        toast({
          title: 'Nenhum embrião para despachar',
          description: 'Preencha a quantidade de embriões em pelo menos um acasalamento antes de despachar.',
          variant: 'destructive',
        });
        return;
      }

      for (const ac of acasalamentosComQuantidade) {
        const quantidade = parseInt(editQuantidadeEmbrioes[ac.id] || '0');
        const quantidadeOocitos = ac.quantidade_oocitos ?? 0;
        // Usa clivados como limite se preenchido, senão usa oócitos
        const clivadosEditado = editClivados[ac.id];
        const clivadosSalvo = ac.embrioes_clivados_d3;
        const clivadosNumero = parseInt(clivadosEditado ?? clivadosSalvo?.toString() ?? '') || 0;
        const limiteEmbrioes = clivadosNumero > 0 ? clivadosNumero : quantidadeOocitos;

        if (quantidade > limiteEmbrioes) {
          const doadoraNome = ac.doadora_nome || ac.doadora_registro || 'Doadora desconhecida';
          const tipoLimite = clivadosNumero > 0 ? 'clivados (D3)' : 'oócitos';
          toast({
            title: 'Validação de quantidade',
            description: `O acasalamento da doadora "${doadoraNome}" possui ${quantidade} embriões, mas o limite de ${tipoLimite} é ${limiteEmbrioes}. A quantidade de embriões não pode exceder esse limite.`,
            variant: 'destructive',
          });
          return;
        }
      }

      // Warning: acasalamentos SEM vídeo
      const acsSemVideo = acasalamentosComQuantidade.filter(ac => !videoMediaIds[ac.id]?.length);
      if (acsSemVideo.length > 0 && !showDespachoSemVideoWarning) {
        const nomes = acsSemVideo.map(ac => ac.doadora_nome || ac.doadora_registro || 'Doadora');
        setAcsSemVideoNomes(nomes);
        setShowDespachoSemVideoWarning(true);
        setSubmitting(false);
        return; // Pausa para confirmação do usuário
      }
      // Resetar flag se confirmou
      if (showDespachoSemVideoWarning) {
        setShowDespachoSemVideoWarning(false);
        setAcsSemVideoNomes([]);
      }

      // Warning: acasalamentos COM vídeo mas SEM bboxes detectadas
      const acsSemBboxes = acasalamentosComQuantidade.filter(ac => {
        const hasVideo = !!videoMediaIds[ac.id]?.length;
        const detections = videoDetections[ac.id] || [];
        const totalBboxes = detections.reduce((sum, d) => sum + (d.bboxes?.length || 0), 0);
        return hasVideo && totalBboxes === 0;
      });
      if (acsSemBboxes.length > 0 && !showDespachoSemBboxWarning) {
        const nomes = acsSemBboxes.map(ac => ac.doadora_nome || ac.doadora_registro || 'Doadora').join(', ');
        setAcsSemVideoNomes(nomes.split(', '));
        setShowDespachoSemBboxWarning(true);
        setSubmitting(false);
        return; // Pausa para confirmação do usuário
      }
      // Resetar flag se confirmou
      if (showDespachoSemBboxWarning) {
        setShowDespachoSemBboxWarning(false);
      }

      const nomePacote = `${fazendaOrigemNome} - ${fazendasDestinoNomes.join(', ')}`;
      const dataDespacho = new Date().toISOString().split('T')[0];

      if (!fazendasDestinoIds.length) {
        toast({
          title: 'Erro ao despachar',
          description: 'É necessário ter pelo menos uma fazenda destino configurada no lote.',
          variant: 'destructive',
        });
        return;
      }

      // Gerar prefixo de identificação para rastreabilidade
      let siglaFazenda = 'EMB'; // Fallback padrão
      const dataAsp = dataAspiracaoStr || '';
      const ddmm = dataAsp.slice(8, 10) + dataAsp.slice(5, 7);

      if (pacote?.fazenda_id) {
        const { data: fazendaOrigem, error: fazendaError } = await supabase
          .from('fazendas')
          .select('sigla, nome')
          .eq('id', pacote.fazenda_id)
          .single();

        if (!fazendaError && fazendaOrigem) {
          if (fazendaOrigem.sigla) {
            siglaFazenda = fazendaOrigem.sigla;
          } else if (fazendaOrigem.nome) {
            // Usar primeiras 3 letras do nome da fazenda como fallback
            siglaFazenda = fazendaOrigem.nome
              .replace(/[^a-zA-Z]/g, '')
              .substring(0, 3)
              .toUpperCase() || 'EMB';
          }
        }
      }

      const prefixoIdentificacao = `${siglaFazenda}-${ddmm}`;

      // Buscar próximo número sequencial
      let proximoNumero = 1;
      const { count, error: countError } = await supabase
        .from('embrioes')
        .select('*', { count: 'exact', head: true })
        .like('identificacao', `${prefixoIdentificacao}-%`);

      if (!countError && count !== null) {
        proximoNumero = count + 1;
      }

      const embrioesParaCriar: Array<{
        lote_fiv_id: string;
        lote_fiv_acasalamento_id: string;
        status_atual: string;
        identificacao: string;
      }> = [];
      const acasalamentosDespachados: Array<{ acasalamento_id: string; quantidade: number; doadora?: string; dose?: string }> = [];

      let contadorEmbriao = 0;
      for (const acasalamento of acasalamentosComQuantidade) {
        const quantidade = parseInt(editQuantidadeEmbrioes[acasalamento.id] || acasalamento.quantidade_embrioes?.toString() || '0');

        if (quantidade > 0) {
          for (let i = 0; i < quantidade; i++) {
            const numeroStr = String(proximoNumero + contadorEmbriao).padStart(3, '0');
            const embriao = {
              lote_fiv_id: selectedLote.id,
              lote_fiv_acasalamento_id: acasalamento.id,
              status_atual: 'FRESCO',
              identificacao: `${prefixoIdentificacao}-${numeroStr}`,
            };

            embrioesParaCriar.push(embriao);
            contadorEmbriao++;
          }

          acasalamentosDespachados.push({
            acasalamento_id: acasalamento.id,
            quantidade,
            doadora: acasalamento.doadora_registro || acasalamento.doadora_nome,
            dose: acasalamento.dose_nome,
          });
        }
      }

      // Guardar IDs dos embriões criados por acasalamento (para vincular media_id apenas nos novos)
      const embrioesIdsPorAcasalamento: { [acasalamentoId: string]: string[] } = {};

      if (embrioesParaCriar.length > 0) {
        const { data: embrioesInseridos, error: embrioesError } = await supabase
          .from('embrioes')
          .insert(embrioesParaCriar)
          .select('id, lote_fiv_acasalamento_id');

        if (embrioesError) {
          throw embrioesError;
        }

        // Agrupar IDs por acasalamento
        if (embrioesInseridos) {
          for (const emb of embrioesInseridos) {
            const acId = emb.lote_fiv_acasalamento_id;
            if (!embrioesIdsPorAcasalamento[acId]) {
              embrioesIdsPorAcasalamento[acId] = [];
            }
            embrioesIdsPorAcasalamento[acId].push(emb.id);
          }
        }
      }

      // EmbryoScore: vincular vídeos aos embriões RECÉM-CRIADOS e criar jobs de análise
      // (opcional — falhas aqui NÃO devem bloquear o despacho)
      // Agora iteramos por VÍDEO (não por acasalamento), distribuindo embriões proporcionalmente
      for (const ac of acasalamentosDespachados) {
        const mediaIds = videoMediaIds[ac.acasalamento_id];
        if (!mediaIds?.length) continue;

        // IDs dos embriões recém-criados DESTE acasalamento
        const novosEmbrioesIds = embrioesIdsPorAcasalamento[ac.acasalamento_id] || [];
        const detections = videoDetections[ac.acasalamento_id] || [];

        // Distribuir embriões entre vídeos proporcionalmente ao número de bboxes detectados
        // Ex: vídeo1 detectou 6 bboxes, vídeo2 detectou 4 → vídeo1 fica com 6 embriões, vídeo2 com 4
        let embrioesDistribuidos = 0;

        for (let vIdx = 0; vIdx < mediaIds.length; vIdx++) {
          const mediaId = mediaIds[vIdx];
          const detection = detections.find(d => d.mediaId === mediaId);
          const bboxCount = detection?.bboxes?.length || 0;

          // Calcular quantos embriões este vídeo recebe
          let countForVideo: number;
          if (vIdx === mediaIds.length - 1) {
            // Último vídeo: recebe os restantes
            countForVideo = ac.quantidade - embrioesDistribuidos;
          } else {
            countForVideo = bboxCount > 0 ? bboxCount : 0;
          }
          if (countForVideo <= 0) continue;

          // IDs dos embriões alocados a este vídeo
          const embrioesDoVideo = novosEmbrioesIds.slice(embrioesDistribuidos, embrioesDistribuidos + countForVideo);
          embrioesDistribuidos += countForVideo;

          try {
            // 1. Verificar que o registro de mídia realmente existe
            const { data: mediaExists } = await supabase
              .from('acasalamento_embrioes_media')
              .select('id')
              .eq('id', mediaId)
              .maybeSingle();

            if (!mediaExists) {
              console.warn(`EmbryoScore: media_id ${mediaId} não encontrado. Pulando.`);
              continue;
            }

            // 2. Vincular media_id aos embriões deste vídeo
            if (embrioesDoVideo.length > 0) {
              await supabase
                .from('embrioes')
                .update({ acasalamento_media_id: mediaId })
                .in('id', embrioesDoVideo)
                .then(({ error }) => {
                  if (error) {
                    console.warn('EmbryoScore: falha ao vincular vídeo (não-bloqueante):', error.message);
                  }
                });
            }

            // 3-5. Criar job de análise SOMENTE se há bboxes+crops (MODO A)
            // Sem bboxes o resultado é impreciso — pular análise
            const bboxCount = detection?.bboxes?.length || 0;
            const hasCropsForVideo = detection?.cropPaths && detection.cropPaths.length > 0;

            if (bboxCount > 0 && hasCropsForVideo) {
              let selectedBboxes = detection?.bboxes ?? null;
              let detConfidence = detection?.confidence ?? null;

              if (selectedBboxes && selectedBboxes.length > countForVideo) {
                selectedBboxes = [...selectedBboxes]
                  .sort((a, b) => b.radius_px - a.radius_px)
                  .slice(0, countForVideo);
                detConfidence = 'medium';
              } else if (selectedBboxes && selectedBboxes.length < countForVideo) {
                detConfidence = 'low';
              }

              let selectedCropPaths = detection?.cropPaths ?? null;
              if (selectedBboxes && selectedCropPaths && selectedBboxes.length < (detection?.bboxes?.length ?? 0)) {
                const indexedBboxes = (detection?.bboxes ?? []).map((b, i) => ({ b, i }));
                const sortedIndexes = indexedBboxes
                  .sort((a, b) => b.b.radius_px - a.b.radius_px)
                  .slice(0, countForVideo)
                  .map(x => x.i);
                selectedCropPaths = sortedIndexes.map(i => selectedCropPaths![i]).filter(Boolean);
              }

              const { data: queueData, error: queueError } = await supabase
                .from('embryo_analysis_queue')
                .insert({
                  media_id: mediaId,
                  lote_fiv_acasalamento_id: ac.acasalamento_id,
                  status: 'pending',
                  detected_bboxes: selectedBboxes,
                  detection_confidence: detConfidence,
                  expected_count: countForVideo,
                  crop_paths: selectedCropPaths,
                })
                .select('id')
                .single();

              if (queueError) {
                console.warn('EmbryoScore: falha ao criar job de análise:', queueError.message);
              }

              // 4. Vincular queue_id aos embriões deste vídeo
              if (queueData?.id && embrioesDoVideo.length > 0) {
                supabase
                  .from('embrioes')
                  .update({ queue_id: queueData.id })
                  .in('id', embrioesDoVideo)
                  .then(({ error }) => {
                    if (error) {
                      console.warn('EmbryoScore: falha ao vincular queue_id (não-bloqueante):', error.message);
                    }
                  });
              }

              // 5. Invocar Edge Function fire-and-forget
              if (queueData?.id) {
                supabase.functions.invoke('embryo-analyze', {
                  body: { queue_id: queueData.id },
                }).catch((err: unknown) => {
                  console.warn('EmbryoScore: falha ao invocar análise (será reprocessado):', err);
                });
              }
            } else {
              console.log(`EmbryoScore: vídeo ${mediaId} sem bboxes/crops — análise pulada, embrião vinculado ao vídeo`);
            }
          } catch (embryoScoreErr) {
            console.warn('EmbryoScore: erro não-bloqueante no processamento de vídeo:', embryoScoreErr);
          }
        }
      }

      // Limpar vídeos e detecções após despacho
      setVideoMediaIds({});
      setVideoDetections({});

      const historicoDespacho = {
        id: `${selectedLote.id}-${dataDespacho}-${Date.now()}`,
        data_despacho: dataDespacho,
        acasalamentos: acasalamentosDespachados,
      };

      setHistoricoDespachos([historicoDespacho, ...historicoDespachos]);

      const updates = acasalamentosComQuantidade.map(ac =>
        supabase
          .from('lote_fiv_acasalamentos')
          .update({ quantidade_embrioes: null })
          .eq('id', ac.id)
      );

      await Promise.all(updates);

      setEditQuantidadeEmbrioes({});

      toast({
        title: 'Embriões despachados',
        description: `${embrioesParaCriar.length} embrião(ões) foram despachados para ${nomePacote}.`,
      });

      loadLoteDetail(selectedLote.id);
    } catch (error) {
      toast({
        title: 'Erro ao despachar embriões',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddAcasalamento = async (formData: AcasalamentoForm) => {
    if (!selectedLote) return;

    const quantidadeFracionada = parseFloat(formData.quantidade_fracionada) || 0;

    try {
      setSubmitting(true);

      const aspiracaoSelecionada = aspiracoesDisponiveis.find(
        (a) => a.id === formData.aspiracao_doadora_id
      );
      const oocitosDisponiveis = aspiracaoSelecionada?.oocitos_disponiveis ?? 0;

      const quantidadeOocitos = parseInt(formData.quantidade_oocitos) || 0;

      if (quantidadeOocitos > oocitosDisponiveis) {
        toast({
          title: 'Erro de validação',
          description: `A quantidade de oócitos (${quantidadeOocitos}) não pode ser maior que os oócitos disponíveis (${oocitosDisponiveis})`,
          variant: 'destructive',
        });
        throw new Error('Validação falhou');
      }

      const { data: doseAtual, error: doseAtualError } = await supabase
        .from('doses_semen')
        .select('id, quantidade')
        .eq('id', formData.dose_semen_id)
        .single();
      if (doseAtualError) throw doseAtualError;

      const quantidadeDisponivel = doseAtual?.quantidade ?? 0;
      if (quantidadeDisponivel < quantidadeFracionada) {
        toast({
          title: 'Estoque insuficiente',
          description: `Quantidade disponível (${quantidadeDisponivel}) é menor que a quantidade fracionada (${quantidadeFracionada}).`,
          variant: 'destructive',
        });
        throw new Error('Estoque insuficiente');
      }

      const acasalamentoParaInserir = {
        lote_fiv_id: selectedLote.id,
        aspiracao_doadora_id: formData.aspiracao_doadora_id,
        dose_semen_id: formData.dose_semen_id,
        quantidade_fracionada: quantidadeFracionada,
        quantidade_oocitos: quantidadeOocitos > 0 ? quantidadeOocitos : null,
        observacoes: formData.observacoes || null,
      };

      const { error } = await supabase.from('lote_fiv_acasalamentos').insert([acasalamentoParaInserir]);

      if (error) {
        // 409 Conflict = unique constraint violation (duplicate acasalamento)
        if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
          toast({
            title: 'Acasalamento duplicado',
            description: 'Já existe um acasalamento com esta doadora e dose de sêmen neste lote. Edite o existente ou escolha outra combinação.',
            variant: 'destructive',
          });
          return;
        }
        throw error;
      }

      const novaQuantidade = quantidadeDisponivel - quantidadeFracionada;
      const { error: doseUpdateError } = await supabase
        .from('doses_semen')
        .update({ quantidade: novaQuantidade })
        .eq('id', doseAtual?.id || '');
      if (doseUpdateError) throw doseUpdateError;

      toast({
        title: 'Acasalamento adicionado',
        description: 'Acasalamento adicionado com sucesso',
      });

      await loadLoteDetail(selectedLote.id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      if (!errorMessage.includes('Validação') && !errorMessage.includes('Estoque')) {
        toast({
          title: 'Erro ao adicionar acasalamento',
          description: errorMessage.includes('RLS') || errorMessage.includes('policy')
            ? 'RLS está bloqueando escrita. Configure políticas anon no Supabase.'
            : errorMessage,
          variant: 'destructive',
        });
      }
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !selectedLote) {
    return <LoadingSpinner />;
  }

  // Se estiver visualizando um lote específico
  if (selectedLote && showLoteDetail) {
    return (
      <>
      <LoteDetailView
        lote={selectedLote}
        acasalamentos={acasalamentos}
        aspiracoesDisponiveis={aspiracoesDisponiveis}
        dosesDisponiveis={dosesDisponiveis}
        dosesDisponiveisNoLote={dosesDisponiveisNoLote}
        doadoras={doadoras}
        clientes={clientes}
        historicoDespachos={historicoDespachos}
        dataAspiracao={dataAspiracao}
        fazendaOrigemNome={fazendaOrigemNome}
        fazendasDestinoNomes={fazendasDestinoNomes}
        submitting={submitting}
        onBack={() => {
          setShowLoteDetail(false);
          setSelectedLote(null);
        }}
        onAddAcasalamento={handleAddAcasalamento}
        onDespacharEmbrioes={despacharEmbrioes}
        onUpdateQuantidadeEmbrioes={(acasalamentoId, quantidade) => {
          setEditQuantidadeEmbrioes({
            ...editQuantidadeEmbrioes,
            [acasalamentoId]: quantidade,
          });
        }}
        editQuantidadeEmbrioes={editQuantidadeEmbrioes}
        editOocitos={editOocitos}
        onUpdateOocitos={async (acasalamentoId, quantidade) => {
          setEditOocitos(prev => ({ ...prev, [acasalamentoId]: quantidade }));
          const valorNumerico = parseInt(quantidade) || null;
          await supabase
            .from('lote_fiv_acasalamentos')
            .update({ quantidade_oocitos: valorNumerico })
            .eq('id', acasalamentoId);
        }}
        onBlurOocitos={async () => {
          if (selectedLote) await loadLoteDetail(selectedLote.id);
        }}
        onUpdateClivados={async (acasalamentoId, quantidade) => {
          setEditClivados({
            ...editClivados,
            [acasalamentoId]: quantidade,
          });
          // Salvar no banco em background
          const valorNumerico = parseInt(quantidade) || null;
          await supabase
            .from('lote_fiv_acasalamentos')
            .update({ embrioes_clivados_d3: valorNumerico })
            .eq('id', acasalamentoId);
        }}
        editClivados={editClivados}
        videoMediaIds={videoMediaIds}
        videoDetections={videoDetections}
        onVideoUploadComplete={(acasalamentoId, mediaId, detectedBboxes, detectionConfidence, cropPaths) => {
          setVideoMediaIds(prev => ({
            ...prev,
            [acasalamentoId]: [...(prev[acasalamentoId] || []), mediaId],
          }));
          if (detectedBboxes && detectionConfidence) {
            setVideoDetections(prev => ({
              ...prev,
              [acasalamentoId]: [
                ...(prev[acasalamentoId] || []),
                { mediaId, bboxes: detectedBboxes, confidence: detectionConfidence, cropPaths },
              ],
            }));
          }
        }}
      />

      {/* Dialog: Warning despacho sem vídeo */}
      <Dialog open={showDespachoSemVideoWarning} onOpenChange={setShowDespachoSemVideoWarning}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Despachar sem análise de IA?</DialogTitle>
            <DialogDescription>
              {acsSemVideoNomes.length} acasalamento(s) não têm vídeo: {acsSemVideoNomes.join(', ')}.
              Sem vídeo, a análise EmbryoScore não será realizada para esses embriões.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowDespachoSemVideoWarning(false);
                setSubmitting(false);
              }}
            >
              Voltar e filmar
            </Button>
            <Button
              onClick={() => {
                // Continua o despacho — a flag showDespachoSemVideoWarning está true,
                // o despacharEmbrioes vai pular o warning check
                despacharEmbrioes();
              }}
            >
              Continuar sem análise
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Warning despacho com vídeo mas sem detecção */}
      <Dialog open={showDespachoSemBboxWarning} onOpenChange={setShowDespachoSemBboxWarning}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Embriões não detectados no vídeo</DialogTitle>
            <DialogDescription>
              Alguns acasalamentos têm vídeo mas a detecção automática não encontrou embriões.
              A análise EmbryoScore será feita em modo simplificado (sem posição individual).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowDespachoSemBboxWarning(false);
                setSubmitting(false);
              }}
            >
              Voltar e redetectar
            </Button>
            <Button
              onClick={() => {
                // Continua o despacho — a flag showDespachoSemBboxWarning está true,
                // o despacharEmbrioes vai pular o bbox check
                despacharEmbrioes();
              }}
            >
              Continuar mesmo assim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </>
    );
  }

  // Lista de lotes
  return (
    <div className="space-y-6">
      <PageHeader
        title="Lotes FIV"
        description="Gerenciar lotes de fecundação in vitro"
        actions={
          <NovoLoteDialog
            pacotes={pacotes}
            clientes={clientes}
            fazendas={fazendas}
          />
        }
      />

      {/* Barra de Filtros Premium */}
      <div className="rounded-xl border border-border bg-gradient-to-r from-card via-card to-muted/30 p-4 mb-4">
        <div className="flex flex-wrap items-end gap-6">
          {/* Grupo: Filtros */}
          <div className="flex items-end gap-3">
            <div className="w-1 h-6 rounded-full bg-primary/40 self-center" />
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground self-center">
              <Filter className="w-3.5 h-3.5" />
              <span>Filtros</span>
            </div>
            <div className="flex-1 min-w-[220px] relative fazenda-busca-container">
              <label className="text-[10px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">
                Fazenda da Aspiração
              </label>
              <div className="relative">
                <Input
                  id="filtro-fazenda-aspiração"
                  placeholder="Digite para buscar fazenda..."
                  value={filtroFazendaAspiracaoBusca}
                  onChange={(e) => {
                    setFiltroFazendaAspiracaoBusca(e.target.value);
                    setShowFazendaBusca(true);
                    if (!e.target.value) {
                      setFiltroFazendaAspiracao('');
                    }
                  }}
                  onFocus={() => setShowFazendaBusca(true)}
                  className="h-9"
                />
                {filtroFazendaAspiracao && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1 h-7 w-7 p-0"
                    onClick={() => {
                      setFiltroFazendaAspiracao('');
                      setFiltroFazendaAspiracaoBusca('');
                      setShowFazendaBusca(false);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
                {showFazendaBusca && fazendasFiltradas.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-auto">
                    {fazendasFiltradas.map((fazenda) => (
                      <div
                        key={fazenda.id}
                        className="px-4 py-2 hover:bg-muted cursor-pointer text-sm"
                        onClick={() => {
                          setFiltroFazendaAspiracao(fazenda.id);
                          setFiltroFazendaAspiracaoBusca(fazenda.nome);
                          setShowFazendaBusca(false);
                        }}
                      >
                        {fazenda.nome}
                      </div>
                    ))}
                  </div>
                )}
                {showFazendaBusca && filtroFazendaAspiracaoBusca && fazendasFiltradas.length === 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg p-4 text-sm text-muted-foreground">
                    Nenhuma fazenda encontrada
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Separador */}
          <div className="h-10 w-px bg-border hidden lg:block" />

          {/* Grupo: Dia do Cultivo */}
          <div className="flex items-end gap-3">
            <div className="w-1 h-6 rounded-full bg-emerald-500/40 self-center" />
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground self-center">
              <Calendar className="w-3.5 h-3.5" />
              <span>Cultivo</span>
            </div>
            <div className="w-[180px]">
              <label className="text-[10px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">
                Dia do Cultivo
              </label>
              <Select
                value={filtroDiaCultivo || undefined}
                onValueChange={(value) => setFiltroDiaCultivo(value || '')}
              >
                <SelectTrigger id="filtro-dia-cultivo" className="h-9">
                  <SelectValue placeholder="Todos os dias" />
                </SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((dia) => (
                    <SelectItem key={dia} value={dia.toString()}>
                      D{dia} - {getNomeDia(dia)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Separador */}
          <div className="h-10 w-px bg-border hidden lg:block" />

          {/* Botão Limpar */}
          {(filtroFazendaAspiracao || filtroDiaCultivo) && (
            <div className="flex items-end ml-auto">
              <Button
                variant="outline"
                onClick={limparFiltrosAtivos}
                className="h-9"
              >
                <X className="w-4 h-4 mr-2" />
                Limpar Filtros
              </Button>
            </div>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Lotes FIV</CardTitle>
        </CardHeader>
        <CardContent>

              {lotesFiltrados.length === 0 ? (
                <EmptyState
                  title={lotes.length === 0 ? 'Nenhum lote cadastrado' : 'Nenhum lote encontrado'}
                  description={
                    lotes.length === 0
                      ? 'Crie um novo lote para começar.'
                      : 'Ajuste os filtros para encontrar outros lotes.'
                  }
                />
              ) : (
                <>
                  {/* Mobile Card Layout */}
                  <div className="md:hidden space-y-2">
                    {lotesFiltrados.map((lote) => {
                      const diaCultivo = lote.dia_atual === 0 ? -1 : (lote.dia_atual && lote.dia_atual > 9 ? 8 : (lote.dia_atual ?? 0) - 1);
                      return (
                        <div
                          key={lote.id}
                          onClick={() => navigate(`/lotes-fiv/${lote.id}`)}
                          className="rounded-lg border border-border bg-card p-3 cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              {/* Fazenda nome */}
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium text-foreground truncate">
                                  {lote.pacote_nome}
                                </span>
                              </div>

                              {/* Dia cultivo e acasalamentos */}
                              <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                                {lote.dia_atual !== undefined ? (
                                  <Badge
                                    variant="outline"
                                    className={`font-semibold text-[10px] ${getCorDia(diaCultivo)}`}
                                  >
                                    {diaCultivo === -1
                                      ? `D-1 - ${getNomeDia(diaCultivo)}`
                                      : `D${diaCultivo} - ${getNomeDia(diaCultivo)}`}
                                  </Badge>
                                ) : null}
                                <span>·</span>
                                <span>{lote.quantidade_acasalamentos ?? 0} acasalamentos</span>
                              </div>

                              {/* Destino */}
                              <div className="text-xs text-muted-foreground truncate">
                                <span className="font-medium">Destino: </span>
                                {lote.fazendas_destino_nomes && lote.fazendas_destino_nomes.length > 0
                                  ? lote.fazendas_destino_nomes.join(', ')
                                  : '-'}
                              </div>

                              {/* Status badge */}
                              <div className="mt-2">
                                <Badge variant="outline" className="text-[10px]">
                                  ABERTO
                                </Badge>
                              </div>
                            </div>

                            {/* Chevron */}
                            <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-1" />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop Table Layout */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Aspiração</TableHead>
                          <TableHead>Fazendas Destino</TableHead>
                          <TableHead>Dia do Cultivo</TableHead>
                          <TableHead>Acasalamentos</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lotesFiltrados.map((lote) => (
                          <TableRow key={lote.id}>
                            <TableCell>
                              {lote.pacote_data && formatDate(lote.pacote_data)} - {lote.pacote_nome}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {lote.fazendas_destino_nomes && lote.fazendas_destino_nomes.length > 0 ? (
                                  lote.fazendas_destino_nomes.map((nome, index) => (
                                    <Badge key={index} variant="outline" className="text-xs">
                                      {nome}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {lote.dia_atual !== undefined ? (
                                <Badge
                                  variant="outline"
                                  className={`font-semibold ${getCorDia(lote.dia_atual === 0 ? -1 : (lote.dia_atual > 9 ? 8 : lote.dia_atual - 1))}`}
                                >
                                  {(() => {
                                    const diaCultivo = lote.dia_atual === 0 ? -1 : (lote.dia_atual > 9 ? 8 : lote.dia_atual - 1);
                                    return diaCultivo === -1
                                      ? `D-1 - ${getNomeDia(diaCultivo)}`
                                      : `D${diaCultivo} - ${getNomeDia(diaCultivo)}`;
                                  })()}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>{lote.quantidade_acasalamentos ?? 0}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/lotes-fiv/${lote.id}`)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
        </CardContent>
      </Card>
    </div>
  );
}

// Função helper para computar lotes filtrados
function useLotesFiltradosComputed(
  lotes: LoteFIVComNomes[],
  pacotesParaFiltro: PacoteComNomes[],
  filtroFazendaAspiracao: string,
  filtroDiaCultivo: string
) {
  return useMemo(() => {
    let filtrados = [...lotes];

    // Filtro base: excluir lotes fechados ou que passaram do D8
    filtrados = filtrados.filter((l) => {
      if (l.status === 'FECHADO') return false;
      if (l.dia_atual !== undefined && l.dia_atual > 9) return false;
      return l.dia_atual !== undefined && l.dia_atual <= 9;
    });

    // Filtrar por fazenda da aspiração
    if (filtroFazendaAspiracao) {
      filtrados = filtrados.filter((l) => {
        const pacote = pacotesParaFiltro.find((p) => p.id === l.pacote_aspiracao_id);
        return pacote?.fazenda_id === filtroFazendaAspiracao;
      });
    }

    // Filtrar por dia do cultivo
    if (filtroDiaCultivo !== '') {
      const diaFiltro = parseInt(filtroDiaCultivo);
      filtrados = filtrados.filter((l) => {
        if (l.dia_atual === undefined || l.dia_atual === null) return false;
        const diaCultivo = l.dia_atual === 0 ? -1 : l.dia_atual - 1;
        return diaCultivo === diaFiltro;
      });
    }

    return filtrados;
  }, [lotes, filtroFazendaAspiracao, filtroDiaCultivo, pacotesParaFiltro]);
}

// Função helper para computar fazendas filtradas para busca
function useFazendasFiltradasComputed(
  fazendasAspiracaoUnicas: { id: string; nome: string }[],
  filtroFazendaAspiracaoBusca: string
) {
  return useMemo(
    () =>
      fazendasAspiracaoUnicas.filter((f) =>
        f.nome.toLowerCase().includes(filtroFazendaAspiracaoBusca.toLowerCase())
      ),
    [fazendasAspiracaoUnicas, filtroFazendaAspiracaoBusca]
  );
}
