# EmbryoScore — Plano de Integração no PassaGene

## Visão Geral

Integrar análise morfocinética por IA no fluxo de produção de embriões do PassaGene.
O biólogo filma no Samsung Video Pro, envia o vídeo pelo app, a IA analisa em background,
e os resultados aparecem no módulo Embriões.

**Stack atual:** Vite + React 19 + TypeScript + Tailwind + Supabase + TanStack Query + shadcn/ui
**IA:** Gemini (testado com gemini-3-flash-preview, avaliar gemini-2.5-flash para produção)
**Equipamento:** Nikon SMZ 645 + OptiREC (Custom Surgical) + Samsung Galaxy S23

---

## O que já existe no código

| Item | Localização | Status |
|------|-------------|--------|
| Tipo `AcasalamentoEmbrioesMedia` | `src/lib/types.ts:435` | ✅ Definido, não utilizado |
| Campo `acasalamento_media_id` em `Embriao` | `src/lib/types.ts:415` | ✅ Definido, não utilizado |
| Função `despacharEmbrioes()` | `src/pages/LotesFIV.tsx:151` | ✅ Funcional — ponto de integração |
| `ClassificarForm` (BE/BN/BX/BL/BI) | `src/components/embrioes/ClassificarForm.tsx` | ✅ Classificação manual |
| Prompt de análise testado | Protótipo Flask (app.py) | ✅ Funcional com Gemini |
| Bounding boxes + crop | Protótipo Flask (OpenCV) | ✅ Migrar para canvas JS |

---

## Arquitetura da Integração

```
Lote FIV (despacho)          Supabase                    Gemini
─────────────────           ─────────                   ──────
Biólogo informa qtd    ──→  embrioes (FRESCO)
Biólogo filma vídeo    ──→  Storage bucket               
Toca "Despachar"       ──→  acasalamento_embrioes_media
                             embryo_analysis_queue ──→  Edge Function ──→ API Gemini
                                                         ↓
                                                    Parseia JSON
                                                         ↓
Embriões (resultados)  ←──  embryo_scores ←────────  Salva scores
```

**Fluxo do usuário:**
1. Lotes FIV → informa quantidade de embriões por acasalamento (como já faz)
2. Para cada acasalamento, toca "Filmar" → abre galeria → seleciona vídeo do Video Pro
3. Toca "Despachar Todos" → cria embriões + enfileira vídeos para IA
4. Menu Embriões → scores aparecem conforme IA processa (segundos a minutos)

---

## SPRINT 1 — Banco de Dados e Storage (fundação)

### Objetivo
Criar tabelas, bucket e policies necessárias para o EmbryoScore.

### 1.1 Migration: tabelas novas

**Arquivo:** `supabase/migrations/20260208_embryoscore_tables.sql`

```sql
-- ============================================
-- EmbryoScore: tabelas de vídeo e análise IA
-- ============================================

-- Tabela de mídia dos acasalamentos (vídeos filmados no microscópio)
-- OBS: tipo AcasalamentoEmbrioesMedia já existe em types.ts
CREATE TABLE IF NOT EXISTS public.acasalamento_embrioes_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_fiv_acasalamento_id uuid NOT NULL REFERENCES public.lote_fiv_acasalamentos(id) ON DELETE CASCADE,
  tipo_media text NOT NULL DEFAULT 'VIDEO' CHECK (tipo_media IN ('VIDEO', 'IMAGEM')),
  arquivo_url text NOT NULL,
  arquivo_path text NOT NULL,
  arquivo_nome text NOT NULL,
  arquivo_tamanho bigint,
  mime_type text,
  duracao_segundos numeric,
  largura integer,
  altura integer,
  descricao text,
  data_gravacao timestamptz,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Scores individuais por embrião (resultado da IA)
CREATE TABLE IF NOT EXISTS public.embryo_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  embriao_id uuid NOT NULL REFERENCES public.embrioes(id) ON DELETE CASCADE,
  media_id uuid REFERENCES public.acasalamento_embrioes_media(id) ON DELETE SET NULL,
  
  -- Score final
  embryo_score numeric NOT NULL CHECK (embryo_score >= 0 AND embryo_score <= 100),
  classification text NOT NULL CHECK (classification IN ('Excelente','Bom','Regular','Borderline','Inviavel')),
  transfer_recommendation text NOT NULL CHECK (transfer_recommendation IN ('priority','recommended','conditional','second_opinion','discard')),
  confidence text NOT NULL DEFAULT 'medium' CHECK (confidence IN ('high','medium','low')),
  reasoning text,
  
  -- Morfologia
  morph_score numeric CHECK (morph_score >= 0 AND morph_score <= 100),
  stage text,
  icm_grade text CHECK (icm_grade IN ('A','B','C')),
  icm_description text,
  te_grade text CHECK (te_grade IN ('A','B','C')),
  te_description text,
  zp_status text,
  fragmentation text,
  morph_notes text,
  
  -- Cinética
  kinetic_score numeric CHECK (kinetic_score >= 0 AND kinetic_score <= 100),
  global_motion text,
  icm_activity text,
  te_activity text,
  blastocele_pulsation text,
  blastocele_pattern text,
  expansion_observed boolean DEFAULT false,
  stability text,
  motion_asymmetry text,
  most_active_region text,
  kinetic_notes text,
  viability_indicators jsonb DEFAULT '[]',
  
  -- Posição no vídeo (% do frame)
  position_description text,
  bbox_x_percent numeric,
  bbox_y_percent numeric,
  bbox_width_percent numeric,
  bbox_height_percent numeric,
  
  -- Imagem recortada do embrião (base64 ou path no storage)
  crop_image_path text,
  
  -- Metadados
  model_used text DEFAULT 'gemini-3-flash-preview',
  morph_weight numeric DEFAULT 0.7,
  kinetic_weight numeric DEFAULT 0.3,
  prompt_version text DEFAULT 'v1',
  processing_time_ms integer,
  raw_response jsonb,
  
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Fila de processamento (controle de jobs assíncronos)
CREATE TABLE IF NOT EXISTS public.embryo_analysis_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id uuid NOT NULL REFERENCES public.acasalamento_embrioes_media(id) ON DELETE CASCADE,
  lote_fiv_acasalamento_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  error_message text,
  retry_count integer DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Configuração de pesos (para recalibração futura)
CREATE TABLE IF NOT EXISTS public.embryo_score_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  morph_weight numeric NOT NULL DEFAULT 0.7,
  kinetic_weight numeric NOT NULL DEFAULT 0.3,
  model_name text NOT NULL DEFAULT 'gemini-3-flash-preview',
  prompt_version text NOT NULL DEFAULT 'v1',
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Inserir config padrão
INSERT INTO public.embryo_score_config (morph_weight, kinetic_weight, model_name, prompt_version, active)
VALUES (0.7, 0.3, 'gemini-3-flash-preview', 'v1', true)
ON CONFLICT DO NOTHING;

-- Índices
CREATE INDEX IF NOT EXISTS idx_embryo_scores_embriao ON public.embryo_scores(embriao_id);
CREATE INDEX IF NOT EXISTS idx_embryo_scores_media ON public.embryo_scores(media_id);
CREATE INDEX IF NOT EXISTS idx_embryo_queue_status ON public.embryo_analysis_queue(status);
CREATE INDEX IF NOT EXISTS idx_acasalamento_media_acasalamento ON public.acasalamento_embrioes_media(lote_fiv_acasalamento_id);

-- RLS
ALTER TABLE public.acasalamento_embrioes_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embryo_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embryo_analysis_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embryo_score_config ENABLE ROW LEVEL SECURITY;

-- Policies (mesmas do padrão existente — admin full, authenticated read)
CREATE POLICY "Authenticated users can read media" ON public.acasalamento_embrioes_media
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert media" ON public.acasalamento_embrioes_media
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can read scores" ON public.embryo_scores
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role can manage scores" ON public.embryo_scores
  FOR ALL TO service_role USING (true);

CREATE POLICY "Authenticated users can manage queue" ON public.embryo_analysis_queue
  FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can read config" ON public.embryo_score_config
  FOR SELECT TO authenticated USING (true);
```

### 1.2 Storage bucket

```sql
-- Criar bucket para vídeos de embriões
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'embryo-videos',
  'embryo-videos',
  false,
  524288000, -- 500MB
  ARRAY['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: authenticated pode upload e download
CREATE POLICY "Auth users upload embryo videos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'embryo-videos');

CREATE POLICY "Auth users read embryo videos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'embryo-videos');
```

### 1.3 Atualizar types.ts

Adicionar ao `src/lib/types.ts` (após `AcasalamentoEmbrioesMedia` existente):

```typescript
// EmbryoScore — análise por IA
export interface EmbryoScore {
  id: string;
  embriao_id: string;
  media_id?: string;
  
  // Score final
  embryo_score: number;
  classification: 'Excelente' | 'Bom' | 'Regular' | 'Borderline' | 'Inviavel';
  transfer_recommendation: 'priority' | 'recommended' | 'conditional' | 'second_opinion' | 'discard';
  confidence: 'high' | 'medium' | 'low';
  reasoning?: string;
  
  // Morfologia
  morph_score?: number;
  stage?: string;
  icm_grade?: 'A' | 'B' | 'C';
  icm_description?: string;
  te_grade?: 'A' | 'B' | 'C';
  te_description?: string;
  zp_status?: string;
  fragmentation?: string;
  morph_notes?: string;
  
  // Cinética
  kinetic_score?: number;
  global_motion?: string;
  icm_activity?: string;
  te_activity?: string;
  blastocele_pulsation?: string;
  blastocele_pattern?: string;
  expansion_observed?: boolean;
  stability?: string;
  motion_asymmetry?: string;
  most_active_region?: string;
  kinetic_notes?: string;
  viability_indicators?: string[];
  
  // Posição no vídeo
  position_description?: string;
  bbox_x_percent?: number;
  bbox_y_percent?: number;
  bbox_width_percent?: number;
  bbox_height_percent?: number;
  crop_image_path?: string;
  
  // Meta
  model_used?: string;
  morph_weight?: number;
  kinetic_weight?: number;
  prompt_version?: string;
  processing_time_ms?: number;
  
  created_at?: string;
}

export interface EmbryoAnalysisQueue {
  id: string;
  media_id: string;
  lote_fiv_acasalamento_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_message?: string;
  retry_count?: number;
  started_at?: string;
  completed_at?: string;
  created_at?: string;
}

export interface EmbryoScoreConfig {
  id: string;
  morph_weight: number;
  kinetic_weight: number;
  model_name: string;
  prompt_version: string;
  active: boolean;
  notes?: string;
  created_at?: string;
}

// Embrião com score (para listagens)
export interface EmbriaoComScore extends Embriao {
  score?: EmbryoScore | null;
}
```

### Verificação Sprint 1
- [ ] Migration executada no Supabase (Dashboard → SQL Editor)
- [ ] Bucket `embryo-videos` criado e com policies
- [ ] Types atualizados em `src/lib/types.ts`
- [ ] Types exportados em `src/lib/types/index.ts`
- [ ] App compila sem erros (`pnpm build`)

---

## SPRINT 2 — Upload de Vídeo no Despacho

### Objetivo
Adicionar captura de vídeo no fluxo de despacho de embriões (Lotes FIV).

### 2.1 Hook: useEmbryoVideoUpload

**Arquivo:** `src/hooks/useEmbryoVideoUpload.ts`

```typescript
// Responsabilidades:
// 1. Upload do vídeo para Supabase Storage (bucket embryo-videos)
// 2. Criar registro em acasalamento_embrioes_media
// 3. Criar job na embryo_analysis_queue
// 4. Retornar estado de upload (progress, error, mediaId)

// Path no storage: embryo-videos/{lote_fiv_id}/{acasalamento_id}/{timestamp}.mp4
// Validações: max 500MB, formatos mp4/mov/webm, min 3s max 30s (via duration check)
```

### 2.2 Componente: VideoUploadButton

**Arquivo:** `src/components/embryoscore/VideoUploadButton.tsx`

```
Props:
  - acasalamentoId: string
  - loteFivId: string
  - disabled?: boolean
  - onUploadComplete: (mediaId: string) => void

Comportamento:
  - Botão com ícone de câmera (lucide-react: Video ou Camera)
  - Toca → abre file picker (accept="video/*")
  - Mostra preview do vídeo selecionado (thumbnail + duração)
  - Mostra progresso de upload
  - Após upload: ícone verde de confirmação + badge "1 vídeo"
  - Se já tem vídeo: mostra badge + opção de adicionar outro

UI: seguir padrão premium do CLAUDE.md
  - bg-muted, verde como acento
  - Compacto — cabe na linha do acasalamento no LoteDetailView
```

### 2.3 Integrar no LoteDetailView

**Arquivo:** `src/components/lotes/LoteDetailView.tsx`

Modificação: Na tabela de acasalamentos (onde já tem o campo de quantidade), adicionar coluna de vídeo ao lado.

```
Antes:  [Doadora] [Touro] [Oócitos] [D3] [Embriões ___]
Depois: [Doadora] [Touro] [Oócitos] [D3] [Embriões ___] [📹 Filmar]
```

O botão "Filmar" só aparece quando:
- O lote está em D7 ou D8
- A quantidade de embriões está preenchida (> 0)
- Vídeo é OPCIONAL — não bloqueia o despacho

### 2.4 Modificar despacharEmbrioes()

**Arquivo:** `src/pages/LotesFIV.tsx` (função na linha 151)

Após criar os embriões na tabela `embrioes`, adicionar:

```typescript
// Para cada acasalamento que tem vídeo(s) anexado(s):
// 1. Vincular media_id aos embriões criados desse acasalamento
//    UPDATE embrioes SET acasalamento_media_id = ? 
//    WHERE lote_fiv_acasalamento_id = ?
// 2. Criar job na embryo_analysis_queue 
//    (status: 'pending', media_id, acasalamento_id)
// 3. Invocar edge function (fire-and-forget, não aguardar)
//    supabase.functions.invoke('embryo-analyze', { body: { queue_id } })
```

### Verificação Sprint 2
- [ ] Botão "Filmar" aparece na tela de Lotes FIV em D7/D8
- [ ] File picker abre e aceita vídeos
- [ ] Vídeo faz upload para bucket `embryo-videos`
- [ ] Registro criado em `acasalamento_embrioes_media`
- [ ] Despacho funciona normalmente com ou sem vídeo (vídeo é opcional)
- [ ] Job criado na `embryo_analysis_queue` quando tem vídeo

---

## SPRINT 3 — Edge Function de Análise (Gemini)

### Objetivo
Processar vídeos com Gemini e salvar scores no banco.

### 3.1 Edge Function: embryo-analyze

**Arquivo:** `supabase/functions/embryo-analyze/index.ts`

```
Endpoint: POST /embryo-analyze
Body: { queue_id: string }
Auth: service_role (invocado pelo app, não pelo browser direto)

Fluxo:
1. Buscar job na embryo_analysis_queue (status = 'pending')
2. Atualizar status → 'processing'
3. Baixar vídeo do Storage
4. Enviar para Gemini API (calibração + vídeo inline + prompt)
5. Parsear JSON de resposta
6. Para cada embrião detectado:
   a. Mapear para embrião do banco (por ordem/posição)
   b. Salvar em embryo_scores
7. Atualizar job → 'completed'
8. Em caso de erro → 'failed' + error_message + retry_count++

Timeout: 120s (vídeo de 10s leva ~30-60s no Gemini)
Retry: até 3 tentativas em caso de falha
```

### 3.2 Prompts (extraídos do protótipo testado)

Os prompts ficam no código da Edge Function como constantes.
São idênticos aos do `app.py` testado, com ajustes:
- Pesos dinâmicos (vêm da tabela `embryo_score_config`)
- Modelo dinâmico (vem da config)

```typescript
// No início da edge function:
const { data: config } = await supabase
  .from('embryo_score_config')
  .select('*')
  .eq('active', true)
  .single();

const morphWeight = config?.morph_weight ?? 0.7;
const kineticWeight = config?.kinetic_weight ?? 0.3;

// Injetar no prompt de calibração:
const calibrationPrompt = CALIBRATION_TEMPLATE
  .replace('{morph_weight}', morphWeight.toString())
  .replace('{kinetic_weight}', kineticWeight.toString());
```

### 3.3 Mapeamento embrião detectado → embrião no banco

**Lógica:**
A IA retorna N embriões no JSON. O banco tem M embriões para aquele acasalamento.
- Se N == M: mapear 1:1 pela ordem (IA embrião 1 → primeiro embrião do acasalamento)
- Se N != M: salvar scores mas marcar `confidence: 'low'` e gerar aviso
- O biólogo pode remapear manualmente depois (Sprint 5)

```typescript
// Buscar embriões do acasalamento ordenados por numero_lote/identificacao
const { data: embrioes } = await supabase
  .from('embrioes')
  .select('id, identificacao')
  .eq('lote_fiv_acasalamento_id', acasalamentoId)
  .order('identificacao', { ascending: true });

// Mapear por ordem
result.embryos.forEach((aiEmbryo, index) => {
  const embriao = embrioes[index];
  if (embriao) {
    // Salvar score vinculado ao embrião
    saveScore(embriao.id, mediaId, aiEmbryo);
  }
});
```

### 3.4 Secrets necessários no Supabase

```bash
# No dashboard Supabase → Edge Functions → Secrets
GEMINI_API_KEY=AIza...  # (migrar do .env do protótipo)
```

### Verificação Sprint 3
- [ ] Edge Function deploya sem erro
- [ ] Invocar manualmente com um queue_id funciona
- [ ] Gemini retorna JSON válido
- [ ] Scores salvos na tabela `embryo_scores`
- [ ] Job atualizado para 'completed'
- [ ] Erro tratado: job vai para 'failed' com mensagem

---

## SPRINT 4 — Visualização dos Scores (Menu Embriões)

### Objetivo
Mostrar os resultados da IA no módulo de Embriões existente.

### 4.1 Hook: useEmbryoScores

**Arquivo:** `src/hooks/useEmbryoScores.ts`

```typescript
// Buscar scores para um ou mais embriões
// Usar TanStack Query com polling quando status = 'processing'

export function useEmbryoScore(embriaoId: string) {
  return useQuery({
    queryKey: ['embryo-score', embriaoId],
    queryFn: () => supabase
      .from('embryo_scores')
      .select('*')
      .eq('embriao_id', embriaoId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),
    refetchInterval: (query) => {
      // Polling a cada 5s enquanto não tem score
      // Para de pollar quando tem resultado
      return query.state.data ? false : 5000;
    }
  });
}

export function useEmbryoAnalysisStatus(acasalamentoId: string) {
  return useQuery({
    queryKey: ['embryo-analysis-status', acasalamentoId],
    queryFn: () => supabase
      .from('embryo_analysis_queue')
      .select('*')
      .eq('lote_fiv_acasalamento_id', acasalamentoId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),
    refetchInterval: (query) => {
      const status = query.state.data?.data?.status;
      return (status === 'completed' || status === 'failed') ? false : 3000;
    }
  });
}
```

### 4.2 Componente: EmbryoScoreCard

**Arquivo:** `src/components/embryoscore/EmbryoScoreCard.tsx`

Componente compacto que mostra o score de um embrião.
Reutilizar o layout do protótipo HTML (já testado e aprovado),
adaptado para React + Tailwind + design tokens do PassaGene.

```
Estados:
  - Sem vídeo: não mostra nada (embrião sem análise IA)
  - Processando: skeleton + spinner + "Analisando..."
  - Erro: badge vermelho "Falha na análise" + retry
  - Completo: card com score, classificação, recomendação

Layout compacto (dentro da listagem de embriões):
  ┌──────────────────────────────────────────┐
  │ 🟢 78  Bom  │ Bl. Expandido │ Prioridade │
  │ Morfo: 82   │ Cinética: 69  │ Conf: Alta │
  └──────────────────────────────────────────┘

Layout expandido (ao clicar):
  - Foto recortada do embrião (crop da posição no frame)
  - Detalhes morfológicos (ICM, TE, ZP, fragmentação)
  - Detalhes cinéticos (movimento, pulsação, estabilidade)
  - Indicadores de viabilidade (tags)
  - Reasoning completo
  - Comparação com classificação manual do biólogo
```

### 4.3 Componente: EmbryoScoreBadge

**Arquivo:** `src/components/embryoscore/EmbryoScoreBadge.tsx`

Badge minimalista para usar em tabelas e listagens.

```
Cores (seguir padrão do protótipo testado):
  - 80-100: verde (#38a169) — Excelente
  - 60-79:  verde claro (#68d391) — Bom  
  - 40-59:  amarelo (#ecc94b) — Regular
  - 20-39:  laranja (#ed8936) — Borderline
  - 0-19:   vermelho (#e53e3e) — Inviável

Adaptar para CSS variables do PassaGene (dark mode compatível)
```

### 4.4 Componente: AnnotatedFrameViewer

**Arquivo:** `src/components/embryoscore/AnnotatedFrameViewer.tsx`

Migrar a lógica do protótipo (annotate_frame + crop_embryo) para canvas:

```typescript
// 1. Extrair frame central do vídeo usando <video> + <canvas>
// 2. Desenhar bounding boxes usando coordenadas % do score
// 3. Gerar crops individuais usando canvas.drawImage com clip
// Não precisa de OpenCV — canvas nativo faz tudo
```

### 4.5 Integrar na página Embriões

**Arquivo:** `src/pages/Embrioes.tsx`

Na listagem de embriões (PacoteEmbrioesTable), adicionar coluna de score.
No card individual do embrião (PacoteCard), adicionar EmbryoScoreCard expandível.

### 4.6 Componente: ComparativeAnalysisCard

**Arquivo:** `src/components/embryoscore/ComparativeAnalysisCard.tsx`

Mostrar ranking e análise comparativa quando há múltiplos embriões
do mesmo acasalamento com score. Usar dados de `comparative_analysis`
do JSON do Gemini.

### Verificação Sprint 4
- [ ] Score aparece ao lado do embrião na listagem
- [ ] Badge colorido por faixa de score
- [ ] Card expandível com detalhes completos
- [ ] Imagem recortada do embrião visível
- [ ] Frame anotado com bounding boxes
- [ ] Ranking comparativo funcional
- [ ] Polling funciona (score aparece automaticamente quando IA termina)
- [ ] Estado "processando" com skeleton animado
- [ ] Dark mode compatível

---

## SPRINT 5 — Refinamentos e Loop de Calibração

### Objetivo
Ajustes finos, discrepância biólogo vs IA, e preparação para recalibração.

### 5.1 Aviso de discrepância

Quando o biólogo classifica manualmente (BE/BN/BX/BL/BI) e a IA dá um score
muito diferente, mostrar aviso:

```
Mapeamento classificação → faixa de score esperada:
  BE (Excelente) → 80-100
  BN (Normal)    → 60-79
  BX (Regular)   → 40-59
  BL (Limitado)  → 20-39
  BI (Irregular) → 0-19

Se |score_ia - midpoint_classificacao| > 25:
  Mostrar badge amarelo "Divergência IA vs Biólogo"
  Biólogo pode confirmar sua classificação ou ajustar
```

### 5.2 Feedback do biólogo

Adicionar campo `biologo_concorda` (boolean) + `biologo_nota` (text) na `embryo_scores`.
O biólogo pode concordar/discordar do score e anotar observações.
Esses dados alimentam a recalibração futura.

```sql
ALTER TABLE public.embryo_scores 
  ADD COLUMN IF NOT EXISTS biologo_concorda boolean,
  ADD COLUMN IF NOT EXISTS biologo_nota text;
```

### 5.3 Dashboard de correlação Score × Prenhez

Quando os dados de DG (diagnóstico de gestação) estiverem disponíveis
(30-60 dias depois), correlacionar:

```
embryo_scores.embryo_score → transferencias_embrioes → diagnosticos_gestacao.resultado
```

Componente: gráfico scatter Score (eixo X) vs Taxa de Prenhez (eixo Y).
Usar Recharts (já instalado no projeto).

### 5.4 Remapeamento manual

Se a IA detectou N embriões diferente de M no banco, permitir que o biólogo
remapeie manualmente: arrastar score para o embrião correto.

### 5.5 Config de pesos no Admin

No menu Administrativo, aba "EmbryoScore", permitir ajustar pesos
(morph_weight / kinetic_weight) e ver histórico de configs.

### Verificação Sprint 5
- [ ] Aviso de discrepância aparece quando classificação diverge
- [ ] Biólogo pode concordar/discordar do score
- [ ] Dashboard Score × Prenhez funcional (quando houver dados)
- [ ] Remapeamento manual funciona
- [ ] Config de pesos editável no Admin

---

## Instruções para Claude Code

### Ordem de execução

```
Sprint 1 → Sprint 2 → Sprint 3 → Sprint 4 → Sprint 5
```

Cada Sprint é independente e testável. Não pule.

### Convenções do projeto (CLAUDE.md)

- **CSS:** bg-muted, text-foreground, border-border (nunca hardcodar cores)
- **Verde como acento pontual**, nunca dominante
- **Fontes:** Manrope (texto), Outfit (títulos)
- **Bordas:** rounded-lg (8px) / rounded-xl (16px)
- **Tabelas:** CSS Grid, não `<table>` HTML
- **Dark mode:** obrigatório (usar CSS variables)
- **Componentes:** shadcn/ui padrão
- **State management:** TanStack Query para server state
- **Toasts:** sonner (já configurado)
- **Icons:** lucide-react
- **NUNCA efetue mudanças sem aprovação prévia do usuário**

### Padrões de código existentes

```typescript
// API queries: src/api/supabaseQueries.ts
// Hooks com TanStack Query: src/api/hooks.ts  
// Types: src/lib/types.ts + src/lib/types/index.ts
// Validações: src/lib/validations/index.ts
// Auth: src/contexts/AuthContext.tsx
// Supabase client: src/lib/supabase.ts
```

### Arquivos que serão MODIFICADOS (não criar do zero)

| Arquivo | Modificação |
|---------|-------------|
| `src/lib/types.ts` | Adicionar EmbryoScore, EmbryoAnalysisQueue, EmbryoScoreConfig |
| `src/lib/types/index.ts` | Exportar novos types |
| `src/pages/LotesFIV.tsx` | Modificar despacharEmbrioes(), integrar upload |
| `src/components/lotes/LoteDetailView.tsx` | Adicionar coluna de vídeo |
| `src/pages/Embrioes.tsx` | Integrar EmbryoScoreCard |
| `src/components/embrioes/PacoteCard.tsx` | Adicionar badge de score |
| `src/components/embrioes/PacoteEmbrioesTable.tsx` | Adicionar coluna score |
| `src/App.tsx` | (Sprint 5) Rota admin para config |

### Arquivos NOVOS a criar

| Arquivo | Sprint |
|---------|--------|
| `supabase/migrations/20260208_embryoscore_tables.sql` | 1 |
| `src/hooks/useEmbryoVideoUpload.ts` | 2 |
| `src/hooks/useEmbryoScores.ts` | 4 |
| `src/components/embryoscore/VideoUploadButton.tsx` | 2 |
| `src/components/embryoscore/EmbryoScoreCard.tsx` | 4 |
| `src/components/embryoscore/EmbryoScoreBadge.tsx` | 4 |
| `src/components/embryoscore/AnnotatedFrameViewer.tsx` | 4 |
| `src/components/embryoscore/ComparativeAnalysisCard.tsx` | 4 |
| `src/components/embryoscore/index.ts` | 4 |
| `supabase/functions/embryo-analyze/index.ts` | 3 |
| `src/lib/embryoscore/prompts.ts` | 3 |
| `src/lib/embryoscore/videoUtils.ts` | 4 |

### Dicas de implementação

1. **Storage path:** `embryo-videos/{lote_fiv_id}/{acasalamento_id}/{Date.now()}.mp4`
2. **Edge Function:** usar `Deno.serve` + `createClient` do @supabase/supabase-js
3. **Gemini API:** usar SDK `@google/generative-ai` (npm) ou REST direto
4. **Frame extraction no browser:** `<video>` + `<canvas>.drawImage(video, 0, 0)` + `.toDataURL()`
5. **Crop no browser:** `canvas.drawImage(video, sx, sy, sw, sh, 0, 0, dw, dh)`
6. **Polling com TanStack Query:** `refetchInterval` condicional (para quando completa)
7. **Toast de sucesso:** "Vídeo enviado! Análise em andamento..." (não bloquear UI)
8. **Vídeo é SEMPRE opcional** — despacho funciona sem vídeo (como hoje)
