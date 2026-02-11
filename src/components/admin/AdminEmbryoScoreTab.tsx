/**
 * Aba de administração do EmbryoScore IA (v4)
 *
 * Permite:
 * - Editar modelo, prompt customizado, few-shot examples
 * - Histórico de configs anteriores
 * - Estatísticas de uso (total análises, concordância biólogo, etc.)
 * - Correlação score × prenhez
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import type { EmbryoScoreConfig, EmbryoScoreSecret } from '@/lib/types';
import {
  Brain,
  Save,
  Loader2,
  Settings,
  History,
  BarChart3,
  Check,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Play,
  FileText,
  RotateCcw,
  KeyRound,
  Eye,
  EyeOff,
} from 'lucide-react';
import { ScorePregnancyCorrelation } from '@/components/embryoscore/ScorePregnancyCorrelation';
import { ConcordanceReport } from '@/components/embryoscore/ConcordanceReport';

// Prompt padrão v4 (fallback) — espelho do prompt hardcoded na Edge Function
// Usado como placeholder quando a config não define prompt customizado
const DEFAULT_CALIBRATION_PROMPT = `[Prompt v4 — hardcoded na Edge Function]

O prompt padrão está embutido na Edge Function embryo-analyze.
Deixe este campo VAZIO para usar o prompt v4 padrão.

Só preencha se quiser sobrescrever com um prompt customizado.

Resumo do prompt v4:
- Foco D7: sub-scoring por componente (MCI 35%, TE 35%, ZP+Forma 20%, Fragmentação 10%)
- 3 frames (não 10)
- Kinetic_score refinado pelo Gemini com contexto morfológico
- Cross context: dados da doadora/touro injetados automaticamente
- Classificação: ≥82 Excelente, ≥65 Bom, ≥48 Regular, ≥25 Borderline, <25 Inviável
- Anti-inflação: score médio esperado 62-68`;

function useEmbryoScoreConfigs() {
  return useQuery<EmbryoScoreConfig[]>({
    queryKey: ['embryo-score-configs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('embryo_score_config')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as EmbryoScoreConfig[];
    },
  });
}

function useEmbryoScoreStats() {
  return useQuery({
    queryKey: ['embryo-score-stats'],
    queryFn: async () => {
      // Total de scores
      const { count: totalScores } = await supabase
        .from('embryo_scores')
        .select('*', { count: 'exact', head: true });

      // Scores com feedback do biólogo
      const { count: feedbackCount } = await supabase
        .from('embryo_scores')
        .select('*', { count: 'exact', head: true })
        .not('biologo_concorda', 'is', null);

      // Concordou
      const { count: concordouCount } = await supabase
        .from('embryo_scores')
        .select('*', { count: 'exact', head: true })
        .eq('biologo_concorda', true);

      // Discordou
      const { count: discordouCount } = await supabase
        .from('embryo_scores')
        .select('*', { count: 'exact', head: true })
        .eq('biologo_concorda', false);

      // Jobs na fila
      const { count: pendingJobs } = await supabase
        .from('embryo_analysis_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      const { count: failedJobs } = await supabase
        .from('embryo_analysis_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'failed');

      // Score médio
      const { data: avgData } = await supabase
        .from('embryo_scores')
        .select('embryo_score');

      const avgScore = avgData?.length
        ? avgData.reduce((sum, s) => sum + s.embryo_score, 0) / avgData.length
        : 0;

      return {
        totalScores: totalScores || 0,
        feedbackCount: feedbackCount || 0,
        concordouCount: concordouCount || 0,
        discordouCount: discordouCount || 0,
        pendingJobs: pendingJobs || 0,
        failedJobs: failedJobs || 0,
        avgScore,
        concordanciaRate: feedbackCount
          ? ((concordouCount || 0) / feedbackCount) * 100
          : 0,
      };
    },
  });
}

export default function AdminEmbryoScoreTab() {
  const queryClient = useQueryClient();
  const { data: configs = [], isLoading: loadingConfigs } = useEmbryoScoreConfigs();
  const { data: stats, isLoading: loadingStats, refetch: refetchStats } = useEmbryoScoreStats();

  const activeConfig = configs.find(c => c.active);

  const [modelName, setModelName] = useState('gemini-2.5-flash');
  const [promptVersion, setPromptVersion] = useState('v4');
  const [notes, setNotes] = useState('');
  const [reprocessLog, setReprocessLog] = useState<string[]>([]);
  const [calibrationPrompt, setCalibrationPrompt] = useState('');
  const [activePromptTab, setActivePromptTab] = useState<'calibration' | 'fewshot'>('calibration');
  const [fewShotExamples, setFewShotExamples] = useState('');

  // API Key state
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeySaved, setApiKeySaved] = useState(false);

  // Buscar secret do banco (apenas admin consegue ler via RLS)
  const { data: apiKeySecret, isLoading: loadingSecret } = useQuery<EmbryoScoreSecret | null>({
    queryKey: ['embryo-score-secret', 'GEMINI_API_KEY'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('embryo_score_secrets')
        .select('*')
        .eq('key_name', 'GEMINI_API_KEY')
        .maybeSingle();
      if (error) {
        console.warn('Erro ao buscar secret:', error.message);
        return null;
      }
      return data as EmbryoScoreSecret | null;
    },
  });

  // Sync API key com banco
  useEffect(() => {
    if (apiKeySecret?.key_value) {
      setApiKey(apiKeySecret.key_value);
    }
  }, [apiKeySecret]);

  // Mutation: salvar API key (independente da config)
  const saveApiKeyMutation = useMutation({
    mutationFn: async () => {
      const trimmed = apiKey.trim();
      if (!trimmed) throw new Error('Chave API não pode ser vazia');

      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('embryo_score_secrets')
        .upsert({
          key_name: 'GEMINI_API_KEY',
          key_value: trimmed,
          updated_at: new Date().toISOString(),
          updated_by: user?.id || null,
        }, { onConflict: 'key_name' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['embryo-score-secret'] });
      setApiKeySaved(true);
      setTimeout(() => setApiKeySaved(false), 3000);
    },
  });

  // Sincronizar com config ativa
  useEffect(() => {
    if (activeConfig) {
      setModelName(activeConfig.model_name);
      setPromptVersion(activeConfig.prompt_version);
      setCalibrationPrompt(activeConfig.calibration_prompt || '');
      setFewShotExamples((activeConfig as unknown as Record<string, unknown>).few_shot_examples as string || '');
    }
  }, [activeConfig]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Desativar config anterior
      if (activeConfig) {
        await supabase
          .from('embryo_score_config')
          .update({ active: false })
          .eq('id', activeConfig.id);
      }

      // Criar nova config ativa (v4: pesos fixos 1.0/0, kinetic_score refinado pelo Gemini)
      const { error } = await supabase
        .from('embryo_score_config')
        .insert({
          morph_weight: 1.0,
          kinetic_weight: 0,
          model_name: modelName,
          prompt_version: promptVersion,
          active: true,
          notes: notes || null,
          calibration_prompt: calibrationPrompt.trim() || null,
          few_shot_examples: fewShotExamples.trim() || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['embryo-score-configs'] });
      setNotes('');
    },
  });

  // Mutation: buscar mídias órfãs (sem job na queue) e criar jobs + invocar Edge Function
  const reprocessOrphansMutation = useMutation({
    mutationFn: async () => {
      const log: string[] = [];

      // 1. Buscar todas as mídias de vídeo
      const { data: allMedia, error: mediaErr } = await supabase
        .from('acasalamento_embrioes_media')
        .select('id, lote_fiv_acasalamento_id')
        .eq('tipo_media', 'VIDEO');

      if (mediaErr) throw new Error(`Erro ao buscar mídias: ${mediaErr.message}`);
      if (!allMedia || allMedia.length === 0) {
        log.push('Nenhuma mídia de vídeo encontrada.');
        return log;
      }
      log.push(`${allMedia.length} mídia(s) de vídeo encontrada(s).`);

      // 2. Buscar jobs existentes para essas mídias
      const mediaIds = allMedia.map(m => m.id);
      const { data: existingJobs } = await supabase
        .from('embryo_analysis_queue')
        .select('media_id, status')
        .in('media_id', mediaIds);

      const jobsByMedia = new Map(
        (existingJobs || []).map(j => [j.media_id, j.status])
      );

      // 3. Filtrar mídias sem job ou com job failed
      const orphanMedia = allMedia.filter(m => !jobsByMedia.has(m.id));
      const failedMedia = allMedia.filter(m => jobsByMedia.get(m.id) === 'failed');

      log.push(`${orphanMedia.length} mídia(s) sem job na fila.`);
      log.push(`${failedMedia.length} mídia(s) com job falhado.`);

      if (orphanMedia.length === 0 && failedMedia.length === 0) {
        log.push('Nada para reprocessar.');
        return log;
      }

      // 4. Criar jobs para mídias órfãs
      let createdCount = 0;
      for (const media of orphanMedia) {
        const { data: queueData, error: queueErr } = await supabase
          .from('embryo_analysis_queue')
          .insert({
            media_id: media.id,
            lote_fiv_acasalamento_id: media.lote_fiv_acasalamento_id,
            status: 'pending',
          })
          .select('id')
          .single();

        if (queueErr) {
          log.push(`Erro ao criar job para media ${media.id}: ${queueErr.message}`);
          continue;
        }

        if (queueData?.id) {
          createdCount++;
          // Fire-and-forget: invocar Edge Function
          supabase.functions.invoke('embryo-analyze', {
            body: { queue_id: queueData.id },
          }).catch((err: unknown) => {
            console.warn('Reprocess: falha ao invocar análise:', err);
          });
        }
      }
      log.push(`${createdCount} job(s) criado(s) e Edge Function invocada.`);

      // 5. Reprocessar jobs falhados (resetar para pending e re-invocar)
      let retriedCount = 0;
      for (const media of failedMedia) {
        const { data: failedJob } = await supabase
          .from('embryo_analysis_queue')
          .select('id, retry_count')
          .eq('media_id', media.id)
          .eq('status', 'failed')
          .maybeSingle();

        if (failedJob && (failedJob.retry_count || 0) < 3) {
          await supabase
            .from('embryo_analysis_queue')
            .update({ status: 'pending' })
            .eq('id', failedJob.id);

          supabase.functions.invoke('embryo-analyze', {
            body: { queue_id: failedJob.id },
          }).catch((err: unknown) => {
            console.warn('Retry: falha ao invocar análise:', err);
          });
          retriedCount++;
        }
      }
      if (retriedCount > 0) {
        log.push(`${retriedCount} job(s) falhado(s) reenfileirado(s).`);
      }

      return log;
    },
    onSuccess: (log) => {
      setReprocessLog(log);
      queryClient.invalidateQueries({ queryKey: ['embryo-score-stats'] });
    },
    onError: (err) => {
      setReprocessLog([`Erro: ${err instanceof Error ? err.message : 'desconhecido'}`]);
    },
  });

  // Mutation: reprocessar apenas jobs pendentes existentes
  const retriggerPendingMutation = useMutation({
    mutationFn: async () => {
      const log: string[] = [];

      const { data: pendingJobs, error } = await supabase
        .from('embryo_analysis_queue')
        .select('id')
        .eq('status', 'pending');

      if (error) throw new Error(`Erro ao buscar jobs: ${error.message}`);
      if (!pendingJobs || pendingJobs.length === 0) {
        log.push('Nenhum job pendente na fila.');
        return log;
      }

      log.push(`${pendingJobs.length} job(s) pendente(s). Invocando Edge Function...`);

      for (const job of pendingJobs) {
        supabase.functions.invoke('embryo-analyze', {
          body: { queue_id: job.id },
        }).catch((err: unknown) => {
          console.warn('Retrigger: falha ao invocar:', err);
        });
      }

      log.push(`Edge Function invocada para ${pendingJobs.length} job(s).`);
      return log;
    },
    onSuccess: (log) => {
      setReprocessLog(log);
      refetchStats();
    },
    onError: (err) => {
      setReprocessLog([`Erro: ${err instanceof Error ? err.message : 'desconhecido'}`]);
    },
  });

  const hasChanges = activeConfig
    ? modelName !== activeConfig.model_name ||
      promptVersion !== activeConfig.prompt_version ||
      calibrationPrompt !== (activeConfig.calibration_prompt || '') ||
      fewShotExamples !== ((activeConfig as unknown as Record<string, unknown>).few_shot_examples as string || '')
    : true;

  if (loadingConfigs) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/15 flex items-center justify-center">
          <Brain className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">EmbryoScore IA</h2>
          <p className="text-xs text-muted-foreground">Configuração e monitoramento da análise por IA (v4)</p>
        </div>
      </div>

      {/* Estatísticas */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Total Análises"
            value={stats.totalScores}
            icon={Brain}
            color="primary"
          />
          <StatCard
            label="Score Médio"
            value={Math.round(stats.avgScore)}
            icon={BarChart3}
            color="primary"
          />
          <StatCard
            label="Concordância"
            value={`${stats.concordanciaRate.toFixed(0)}%`}
            subtitle={`${stats.concordouCount} de ${stats.feedbackCount}`}
            icon={ThumbsUp}
            color="emerald"
          />
          <StatCard
            label="Fila / Falhas"
            value={`${stats.pendingJobs} / ${stats.failedJobs}`}
            icon={stats.failedJobs > 0 ? AlertTriangle : Check}
            color={stats.failedJobs > 0 ? 'amber' : 'emerald'}
          />
        </div>
      )}

      {/* Reprocessamento */}
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-muted/60 to-transparent border-b border-border/50">
          <div className="w-1 h-5 rounded-full bg-amber-500/50" />
          <RefreshCw className="w-4 h-4 text-amber-500/60" />
          <span className="text-sm font-semibold text-foreground">Reprocessamento</span>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => reprocessOrphansMutation.mutate()}
              disabled={reprocessOrphansMutation.isPending}
              className="h-9"
            >
              {reprocessOrphansMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Buscar mídias órfãs e criar jobs
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => retriggerPendingMutation.mutate()}
              disabled={retriggerPendingMutation.isPending || (stats?.pendingJobs === 0 && stats?.failedJobs === 0)}
              className="h-9"
            >
              {retriggerPendingMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Invocar Edge Function para pendentes
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            "Mídias órfãs" = vídeos enviados com upload mas sem job de análise na fila.
            Cria os jobs e invoca a Edge Function automaticamente.
          </p>

          {/* Log de reprocessamento */}
          {reprocessLog.length > 0 && (
            <div className="rounded-lg bg-muted/50 border border-border/40 p-3 space-y-0.5">
              {reprocessLog.map((line, i) => (
                <p key={i} className="text-xs text-muted-foreground font-mono">
                  {line}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chave API Gemini */}
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-muted/60 to-transparent border-b border-border/50">
          <div className="w-1 h-5 rounded-full bg-amber-500/50" />
          <KeyRound className="w-4 h-4 text-amber-500/60" />
          <span className="text-sm font-semibold text-foreground">Chave API Gemini</span>
          <div className="ml-auto flex items-center gap-2">
            {loadingSecret ? (
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
            ) : apiKeySecret?.key_value ? (
              <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Configurada
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Não configurada
              </span>
            )}
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy... (cole sua chave da API Gemini)"
                className="h-9 pr-10 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted/60 transition-colors"
              >
                {showApiKey ? (
                  <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                ) : (
                  <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </button>
            </div>
            <Button
              size="sm"
              onClick={() => saveApiKeyMutation.mutate()}
              disabled={saveApiKeyMutation.isPending || !apiKey.trim() || apiKey.trim() === (apiKeySecret?.key_value || '')}
              className="h-9 px-4"
            >
              {saveApiKeyMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : apiKeySaved ? (
                <Check className="w-4 h-4" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span className="ml-1.5 text-xs">
                {apiKeySaved ? 'Salva!' : 'Salvar chave'}
              </span>
            </Button>
          </div>
          {saveApiKeyMutation.isError && (
            <p className="text-[10px] text-red-500">
              Erro ao salvar: {saveApiKeyMutation.error instanceof Error ? saveApiKeyMutation.error.message : 'desconhecido'}
            </p>
          )}
          <p className="text-[10px] text-muted-foreground/70">
            Chave salva de forma segura — apenas administradores podem visualizar. A Edge Function usa esta chave com prioridade sobre a variável de ambiente.
          </p>
        </div>
      </div>

      {/* Prompts IA */}
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-muted/60 to-transparent border-b border-border/50">
          <div className="w-1 h-5 rounded-full bg-violet-500/50" />
          <FileText className="w-4 h-4 text-violet-500/60" />
          <span className="text-sm font-semibold text-foreground">Prompts IA</span>
          <span className="text-[10px] text-muted-foreground ml-auto">
            Editável — salvo junto com a configuração
          </span>
        </div>
        <div className="p-4 space-y-3">
          {/* Tabs internas */}
          <div className="flex gap-1 rounded-lg border border-border/60 bg-muted/30 p-1">
            <button
              onClick={() => setActivePromptTab('calibration')}
              className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                activePromptTab === 'calibration'
                  ? 'bg-card shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Calibração (System)
            </button>
            <button
              onClick={() => setActivePromptTab('fewshot')}
              className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                activePromptTab === 'fewshot'
                  ? 'bg-card shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Few-Shot
            </button>
          </div>

          {/* Textarea do prompt */}
          {activePromptTab === 'calibration' && (
            <div className="space-y-2">
              <textarea
                value={calibrationPrompt || DEFAULT_CALIBRATION_PROMPT}
                onChange={(e) => setCalibrationPrompt(e.target.value)}
                rows={14}
                className="w-full text-xs font-mono bg-muted/30 border border-border/60 rounded-lg px-3 py-2.5 resize-y focus:outline-none focus:ring-1 focus:ring-violet-500/40 focus:border-violet-500/40 leading-relaxed"
                placeholder={DEFAULT_CALIBRATION_PROMPT}
              />
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground">
                  Use <code className="px-1 py-0.5 rounded bg-muted text-[10px]">{'{morph_weight}'}</code> e{' '}
                  <code className="px-1 py-0.5 rounded bg-muted text-[10px]">{'{kinetic_weight}'}</code> como placeholders dinâmicos.
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    {(calibrationPrompt || DEFAULT_CALIBRATION_PROMPT).length} chars
                  </span>
                  {calibrationPrompt && calibrationPrompt !== DEFAULT_CALIBRATION_PROMPT && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setCalibrationPrompt('')}
                      className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      <RotateCcw className="w-3 h-3 mr-1" />
                      Restaurar padrão
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Few-shot tab */}
          {activePromptTab === 'fewshot' && (
            <div className="space-y-2">
              <textarea
                value={fewShotExamples}
                onChange={(e) => setFewShotExamples(e.target.value)}
                rows={10}
                className="w-full text-xs font-mono bg-muted/30 border border-border/60 rounded-lg px-3 py-2.5 resize-y focus:outline-none focus:ring-1 focus:ring-violet-500/40 focus:border-violet-500/40 leading-relaxed"
                placeholder={`Cole 1-2 exemplos JSON de análises "gold standard" para calibrar a IA.\n\nExemplo:\n{\n  "embryo_score": 85,\n  "classification": "Excelente",\n  "morphology": { "score": 88, "stage": "Bx, código 7" },\n  "kinetics": { "score": 78 },\n  "reasoning": "Blastocisto expandido com MCI compacta..."\n}`}
              />
              <p className="text-[10px] text-muted-foreground">
                Exemplos inseridos após o system prompt e antes do vídeo. Ajudam a calibrar o formato e a escala de pontuação da IA.
              </p>
              {fewShotExamples && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFewShotExamples('')}
                  className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Limpar
                </Button>
              )}
            </div>
          )}

          <p className="text-[10px] text-muted-foreground/70 border-t border-border/30 pt-2">
            Prompt vazio = usa o padrão hardcoded na Edge Function. Alterações são salvas ao clicar "Salvar configuração" abaixo.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Config ativa */}
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-muted/60 to-transparent border-b border-border/50">
            <div className="w-1 h-5 rounded-full bg-primary/50" />
            <Settings className="w-4 h-4 text-primary/60" />
            <span className="text-sm font-semibold text-foreground">Configuração Ativa</span>
          </div>

          <div className="p-4 space-y-4">
            {/* v4: Scores independentes — morph_score (visual) + kinetic_score (Gemini refined) */}
            <div className="rounded-lg bg-muted/30 border border-border/30 p-3">
              <p className="text-[11px] text-muted-foreground">
                <span className="font-semibold text-foreground">v4</span> — embryo_score = morph_score (sub-scoring MCI/TE/ZP/Frag).
                kinetic_score refinado pelo Gemini com contexto morfológico. 3 frames + dados do cruzamento.
              </p>
            </div>

            {/* Modelo e versão */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Modelo IA</Label>
                <Input
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  placeholder="gemini-2.5-flash"
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Versão Prompt</Label>
                <Input
                  value={promptVersion}
                  onChange={(e) => setPromptVersion(e.target.value)}
                  placeholder="v1"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Notas */}
            {hasChanges && (
              <div className="space-y-1.5">
                <Label className="text-xs">Notas da alteração (opcional)</Label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Aumentando peso da cinética para testar correlação com prenhez..."
                  rows={2}
                  className="w-full text-xs bg-background border border-border rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
              </div>
            )}

            {/* Botão salvar */}
            <div className="flex justify-end pt-2 border-t border-border/30">
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!hasChanges || saveMutation.isPending}
                className="h-9 bg-primary hover:bg-primary-dark"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : saveMutation.isSuccess ? (
                  <Check className="w-4 h-4 mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {saveMutation.isSuccess ? 'Salvo!' : 'Salvar configuração'}
              </Button>
            </div>
          </div>
        </div>

        {/* Histórico de configs */}
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-muted/60 to-transparent border-b border-border/50">
            <div className="w-1 h-5 rounded-full bg-primary/50" />
            <History className="w-4 h-4 text-primary/60" />
            <span className="text-sm font-semibold text-foreground">Histórico</span>
            <span className="text-xs text-muted-foreground ml-auto">{configs.length} configs</span>
          </div>

          <div className="divide-y divide-border/50 max-h-[400px] overflow-y-auto">
            {configs.map((config) => (
              <div
                key={config.id}
                className={`px-4 py-3 ${config.active ? 'bg-primary/5' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${config.active ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                  <span className="text-xs font-medium text-foreground">
                    M: {(config.morph_weight * 100).toFixed(0)}% / C: {(config.kinetic_weight * 100).toFixed(0)}%
                  </span>
                  {config.active && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium">
                      Ativa
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {config.created_at ? new Date(config.created_at).toLocaleDateString('pt-BR') : '-'}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 ml-4">
                  <span className="text-[10px] text-muted-foreground">
                    {config.model_name} · {config.prompt_version}
                  </span>
                </div>
                {config.notes && (
                  <p className="text-[10px] text-muted-foreground/70 italic mt-0.5 ml-4 truncate" title={config.notes}>
                    {config.notes}
                  </p>
                )}
              </div>
            ))}
            {configs.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Nenhuma configuração encontrada
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Relatório de concordância IA vs Biólogo */}
      <ConcordanceReport />

      {/* Dashboard de correlação */}
      <ScorePregnancyCorrelation />

      {/* Feedback stats detalhado */}
      {stats && stats.feedbackCount > 0 && (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-muted/60 to-transparent border-b border-border/50">
            <div className="w-1 h-5 rounded-full bg-primary/50" />
            <ThumbsUp className="w-4 h-4 text-primary/60" />
            <span className="text-sm font-semibold text-foreground">Feedback dos Biólogos</span>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="h-4 rounded-full overflow-hidden flex bg-muted">
                  <div
                    className="bg-emerald-500 transition-all"
                    style={{ width: `${stats.concordanciaRate}%` }}
                  />
                  <div
                    className="bg-amber-500 transition-all"
                    style={{ width: `${100 - stats.concordanciaRate}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                    <ThumbsUp className="w-3 h-3 inline mr-0.5" />
                    {stats.concordouCount} concordaram ({stats.concordanciaRate.toFixed(0)}%)
                  </span>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400">
                    <ThumbsDown className="w-3 h-3 inline mr-0.5" />
                    {stats.discordouCount} discordaram ({(100 - stats.concordanciaRate).toFixed(0)}%)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-componente para cards de estatística
function StatCard({
  label,
  value,
  subtitle,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  };

  return (
    <div className="rounded-lg border border-border/60 bg-card p-3">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-md flex items-center justify-center ${colorMap[color] || colorMap.primary}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-xl font-bold text-foreground">{value}</div>
      {subtitle && <div className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</div>}
    </div>
  );
}
