# EmbryoScore v2 — Plano Completo de Implementação

## Documento Único de Referência para Claude Code

**Projeto:** PassaGene — Módulo EmbryoScore  
**Data:** 13/02/2026  
**Versão:** 2.1 (cross-species transfer learning + scoring dual KNN+MLP)  
**Lab:** Passatempo Embriões, Dores do Indaiá/MG  
**Objetivo:** Substituir avaliação Gemini (alucina) por DINOv2 + KNN + MLP cross-species (similaridade visual + cinética real + classificador treinado).  
**Princípio:** Alterar o mínimo possível. Reaproveitar tudo que funciona.  
**Design System:** PassaGene DS — ver seção 18 para tokens obrigatórios.  
**Inovação:** Transfer learning cross-species usando ~2.800 referências públicas (humanas + bovinas) para bootstrap do atlas + classificador MLP desde o dia 1.

---

## 1. CONTEXTO E MOTIVAÇÃO

### 1.1 O que é o EmbryoScore

Sistema de segunda opinião automatizada para classificação de embriões bovinos (FIV). O biólogo classifica manualmente e a IA oferece uma segunda opinião baseada em similaridade visual + análise de atividade cinética intracelular.

### 1.2 Por que substituir o sistema anterior

O sistema v1 usava Gemini Flash para avaliar morfologia de embriões via prompt. **Resultado: todas as avaliações estavam erradas.** O Gemini Flash (e modelos genéricos em geral) não possuem conhecimento real de embriologia bovina e alucinam avaliações convincentes porém incorretas.

### 1.3 Nova abordagem

Em vez de pedir a uma IA genérica para "avaliar", o novo sistema:

1. **Compara visualmente** o embrião com um banco de referências classificadas por biólogos reais
2. **Analisa atividade cinética** (movimento intracelular) via diferença de pixels entre frames
3. **Combina ambos** numa imagem composta que o DINOv2 transforma em vetor
4. **Busca os 10 embriões mais parecidos** (visual + cinética) no banco por similaridade natural
5. **Vota** pela classificação mais frequente entre os vizinhos
6. **Classificador MLP** treinado em dados cross-species (humano + bovino) fornece segunda opinião
7. **Scoring dual** combina KNN + MLP com peso dinâmico (MLP domina no início, KNN assume conforme atlas cresce)

**Nenhuma IA generativa avalia. É busca por similaridade + classificador treinado.**

**Inovação cross-species:** O atlas nasce com ~2.800 referências de datasets públicos (2.344 blastocistos humanos + 482 bovinos). A morfologia embrionária é conservada entre mamíferos — ICM, TE, blastocoel, fragmentação são visualmente idênticos. O DINOv2 captura estrutura visual, não espécie. Dados reais bovinos gradualmente substituem as referências cross-species conforme acumulam.

---

## 2. DIAGNÓSTICO DO SISTEMA ATUAL

### O que funciona (NÃO MEXER)

| Componente | Arquivo | Status |
|---|---|---|
| Câmera + gravação | `src/components/camera/EmbryoCamera.jsx` | ✅ Perfeito |
| Upload de vídeo | `src/hooks/useEmbryoVideoUpload.ts` | ✅ Perfeito |
| Storage (Supabase) | Bucket `embryo-videos/` | ✅ Perfeito |
| Fila de análise | Tabela `embryo_analysis_queue` | ✅ Reaproveitar |
| Disparo fire-and-forget | `LotesFIV.tsx` linhas ~420-461 | ✅ Perfeito |
| Edge Function (estrutura) | `supabase/functions/embryo-analyze/index.ts` | ⚠️ Manter estrutura, trocar conteúdo |
| Detecção de embriões (Gemini box_2d) | Dentro da Edge Function, passo 5c | ✅ Perfeito |
| UI - página de lotes | `src/pages/LotesFIV.tsx` | ✅ Manter |
| UI - botão de upload | `src/components/embryoscore/VideoUploadButton.tsx` | ✅ Manter |
| UI - detalhe do lote | `src/components/lotes/LoteDetailView.tsx` | ✅ Manter |

### O que NÃO funciona (SUBSTITUIR)

| Componente | Problema | Solução |
|---|---|---|
| Cloud Run `/extract-frame` | Extrai 1 frame só | Novo endpoint `/extract-and-crop` |
| Cloud Run `/analyze-activity` | Cinética de 1 frame (sem sentido) | **Remover. Cinética real no DINOv2 service** |
| Gemini avaliação morfológica (passo 5f) | **Alucina todas as avaliações** | **Remover. Substituir por DINOv2 + KNN** |
| `embryo_scores` (campos) | Campos do resultado Gemini | Campos do resultado KNN |
| `EmbryoScoreCard.tsx` | Mostra dados do Gemini | Mostrar dados do KNN + mapa cinético |
| `LoteScoreDashboard.tsx` | Médias do Gemini | Distribuição por classe + concordância |

---

## 3. ARQUITETURA — FLUXO CORRIGIDO

### REGRA CRÍTICA: Os 40 frames NUNCA saem do Cloud Run

A Edge Function do Supabase não tem Canvas, ImageMagick, nem memória suficiente pra manipular 40 frames completos. Todo processamento de imagem pesado fica no Cloud Run. **O celular não processa nada.** Só grava, envia e exibe resultados.

```
EDGE FUNCTION (orquestra, leve):
  │
  ├─ 1. Busca job, status → processing
  │
  ├─ 2. Cloud Run /extract-frame (JÁ EXISTE)
  │     → Retorna: 1 frame JPEG (base64)
  │
  ├─ 3. Gemini box_2d no frame (JÁ EXISTE)
  │     → Retorna: bboxes[] dos embriões detectados
  │
  ├─ 4. Cloud Run /extract-and-crop (NOVO)
  │     Recebe: video_url + bboxes
  │     Internamente:
  │       - Extrai 40 frames do vídeo
  │       - Aplica cada bbox nos 40 frames → crops por embrião
  │       - Frames completos MORREM aqui, nunca trafegam
  │     Retorna: { embryo_0: [crop1...crop40], embryo_1: [...] }
  │              (crops pequenos ~30KB cada)
  │              + plate_frame_b64 (frame completo da placa, 1 só)
  │
  ├─ 5. Cloud Run DINOv2 /analyze-embryo (NOVO, com GPU)
  │     Para cada embrião (em PARALELO com Promise.all):
  │       Recebe: 40 crops do embrião
  │       Internamente:
  │         - Alinha crops (template matching)
  │         - Seleciona mais nítido (Laplacian)
  │         - Calcula mapa cinético (diff pixels + subtração ruído)
  │         - Compõe imagem (morph + mapa lado a lado)
  │         - Gera embedding DINOv2 (768 dims)
  │       Retorna: embedding + imagens + métricas cinéticas
  │
  ├─ 6. Supabase pgvector KNN (em PARALELO com Promise.all)
  │     Para cada embrião:
  │       match_embryos(embedding, 10) → vizinhos → votos
  │
  ├─ 7. Salva imagens no Storage
  │     plate_frame.jpg (1 por despacho)
  │     emb_N_frame.jpg, emb_N_motion.jpg, emb_N_composite.jpg
  │
  ├─ 8. Salva scores em embryo_scores + plate info na queue
  │
  └─ 9. Status → completed

DEPOIS (revisão do relatório — biólogo NÃO classifica durante envase):
  Biólogo abre tela de revisão pré-despacho
  Vê placa panorâmica com embriões numerados (topo)
  Revisa cada embrião: frame + mapa + minimapa + sugestão KNN
  Confirma/corrige classificação
  Cada confirmação → nova referência no atlas (cresce automaticamente)
  Quando todos classificados → despacha
```

### Serviços e responsabilidades

| Serviço | Recebe | Retorna | Dados pesados |
|---|---|---|---|
| Edge Function | IDs e URLs | Orquestra chamadas | **Nunca toca em frames completos** |
| Cloud Run `/extract-frame` | video_url | 1 JPEG base64 | 1 frame |
| Cloud Run `/extract-and-crop` (NOVO) | video_url + bboxes | crops por embrião + plate_frame | **40 frames internos, morrem aqui** |
| Cloud Run DINOv2 `/analyze-embryo` (NOVO) | crops de 1 embrião | embedding + imagens | Crops pequenos (~30KB cada) |
| Supabase pgvector | embedding 768d | 10 vizinhos | Vetores (3KB) |

---

## 4. BANCO DE DADOS (Supabase)

### 4a. Habilitar pgvector

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 4b. Nova tabela: embryo_references

Esta tabela é o "atlas" que cresce com o uso. Cada embrião classificado pelo biólogo vira uma referência.

```sql
CREATE TABLE embryo_references (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Identificação
  lab_id UUID NOT NULL,
  lote_fiv_id UUID REFERENCES lotes_fiv(id),
  acasalamento_id UUID REFERENCES acasalamentos(id),
  embriao_id UUID REFERENCES embrioes(id),
  
  -- Classificação do biólogo (ground truth)
  classification TEXT NOT NULL,  -- 'BE','BN','BX','BL','BI','Mo','Dg'
  stage_iets INT,                -- 1-9 (opcional)
  
  -- Embedding DINOv2 (imagem composta: morfologia + cinética)
  embedding vector(768) NOT NULL,
  
  -- Métricas cinéticas (informativas)
  kinetic_intensity REAL,
  kinetic_harmony REAL,
  kinetic_symmetry REAL,
  kinetic_stability REAL,
  kinetic_bg_noise REAL,
  
  -- Imagens no Supabase Storage
  best_frame_path TEXT,
  motion_map_path TEXT,
  composite_path TEXT,
  crop_image_path TEXT,
  
  -- Resultado de DG (preenchido depois, quando disponível)
  pregnancy_result BOOLEAN,      -- true = prenhou, false = não, null = pendente
  pregnancy_checked_at TIMESTAMPTZ,
  
  -- Metadados
  ai_suggested_class TEXT,
  ai_confidence REAL,
  biologist_agreed BOOLEAN,
  
  -- Proteção contra classificação errada
  review_mode TEXT DEFAULT 'standard',
  -- 'standard' = revisão normal do relatório
  -- 'quick' = classificação rápida (menor peso futuro)
  -- 'expert' = revisada por especialista (maior peso futuro)
  
  -- Dados do setup (pra análise futura)
  microscope_model TEXT,
  camera_device TEXT,
  zoom_level TEXT,
  
  -- Cross-species (bootstrap com dados públicos)
  species TEXT NOT NULL DEFAULT 'bovine_real',
  -- 'bovine_real' = lab real, 'bovine_rocha' = dataset Rocha, 'human' = dataset Kromp
  source TEXT NOT NULL DEFAULT 'lab'
  -- 'lab' = classificação real, 'dataset_rocha', 'dataset_kromp', 'dataset_kaggle'
);

-- Índice vetorial HNSW para busca KNN rápida
CREATE INDEX embryo_refs_embedding_idx 
  ON embryo_references 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_embryo_refs_class ON embryo_references(classification);
CREATE INDEX idx_embryo_refs_lab ON embryo_references(lab_id);
CREATE INDEX idx_embryo_refs_pregnancy ON embryo_references(pregnancy_result);
CREATE INDEX idx_embryo_refs_species ON embryo_references(species);
```

### 4c. Função de busca KNN

```sql
CREATE OR REPLACE FUNCTION match_embryos(
  query_embedding vector(768),
  match_count INT DEFAULT 10,
  filter_lab_id UUID DEFAULT NULL,
  min_similarity FLOAT DEFAULT 0.65
)
RETURNS TABLE (
  id UUID,
  classification TEXT,
  similarity REAL,
  species TEXT,
  kinetic_intensity REAL,
  kinetic_harmony REAL,
  pregnancy_result BOOLEAN,
  best_frame_path TEXT,
  motion_map_path TEXT
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    er.id,
    er.classification,
    (1 - (er.embedding <=> query_embedding))::REAL as similarity,
    er.species,
    er.kinetic_intensity,
    er.kinetic_harmony,
    er.pregnancy_result,
    er.best_frame_path,
    er.motion_map_path
  FROM embryo_references er
  WHERE (filter_lab_id IS NULL OR er.lab_id = filter_lab_id)
    AND (1 - (er.embedding <=> query_embedding)) > min_similarity
  ORDER BY er.embedding <=> query_embedding ASC
  LIMIT match_count;
END;
$$;
```

**Nota:** Sem peso artificial por espécie. O DINOv2 já resolve isso naturalmente — embriões bovinos reais (mesmo microscópio, mesma iluminação) terão similaridade de cosseno maior com outros bovinos reais do que com embriões humanos (setup diferente). Conforme dados reais acumulam, eles naturalmente dominam os resultados KNN. As colunas `species` e `source` existem para analytics, não para ranking.

### 4d. Performance do pgvector

| Volume de referências | Tempo de busca KNN (10 vizinhos) |
|---|---|
| 1.000 | <10ms |
| 10.000 | <30ms |
| 100.000 | <50ms |
| 1.000.000 | <100ms (com índice HNSW) |

### 4e. Alterar tabela embryo_scores

Adicionar campos novos, manter os antigos como nullable pra não quebrar:

```sql
ALTER TABLE embryo_scores ADD COLUMN IF NOT EXISTS
  knn_classification TEXT,
  knn_confidence REAL,
  knn_votes JSONB,           -- {"BE":2,"BN":5,"BX":3}
  knn_neighbor_ids UUID[],
  knn_real_bovine_count INT, -- quantos vizinhos são bovine_real
  embedding vector(768),
  kinetic_intensity REAL,
  kinetic_harmony REAL,
  kinetic_symmetry REAL,
  kinetic_stability REAL,
  kinetic_bg_noise REAL,
  motion_map_path TEXT,
  composite_path TEXT,
  biologist_classification TEXT,
  biologist_agreed BOOLEAN,
  -- Scoring dual (KNN + MLP)
  mlp_classification TEXT,         -- classificação do MLP
  mlp_confidence REAL,             -- confiança do MLP (0-100)
  mlp_probabilities JSONB,         -- {"BE":5,"BN":62,"BX":20,"BL":8,"BI":3,"Mo":1,"Dg":1}
  combined_source TEXT,            -- 'knn' | 'knn_mlp_agree' | 'knn_mlp_disagree' | 'mlp_only' | 'insufficient'
  combined_classification TEXT,    -- classificação final combinada
  combined_confidence REAL;        -- confiança final combinada
```

### 4f. Alterar tabela embryo_analysis_queue

```sql
ALTER TABLE embryo_analysis_queue ADD COLUMN IF NOT EXISTS
  plate_frame_path TEXT,        -- path do frame completo da placa no Storage
  detected_bboxes JSONB;        -- [{x_percent, y_percent, width_percent, height_percent}, ...]
```

### 4g. Buckets no Storage

```
embryoscore/
  {lote_fiv_id}/
    {acasalamento_id}/
      {queue_id}/
        plate_frame.jpg              ← frame completo da placa (1 por despacho)
        emb_{index}_frame.jpg        ← melhor frame do embrião
        emb_{index}_motion.jpg       ← mapa cinético
        emb_{index}_composite.jpg    ← imagem composta (morph + cinética)
```

### 4h. RLS de Storage

```sql
CREATE POLICY "labs_own_images" ON storage.objects
  FOR ALL USING (
    bucket_id = 'embryoscore' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
```

### 4i. Estimativa de storage

| Item | Tamanho | Volume (1 lab, 1 ano) | Total |
|---|---|---|---|
| Frame JPEG | ~100KB | 12.000 | ~1.2GB |
| Motion map JPEG | ~50KB | 12.000 | ~600MB |
| Composite JPEG | ~150KB | 12.000 | ~1.8GB |
| **Total por lab/ano** | | | **~3.6GB** |
| **50 labs/ano** | | | **~180GB** |

Custo Supabase Storage: ~R$25-50/mês para 200GB.

---

## 5. NOVO CLOUD RUN: DINOv2 API

### 5.1 O que é DINOv2

Modelo de visão computacional da Meta (Facebook AI Research). Open source, gratuito.

- **Função:** Transforma qualquer imagem num vetor de 768 números (embedding)
- **Propriedade:** Imagens visualmente similares geram vetores próximos
- **Tamanho:** ~85MB (ViT-B/14)
- **Latência:** ~200ms por imagem na GPU L4
- **Treinamento:** 142 milhões de imagens (ImageNet-22k + LVD-142M)
- **Licença:** Apache 2.0 (uso comercial permitido)

Por que DINOv2 e não outros:
- **CLIP (OpenAI):** Feito para associar imagem↔texto, fraco em diferenças visuais sutis
- **ResNet/EfficientNet:** Precisam ser treinados do zero com dados anotados
- **DINOv2:** Especializado em **similaridade visual pura**, funciona out-of-the-box sem treino

### 5.2 Pipeline de processamento

```
ENTRADA: 40 crops JPEG (base64) de um embrião ao longo do tempo

PASSO 1 — Alinhamento de crops (template matching)
  - Alinha todos os crops ao primeiro (compensa deslocamento na placa)
  - cv2.matchTemplate → calcula offset → cv2.warpAffine
  - Descarta crops com deslocamento > 20px

PASSO 2 — Seleção do melhor crop (Laplacian variance)
  - Converte cada crop para grayscale
  - Aplica kernel Laplaciano
  - Crop com maior variância = mais nítido

PASSO 3 — Mapa de movimento (diff pixels com subtração de ruído)
  - Para cada par de crops consecutivos:
    - Calcula diferença absoluta por pixel (média RGB)
    - Acumula diferenças num mapa 2D
  - Subtração de ruído de fundo:
    - Define zona de referência: 15% das bordas do crop
    - Calcula média de movimento nas bordas (= ruído do setup)
    - Subtrai ruído × 1.2 (margem de segurança) de todo o mapa
    - Pixels com valor < 0 → 0
  - Normaliza mapa para 0-255
  - Aplica colormap HOT: preto → verde → amarelo → branco

PASSO 4 — Métricas cinéticas (informativas, não usadas no KNN)
  - Intensidade: média das diferenças entre frames (zona central)
  - Harmonia: 1 - (desvio padrão / média) das diferenças
  - Simetria: comparação de atividade entre 4 quadrantes
  - Estabilidade: 1 - coeficiente de variação das diferenças
  - Ruído de fundo: valor médio subtraído (qualidade da gravação)
  NOTA: Estes valores não têm significado clínico até correlação com DG.

PASSO 5 — Composição da imagem
  [Melhor crop (morfologia)] [Mapa de movimento (cinética)]
  O DINOv2 processa esta imagem como um todo → embedding captura ambos.

PASSO 6 — Embedding DINOv2
  - Redimensiona imagem composta para 224×224
  - Normaliza (ImageNet mean/std)
  - Passa pelo DINOv2 ViT-B/14
  - Retorna vetor de 768 dimensões

SAÍDA: embedding + imagens (base64) + métricas cinéticas
```

### 5.3 Subtração de ruído — detalhe técnico

O mapa de movimento bruto captura **qualquer mudança de pixel**, incluindo tremido da câmera, ruído do sensor, artefatos de compressão H.264, oscilação de luz, bolhas de ar no meio de cultura.

A subtração funciona assim:
- As **bordas do crop** (15% de cada lado) são zona de referência
- Nessa zona não há embrião, apenas meio de cultura
- Qualquer movimento detectado ali é **ruído do setup**
- Esse valor médio é subtraído de **todo o crop**
- O que sobra são apenas movimentos que excedem o nível de ruído

**Limitação:** Se o embrião ocupa quase todo o crop (zoom muito alto), as bordas podem conter parte do embrião.

### 5.4 Imagem composta — por que funciona

```
┌──────────────────┬──────────────────┐
│                  │     ░░░░░        │
│   Melhor frame   │   ░░████░░      │
│   (como o        │   ░██████░      │
│    embrião       │   ░░████░░      │
│    aparece)      │     ░░░░░       │
│                  │                  │
│   MORFOLOGIA     │  MAPA CINÉTICO   │
└──────────────────┴──────────────────┘
```

O DINOv2 gera um **único embedding** que captura ambas as informações. Quando o KNN busca vizinhos similares, encontra embriões que **parecem iguais E se movem de forma similar**. As relações entre morfologia e cinética emergem naturalmente dos dados, sem fórmulas ou pesos definidos manualmente.

### 5.5 Código: app.py

```python
import io
import base64
import json
import numpy as np
import torch
import cv2
from PIL import Image
from torchvision import transforms
from fastapi import FastAPI, UploadFile, Form
from fastapi.responses import JSONResponse

app = FastAPI()

# Carrega DINOv2 uma vez no startup
model = torch.hub.load('facebookresearch/dinov2', 'dinov2_vitb14')
model.eval().cuda()

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

BORDER_PCT = 0.15
NOISE_MARGIN = 1.2


@app.post("/analyze-embryo")
async def analyze_embryo(frames_json: str = Form(...)):
    """
    Recebe lista de crops JPEG (base64) de um embrião ao longo do tempo.
    Retorna: embedding + mapa cinético + métricas + imagens.
    """
    frame_list = json.loads(frames_json)
    
    crops = []
    for b64 in frame_list:
        img_bytes = base64.b64decode(b64)
        arr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if frame is not None:
            crops.append(frame)
    
    if len(crops) < 5:
        return JSONResponse({"error": "Crops insuficientes"}, 400)
    
    # 1. Alinha crops ao primeiro
    crops = align_crops(crops)
    
    # 2. Melhor crop (mais nítido)
    best_idx = select_sharpest(crops)
    best_frame = crops[best_idx]
    
    # 3. Mapa de movimento com subtração de ruído
    motion_map, kinetics = compute_motion_map(crops)
    
    # 4. Compõe imagem lado a lado
    composite = compose_image(best_frame, motion_map)
    
    # 5. Embedding DINOv2
    tensor = transform(composite).unsqueeze(0).cuda()
    with torch.no_grad():
        emb = model(tensor)
    embedding = emb[0].cpu().tolist()
    
    # 6. Codifica imagens
    _, best_jpg = cv2.imencode('.jpg', best_frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
    _, motion_jpg = cv2.imencode('.jpg', motion_map, [cv2.IMWRITE_JPEG_QUALITY, 85])
    composite_bgr = cv2.cvtColor(np.array(composite), cv2.COLOR_RGB2BGR)
    _, comp_jpg = cv2.imencode('.jpg', composite_bgr, [cv2.IMWRITE_JPEG_QUALITY, 85])
    
    return {
        "embedding": embedding,
        "kinetics": kinetics,
        "best_frame_b64": base64.b64encode(best_jpg.tobytes()).decode(),
        "motion_map_b64": base64.b64encode(motion_jpg.tobytes()).decode(),
        "composite_b64": base64.b64encode(comp_jpg.tobytes()).decode(),
        "frame_count": len(crops),
        "best_frame_index": best_idx
    }


def align_crops(crops):
    """Alinha todos os crops ao primeiro via template matching."""
    reference = cv2.cvtColor(crops[0], cv2.COLOR_BGR2GRAY)
    aligned = [crops[0]]
    for i in range(1, len(crops)):
        gray = cv2.cvtColor(crops[i], cv2.COLOR_BGR2GRAY)
        result = cv2.matchTemplate(gray, reference, cv2.TM_CCOEFF_NORMED)
        _, _, _, max_loc = cv2.minMaxLoc(result)
        dy, dx = max_loc[1], max_loc[0]
        if abs(dx) < 20 and abs(dy) < 20:
            M = np.float32([[1, 0, -dx], [0, 1, -dy]])
            aligned.append(cv2.warpAffine(crops[i], M, (crops[i].shape[1], crops[i].shape[0])))
        else:
            aligned.append(crops[i])
    return aligned


def select_sharpest(frames):
    best_idx, best_val = 0, -1
    for i, f in enumerate(frames):
        gray = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY)
        val = cv2.Laplacian(gray, cv2.CV_64F).var()
        if val > best_val:
            best_val = val
            best_idx = i
    return best_idx


def compute_motion_map(frames):
    h, w = frames[0].shape[:2]
    motion_raw = np.zeros((h, w), dtype=np.float64)
    bx, by = int(w * BORDER_PCT), int(h * BORDER_PCT)
    border_mask = np.ones((h, w), dtype=bool)
    border_mask[by:h-by, bx:w-bx] = False
    center_mask = ~border_mask
    
    diffs = []
    for i in range(1, len(frames)):
        diff = cv2.absdiff(frames[i], frames[i-1]).mean(axis=2)
        motion_raw += diff
        border_mean = diff[border_mask].mean() if border_mask.any() else 0
        center_mean = diff[center_mask].mean() if center_mask.any() else 0
        diffs.append(max(0, center_mean - border_mean))
    
    bg_noise = float(motion_raw[border_mask].mean()) if border_mask.any() else 0
    threshold = bg_noise * NOISE_MARGIN
    motion_clean = np.maximum(0, motion_raw - threshold)
    
    if motion_clean.max() > 0:
        motion_norm = (motion_clean / motion_clean.max() * 255).astype(np.uint8)
    else:
        motion_norm = np.zeros((h, w), dtype=np.uint8)
    
    motion_colored = cv2.applyColorMap(motion_norm, cv2.COLORMAP_HOT)
    
    d = np.array(diffs) if diffs else np.array([0])
    intensity = float(d.mean())
    harmony = float(1 - min(1, d.std() / (intensity + 0.001)))
    stability = float(1 - min(1, (d.std() / (intensity + 0.001)) if intensity > 0 else 0))
    half_h, half_w = h // 2, w // 2
    quads = [motion_norm[:half_h,:half_w].mean(), motion_norm[:half_h,half_w:].mean(),
             motion_norm[half_h:,:half_w].mean(), motion_norm[half_h:,half_w:].mean()]
    q_mean, q_std = np.mean(quads), np.std(quads)
    symmetry = float(1 - min(1, q_std / (q_mean + 0.001)))
    
    return motion_colored, {
        "intensity": round(intensity, 4), "harmony": round(harmony, 4),
        "symmetry": round(symmetry, 4), "stability": round(stability, 4),
        "background_noise": round(bg_noise, 2)
    }


def compose_image(frame, motion_map):
    h, w = frame.shape[:2]
    motion_resized = cv2.resize(motion_map, (w, h))
    composite = np.hstack([frame, motion_resized])
    return Image.fromarray(cv2.cvtColor(composite, cv2.COLOR_BGR2RGB))


@app.get("/health")
async def health():
    return {"status": "ok", "model": "dinov2_vitb14"}
```

### 5.6 Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx libglib2.0-0 && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
    torch torchvision --index-url https://download.pytorch.org/whl/cu121 \
    fastapi uvicorn pillow numpy opencv-python-headless python-multipart

COPY app.py .

# Baixa o modelo na build (não no runtime)
RUN python -c "import torch; torch.hub.load('facebookresearch/dinov2', 'dinov2_vitb14')"

EXPOSE 8080
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080"]
```

### 5.7 Deploy

```bash
gcloud builds submit --tag gcr.io/SEU_PROJETO/embryoscore-dinov2

gcloud run deploy embryoscore-dinov2 \
  --image gcr.io/SEU_PROJETO/embryoscore-dinov2 \
  --gpu 1 --gpu-type nvidia-l4 \
  --cpu 4 --memory 16Gi \
  --max-instances 3 --min-instances 0 \
  --region us-central1 \
  --timeout 60
```

### 5.8 Custos estimados

| Escala | GPU Cloud Run | Gemini (recorte) | Supabase | Total/mês |
|---|---|---|---|---|
| 1 lab (50/dia) | R$1 | R$33 | R$0 (free tier) | ~R$34 |
| 10 labs | R$10 | R$330 | R$25 | ~R$365 |
| 50 labs | R$49 | R$1.650 | R$50 | ~R$1.750 |

Custo DINOv2 por inferência: ~R$0,001 (0.5s de GPU L4 a $0.000233/s).

---

## 6. CLOUD RUN EXISTENTE: NOVOS ENDPOINTS

### 6a. MANTER `/extract-frame` (não mexer)

### 6b. NOVO: `/extract-and-crop`

Resolve o problema de memória. Recebe video_url + bboxes, extrai 40 frames internamente, recorta cada embrião, retorna só os crops pequenos. Os 40 frames completos nascem e morrem aqui.

```python
@app.post("/extract-and-crop")
async def extract_and_crop(request: dict):
    """
    Recebe: { video_url, bboxes: [...], frame_count: 40 }
    Retorna: { embryos: { "0": [crop_b64, ...], "1": [...] }, plate_frame_b64, frames_extracted }
    Os 40 frames completos NUNCA saem deste serviço.
    """
    video_url = request['video_url']
    bboxes = request['bboxes']
    frame_count = request.get('frame_count', 40)
    
    video_path = download_video(video_url)
    cap = cv2.VideoCapture(video_path)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    step = max(1, total_frames // frame_count)
    
    embryo_crops = {str(i): [] for i in range(len(bboxes))}
    plate_frame_b64 = None
    frame_idx = 0
    extracted = 0
    
    while cap.isOpened() and extracted < frame_count:
        ret, frame = cap.read()
        if not ret:
            break
        if frame_idx % step == 0:
            h, w = frame.shape[:2]
            
            # Salva frame 0 completo como plate_frame
            if plate_frame_b64 is None:
                _, plate_jpg = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
                plate_frame_b64 = base64.b64encode(plate_jpg.tobytes()).decode()
            
            # Recorta cada embrião neste frame
            for emb_idx, bbox in enumerate(bboxes):
                x1 = int((bbox['x_percent'] / 100 - bbox['width_percent'] / 200) * w)
                y1 = int((bbox['y_percent'] / 100 - bbox['height_percent'] / 200) * h)
                x2 = int((bbox['x_percent'] / 100 + bbox['width_percent'] / 200) * w)
                y2 = int((bbox['y_percent'] / 100 + bbox['height_percent'] / 200) * h)
                x1, y1 = max(0, x1), max(0, y1)
                x2, y2 = min(w, x2), min(h, y2)
                
                crop = frame[y1:y2, x1:x2]
                if crop.size > 0:
                    _, crop_jpg = cv2.imencode('.jpg', crop, [cv2.IMWRITE_JPEG_QUALITY, 80])
                    embryo_crops[str(emb_idx)].append(
                        base64.b64encode(crop_jpg.tobytes()).decode()
                    )
            extracted += 1
        frame_idx += 1
    
    cap.release()
    os.remove(video_path)
    
    return {
        "embryos": embryo_crops,
        "plate_frame_b64": plate_frame_b64,
        "frames_extracted": extracted
    }
```

### 6c. DEPRECAR `/analyze-activity`

```python
@app.post("/analyze-activity")
async def analyze_activity_deprecated():
    return {"error": "Deprecated. Use embryoscore-dinov2 /analyze-embryo", "status": "deprecated"}
```

---

## 7. EDGE FUNCTION: REESCREVER

### Arquivo: `supabase/functions/embryo-analyze/index.ts`

Estrutura geral se mantém. Conteúdo dos passos muda.

```typescript
// ============================================================
// EDGE FUNCTION — EMBRYO ANALYZE v2
// ============================================================

// PASSO 1: Buscar job, status → processing (IGUAL AO ATUAL)
const job = await supabase.from('embryo_analysis_queue')
  .select('*').eq('id', queue_id).single();
await supabase.from('embryo_analysis_queue')
  .update({ status: 'processing' }).eq('id', queue_id);


// PASSO 2: Extrair 1 frame para detecção (IGUAL AO ATUAL)
const frameResponse = await fetch(`${CLOUD_RUN_URL}/extract-frame`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ video_url: mediaUrl, position: 0.5 })
});
const { frame: detectionFrame } = await frameResponse.json();


// PASSO 3: Detectar embriões com Gemini box_2d (IGUAL AO ATUAL)
const bboxes = await detectEmbryosGemini(detectionFrame);


// PASSO 4: Extrair e recortar no Cloud Run (NOVO)
// Os 40 frames NUNCA chegam aqui.
const cropResponse = await fetch(`${CLOUD_RUN_URL}/extract-and-crop`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ video_url: mediaUrl, bboxes, frame_count: 40 })
});
const cropData = await cropResponse.json();
// cropData.embryos = { "0": [40 crops], "1": [40 crops], ... }
// cropData.plate_frame_b64 = frame completo da placa


// PASSO 4b: Salvar frame da placa e bboxes (NOVO)
await supabase.storage.from('embryoscore').upload(
  `${lote_fiv_id}/${acasalamento_id}/${queue_id}/plate_frame.jpg`,
  base64ToBuffer(cropData.plate_frame_b64),
  { contentType: 'image/jpeg' }
);
await supabase.from('embryo_analysis_queue').update({
  plate_frame_path: `${lote_fiv_id}/${acasalamento_id}/${queue_id}/plate_frame.jpg`,
  detected_bboxes: bboxes
}).eq('id', queue_id);


// PASSO 5: Analisar com DINOv2 (NOVO — em PARALELO)
const DINOV2_URL = Deno.env.get('DINOV2_CLOUD_RUN_URL');

const analyzePromises = Object.entries(cropData.embryos).map(
  async ([embIdx, crops]) => {
    const formData = new FormData();
    formData.append('frames_json', JSON.stringify(crops));
    const response = await fetch(`${DINOV2_URL}/analyze-embryo`, {
      method: 'POST', body: formData
    });
    return { embIdx: parseInt(embIdx), result: await response.json() };
  }
);
const analyzeResults = await Promise.all(analyzePromises);


// PASSO 6: KNN no Supabase (NOVO — em PARALELO)
const MIN_SIMILARITY = 0.65;
const MIN_NEIGHBORS = 3;

const knnPromises = analyzeResults.map(async ({ embIdx, result }) => {
  const { data: neighbors } = await supabase.rpc('match_embryos', {
    query_embedding: result.embedding, match_count: 10
  });
  
  const goodNeighbors = (neighbors || []).filter(
    (n: any) => n.similarity >= MIN_SIMILARITY
  );
  
  let knnResult;
  if (goodNeighbors.length < MIN_NEIGHBORS) {
    knnResult = {
      classification: null, confidence: 0,
      votes: {}, status: 'insufficient_data'
    };
  } else {
    const votes: Record<string, number> = {};
    for (const n of goodNeighbors) {
      votes[n.classification] = (votes[n.classification] || 0) + 1;
    }
    const sorted = Object.entries(votes).sort((a, b) => b[1] - a[1]);
    
    const withDG = goodNeighbors.filter((n: any) => n.pregnancy_result !== null);
    const pregnancyRate = withDG.length >= 5
      ? Math.round(withDG.filter((n: any) => n.pregnancy_result).length / withDG.length * 100)
      : null;
    
    knnResult = {
      classification: sorted[0][0],
      confidence: Math.round((sorted[0][1] / goodNeighbors.length) * 100),
      votes: Object.fromEntries(sorted),
      status: 'ok',
      pregnancy_prediction: pregnancyRate,
      pregnancy_sample_size: withDG.length
    };
  }
  return { embIdx, knnResult };
});
const knnResults = await Promise.all(knnPromises);


// PASSO 7: Salvar imagens no Storage
for (const { embIdx, result } of analyzeResults) {
  const basePath = `${lote_fiv_id}/${acasalamento_id}/${queue_id}`;
  await Promise.all([
    supabase.storage.from('embryoscore').upload(
      `${basePath}/emb_${embIdx}_frame.jpg`,
      base64ToBuffer(result.best_frame_b64), { contentType: 'image/jpeg' }),
    supabase.storage.from('embryoscore').upload(
      `${basePath}/emb_${embIdx}_motion.jpg`,
      base64ToBuffer(result.motion_map_b64), { contentType: 'image/jpeg' }),
    supabase.storage.from('embryoscore').upload(
      `${basePath}/emb_${embIdx}_composite.jpg`,
      base64ToBuffer(result.composite_b64), { contentType: 'image/jpeg' }),
  ]);
}


// PASSO 8: Salvar scores
await supabase.from('embryo_scores')
  .update({ is_current: false }).in('embriao_id', embryoIds);

for (const { embIdx, result } of analyzeResults) {
  const knn = knnResults.find(k => k.embIdx === embIdx)!.knnResult;
  const basePath = `${lote_fiv_id}/${acasalamento_id}/${queue_id}`;
  
  await supabase.from('embryo_scores').insert({
    embriao_id: embryoIds[embIdx],
    queue_id, is_current: true, analysis_version: nextVersion,
    knn_classification: knn.classification,
    knn_confidence: knn.confidence,
    knn_votes: knn.votes,
    embedding: result.embedding,
    kinetic_intensity: result.kinetics.intensity,
    kinetic_harmony: result.kinetics.harmony,
    kinetic_symmetry: result.kinetics.symmetry,
    kinetic_stability: result.kinetics.stability,
    kinetic_bg_noise: result.kinetics.background_noise,
    crop_image_path: `${basePath}/emb_${embIdx}_frame.jpg`,
    motion_map_path: `${basePath}/emb_${embIdx}_motion.jpg`,
    composite_path: `${basePath}/emb_${embIdx}_composite.jpg`,
    bbox_x: bboxes[embIdx].x_percent,
    bbox_y: bboxes[embIdx].y_percent,
    bbox_w: bboxes[embIdx].width_percent,
    bbox_h: bboxes[embIdx].height_percent,
    classification: knn.classification,
    confidence: knn.confidence
  });
}


// PASSO 9: Status completed (IGUAL)
await supabase.from('embryo_analysis_queue')
  .update({ status: 'completed', completed_at: new Date().toISOString() })
  .eq('id', queue_id);
```

---

## 8. FRONTEND

**REGRA: Todos os componentes seguem PassaGene DS (seção 18).**

### 8a. EmbryoReviewPanel.tsx (CRIAR)

Painel principal da revisão pré-despacho. O biólogo usa DEPOIS do envase, ao conferir o relatório. Contém:
1. PlatePanorama no topo (navegação visual)
2. Card do embrião sendo revisado
3. Progresso "12/15 classificados"
4. DispatchSummary quando todos classificados

```
┌─────────────────────────────────────────────────┐
│ Revisão — Lote FIV #234              12/15 ✓    │
│                                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │           PLACA PANORÂMICA                  │ │
│ │   ①✓    ②✓    ③✓    ④▶    ⑤○              │ │
│ │   ⑥✓    ⑦✓    ⑧✓    ⑨✓    ⑩✓              │ │
│ │   ⑪✓    ⑫✓    ⑬○    ⑭○    ⑮○              │ │
│ └─────────────────────────────────────────────┘ │
│  ✓ = classificado   ▶ = revisando   ○ = pendente│
│ ═══════════════════════════════════════════════  │
│ Embrião #4                                       │
│ ┌─────────────────────────────────────────────┐ │
│ │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │ │
│ │  │ Melhor   │  │  Mapa    │  │ Minimapa │  │ │
│ │  │  frame   │  │ cinético │  │ da placa │  │ │
│ │  └──────────┘  └──────────┘  └──────────┘  │ │
│ │  🤖 BN (78%) — KNN + Classificador concordam ✓  │ │
│ │  ████████████ BN  50%                       │ │
│ │  ██████████░░ BE  20%                       │ │
│ │  ████████░░░░ BX  20%                       │ │
│ │  ████░░░░░░░░ BL  10%                       │ │
│ │  [BE] [BN✨] [BX] [BL] [BI] [Mo] [Dg]     │ │
│ │  [      Confirmar → próximo #5      ]       │ │
│ └─────────────────────────────────────────────┘ │
│ Quando todos ✓:                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ Resumo: 5 BE, 4 BN, 3 BX, 2 BL, 1 Dg     │ │
│ │ Concordância IA: 80% (12/15)               │ │
│ │ Atlas: 2.826 cross-species + 147 reais     │ │
│ │ [      Confirmar despacho      ]            │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### 8b. PlatePanorama.tsx (CRIAR)

Frame completo da placa com embriões numerados. Canvas interativo:
- Pendente (○): borda branca 50% opacidade
- Classificado (✓): preenchido primary-subtle, borda primary
- Selecionado (▶): preenchido primary, borda primary-dark, pulso animado
- Tocar num embrião → scrolla até ele

### 8c. EmbryoMinimap.tsx (CRIAR)

Canvas 120×90px no canto do card individual. Frame completo reduzido com marcador verde no embrião atual. Só visual, sem interação.

```tsx
function EmbryoMinimap({ plateFrameUrl, bboxes, currentIndex }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !plateFrameUrl) return;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      canvas.width = 120; canvas.height = 90;
      ctx.drawImage(img, 0, 0, 120, 90);
      bboxes.forEach((bbox, i) => {
        const x = (bbox.x_percent / 100) * 120;
        const y = (bbox.y_percent / 100) * 90;
        ctx.beginPath();
        if (i === currentIndex) {
          ctx.arc(x, y, 7, 0, Math.PI * 2);
          ctx.fillStyle = '#2ECC71';
          ctx.fill();
          ctx.strokeStyle = '#1E8449';
          ctx.lineWidth = 2;
        } else {
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255,255,255,0.4)';
          ctx.lineWidth = 1;
        }
        ctx.stroke();
      });
    };
    img.src = plateFrameUrl;
  }, [plateFrameUrl, bboxes, currentIndex]);
  return <canvas ref={canvasRef} className="rounded-lg border border-border" style={{ width: 120, height: 90 }} />;
}
```

### 8d. EmbryoScoreCard.tsx (REESCREVER)

| Antes (Gemini) | Depois (KNN + MLP dual) |
|---|---|
| `embryo_score` (0-100) | Remover |
| `morph_score`, `kinetic_score` | Remover |
| Sub-scores MCI/TE/ZP/Frag | Remover |
| `reasoning`, `quality_checklist` | Remover |
| `transfer_recommendation` | Remover |
| — | **NOVO:** Melhor frame + mapa cinético + minimapa |
| — | **NOVO:** Barras de votação KNN (ponderadas por espécie) |
| — | **NOVO:** Indicador de fonte: KNN / KNN+MLP concordam / KNN+MLP divergem / MLP only |
| — | **NOVO:** Indicador "Aprendendo..." com contagem de referências reais |
| — | **NOVO:** Botões classificação biólogo |

**Indicadores visuais por fonte de scoring:**

```
source = 'knn' (atlas maduro, 200+ refs reais):
  🤖 BN (78%) — 10 embriões similares
  Barras de votação normais

source = 'knn_mlp_agree' (concordância):
  🤖 BN (72%) — KNN + Classificador concordam ✓
  Barras de votação normais + badge verde "concordam"

source = 'knn_mlp_disagree' (divergência):
  🤖 BN (55%) vs 💡 BX (48%)
  Duas linhas de votação lado a lado, destaque visual na divergência

source = 'mlp_only' (atlas imaturo):
  💡 BN (62%) — Sugestão do classificador
  🔍 23 referências reais no atlas — classifique manualmente
  Barras de probabilidade do MLP (não é votação KNN)

source = 'insufficient' (tudo insuficiente):
  🔍 Aprendendo... Classifique manualmente (5 referências)
  Sem sugestão, sem barras
```

### 8e. BiologistClassButtons.tsx (CRIAR)

Botões de classe (BE/BN/BX/BL/BI/Mo/Dg). Ao confirmar:
1. Atualiza `embryo_scores` (biologist_classification, biologist_agreed)
2. Insere em `embryo_references` (embedding + classe + imagens + **species='bovine_real'**) → Atlas cresce
3. Chama onClassified() → avança pro próximo pendente
4. Botão "desfazer" em até 5 minutos

### 8f. LoteScoreDashboard.tsx (REESCREVER)

Distribuição por classe (barras) em vez de score médio. Concordância biólogo × IA. **NOVO:** Indicador de maturidade do atlas: "Atlas: 2.826 cross-species + 147 reais" com barra de progresso.

### 8g. DispatchSummary.tsx (CRIAR)

Resumo final: contagem por classe, concordância, botão "Confirmar despacho".

### 8h. Lógica de votação (frontend) — simples, sem peso artificial

```typescript
function computeVotes(neighbors: Neighbor[]) {
  const votes: Record<string, number> = {};

  for (const n of neighbors) {
    votes[n.classification] = (votes[n.classification] || 0) + 1;
  }

  const sorted = Object.entries(votes).sort((a, b) => b[1] - a[1]);
  const winner = sorted[0][0];
  const confidence = Math.round((sorted[0][1] / neighbors.length) * 100);

  // Contagem de vizinhos reais vs cross-species (informativo)
  const realBovine = neighbors.filter(n => n.species === 'bovine_real').length;

  // Predição de prenhez (só com dados reais bovinos que têm DG)
  const withDG = neighbors.filter(n =>
    n.pregnancy_result !== null && n.species === 'bovine_real'
  );
  const pregnancyRate = withDG.length >= 5
    ? Math.round(withDG.filter(n => n.pregnancy_result).length / withDG.length * 100)
    : null;

  return {
    classification: winner,
    confidence,
    votes: Object.fromEntries(sorted),
    total_neighbors: neighbors.length,
    real_bovine_neighbors: realBovine,
    source: realBovine >= 3 ? 'knn_real' : realBovine >= 1 ? 'knn_mixed' : 'knn_cross_species',
    pregnancyPrediction: pregnancyRate,
    pregnancySampleSize: withDG.length
  };
}
```

---

## 9. O QUE REMOVER

| O que | Ação |
|---|---|
| Prompt Gemini V4 (~330 linhas) na Edge Function | **Deletar** |
| Chamada Gemini avaliação morfológica | **Deletar** |
| Parse GeminiV4Result | **Deletar** |
| Cloud Run `/analyze-activity` | **Deprecar** |
| Sub-scores MCI/TE/ZP/Frag na UI | **Remover** |
| Reasoning/checklist/transfer_recommendation na UI | **Remover** |

**NÃO deletar tabelas ou colunas.** Só adicionar novas e parar de usar as antigas. Permite rollback.

---

## 10. ATLAS INICIAL (BOOTSTRAP CROSS-SPECIES)

### 10.1 O problema do banco vazio

No dia 1, o KNN não tem referências. Sem referências, sem sugestão. Com a abordagem anterior (35 embriões manuais), o sistema precisava de semanas pra atingir massa crítica.

### 10.2 Insight: Transfer Learning Cross-Species

A morfologia embrionária é conservada entre mamíferos. Humano e bovino compartilham as mesmas estruturas visuais avaliadas por embriologistas:

| Estrutura | Humano | Bovino | Avaliação visual |
|---|---|---|---|
| Blastocoel | Cavidade fluida | Cavidade fluida | Idêntica |
| ICM (Massa Celular Interna) | Aglomerado celular | Aglomerado celular | Idêntica |
| Trofoectoderma (TE) | Camada externa | Camada externa | Idêntica |
| Zona Pelúcida | Casca externa | Casca externa | Idêntica |
| Fragmentação | Debris celular | Debris celular | Idêntica |

**Base científica:** Review de 2024 (Frontiers in Veterinary Science) recomenda explicitamente: "as abordagens bem-sucedidas em estudos humanos devem ser investigadas para embriões bovinos com modificações apropriadas". Paper de 2020 (Development) confirma: "semelhanças na arquitetura embrionária entre mamíferos eutérios sugerem mecanismos comuns guiando o desenvolvimento pré-implantação".

**Diferenças relevantes:**
- Citoplasma bovino é mais escuro (dificulta visualização)
- Microscópio diferente (estereomicroscópio bovino vs invertido humano → imagens parecem diferentes)
- Tamanho ligeiramente diferente (bovino ~150-190μm vs humano ~120-150μm)
- Velocidade de desenvolvimento (bovino D7 vs humano D5-6)

**Conclusão:** O DINOv2 captura ESTRUTURA VISUAL, não espécie. Os embeddings de um blastocisto humano e bovino de qualidade similar terão proximidade no espaço vetorial — não idênticos, mas próximos o suficiente pra bootstrap.

### 10.3 Datasets públicos disponíveis

| Dataset | Espécie | Volume | Anotações | Fonte |
|---|---|---|---|---|
| Kromp et al. 2023 | Humano | 2.344 blastocistos | Gardner (EXP + ICM + TE) + parâmetros clínicos | Figshare público |
| Rocha et al. 2017 | Bovino | 482 blastocistos | IETS 1/2/3 por 3 embriologistas | Figshare público |
| Kaggle Embryo Classification | Humano | ~1.000 | Blastocisto/não-blastocisto | Kaggle |

**Links:**
- Kromp: `https://doi.org/10.6084/m9.figshare.20123153.v3`
- Rocha: `https://doi.org/10.6084/m9.figshare.c.3825241`

### 10.4 Mapeamento de classificações Gardner → IETS → PassaGene

```
Gardner (humano)                      IETS (bovino)        PassaGene
─────────────────────────────────────────────────────────────────────
EXP 3-6 + ICM A + TE a              Stage 4-7, Grade 1   → BE
EXP 3-6 + ICM A + TE b              Stage 4-7, Grade 1-2 → BN
EXP 3-6 + ICM B + TE a              Stage 4-7, Grade 1-2 → BN
EXP 3-6 + ICM B + TE b              Stage 4-7, Grade 2   → BX
EXP 3-6 + ICM B + TE c              Stage 4-7, Grade 2-3 → BL
EXP 3-6 + ICM C + TE b              Stage 4-7, Grade 3   → BL
EXP 3-6 + ICM C + TE c              Stage 4-7, Grade 3-4 → BI
EXP 1-2 (sem expansão)              Stage 1-3            → Mo
Degenerado/fragmentado               Degenerado           → Dg
```

Mapeamento é APROXIMADO e conservador. Embriões humanos mapeados com flag `species: 'human'` e peso reduzido no KNN.

### 10.5 Estratégia de bootstrap em 3 camadas

```
CAMADA 1 — Atlas Cross-Species (dia 0, antes do lab usar)
├── 2.344 imagens humanas (Kromp) → embedding DINOv2 → atlas com flag species='human'
├── 482 imagens bovinas (Rocha) → embedding DINOv2 → atlas com flag species='bovine_rocha'
├── Classificações mapeadas Gardner→PassaGene e IETS→PassaGene
├── Sem peso artificial: DINOv2 já prioriza embriões de setup similar por similaridade natural
└── Total: ~2.826 referências no atlas ANTES do primeiro uso

CAMADA 2 — Classificador MLP treinado (deploy junto com DINOv2)
├── MLP simples: 768d → 256 → 7 classes (BE/BN/BX/BL/BI/Mo/Dg)
├── Treinado com embeddings das 2.826 referências cross-species
├── Funciona como segunda opinião PARALELA ao KNN
├── Peso dinâmico: alto no início, diminui conforme atlas cresce
└── Custo: zero (roda no mesmo container DINOv2)

CAMADA 3 — Fallback IA Generativa (quando KNN + MLP insuficientes)
├── Modelo de visão forte (GPT-4o ou Claude) com prompt contextualizado
├── Prompt inclui: critérios detalhados + 2-3 fotos exemplo por classe
├── Ativado SOMENTE quando KNN retorna insufficient_data E MLP tem baixa confiança
├── Sugestão aparece como "💡 Sugestão provisória" (nunca como classificação definitiva)
├── Custo: ~R$0.05-0.10/embrião (temporário, primeiras semanas)
└── Desativado automaticamente quando atlas atinge 200+ referências bovinas reais
```

### 10.6 Campos species/source na tabela embryo_references

Já definidos na seção 4b. Os campos `species` e `source` são para analytics e rastreabilidade, NÃO para ponderação no KNN. A similaridade de cosseno do DINOv2 já prioriza embriões de setup similar naturalmente.

### 10.7 Lógica de votação (Edge Function)

```typescript
// Votação simples — sem peso artificial, similaridade natural basta
function computeVote(neighbors: NeighborRow[]) {
  const votes: Record<string, number> = {};

  for (const n of neighbors) {
    votes[n.classification] = (votes[n.classification] || 0) + 1;
  }

  const sorted = Object.entries(votes).sort((a, b) => b[1] - a[1]);
  const winner = sorted[0];

  // Contar quantos vizinhos são bovine_real (dados reais do lab)
  const realBovineCount = neighbors.filter(n => n.species === 'bovine_real').length;

  return {
    classification: winner[0],
    confidence: Math.round((winner[1] / neighbors.length) * 100),
    total_neighbors: neighbors.length,
    real_bovine_neighbors: realBovineCount,
    votes: Object.fromEntries(sorted),
    // Fonte da sugestão: informativo pro frontend
    source: realBovineCount >= 3 ? 'knn_real' : realBovineCount >= 1 ? 'knn_mixed' : 'knn_cross_species'
  };
}
```

### 10.8 Scoring dual: KNN + classificador MLP

```python
# No container DINOv2 Cloud Run - endpoint /analyze-embryo ATUALIZADO
# O classificador MLP é carregado junto com o DINOv2

import torch
import torch.nn as nn

class EmbryoClassifier(nn.Module):
    """MLP simples treinado com dados cross-species."""
    def __init__(self, input_dim=768, hidden_dim=256, num_classes=7):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(hidden_dim, num_classes)
        )
        self.classes = ['BE', 'BN', 'BX', 'BL', 'BI', 'Mo', 'Dg']

    def forward(self, x):
        return self.net(x)

    def predict(self, embedding_tensor):
        with torch.no_grad():
            logits = self.forward(embedding_tensor)
            probs = torch.softmax(logits, dim=-1)
            top_prob, top_idx = probs.max(dim=-1)
            return {
                'classification': self.classes[top_idx.item()],
                'confidence': round(top_prob.item() * 100),
                'probabilities': {
                    cls: round(p.item() * 100)
                    for cls, p in zip(self.classes, probs[0])
                }
            }

# Carregamento no startup do container
classifier = EmbryoClassifier()
classifier.load_state_dict(torch.load('embryo_classifier.pth', map_location='cpu'))
classifier.eval()

# Endpoint /analyze-embryo retorna AMBOS
@app.post("/analyze-embryo")
async def analyze_embryo(file: UploadFile):
    # ... (processamento existente: align, sharpen, motion, composite)
    embedding = compute_embedding(composite)

    # Classificador MLP (paralelo, custo zero)
    mlp_result = classifier.predict(torch.tensor(embedding).unsqueeze(0))

    return {
        "embedding": embedding.tolist(),
        "composite_image": composite_b64,
        "best_frame": best_frame_b64,
        "motion_map": motion_b64,
        "mlp_classification": mlp_result  # NOVO
    }
```

### 10.9 Lógica combinada na Edge Function

```typescript
// Edge Function: combinar KNN + MLP + fallback IA generativa
async function getCombinedScore(
  knnResult: KNNResult,
  mlpResult: MLPResult,
  atlasStats: { total: number; real_bovine: number }
) {
  // Peso dinâmico baseado na maturidade do atlas
  const realRefs = atlasStats.real_bovine;
  const knnWeight = Math.min(realRefs / 200, 1.0); // 0→1 conforme atlas cresce até 200
  const mlpWeight = 1.0 - knnWeight;

  // Caso 1: Atlas maduro (200+ referências bovinas reais) → KNN domina
  if (realRefs >= 200 && knnResult.status !== 'insufficient_data') {
    return {
      classification: knnResult.classification,
      confidence: knnResult.confidence,
      source: 'knn',
      knn_detail: knnResult,
      mlp_detail: mlpResult,
      show_mlp: false  // MLP vira apenas verificação interna
    };
  }

  // Caso 2: Atlas em crescimento → combina KNN + MLP
  if (knnResult.status !== 'insufficient_data') {
    // Se concordam, confiança alta
    if (knnResult.classification === mlpResult.classification) {
      return {
        classification: knnResult.classification,
        confidence: Math.round(knnResult.confidence * 0.6 + mlpResult.confidence * 0.4),
        source: 'knn_mlp_agree',
        knn_detail: knnResult,
        mlp_detail: mlpResult,
        show_mlp: true
      };
    }
    // Se discordam, mostra ambos pro biólogo decidir
    return {
      classification: knnResult.classification, // KNN tem prioridade visual
      confidence: Math.round(knnResult.confidence * knnWeight + mlpResult.confidence * mlpWeight),
      source: 'knn_mlp_disagree',
      knn_detail: knnResult,
      mlp_detail: mlpResult,
      show_mlp: true,
      disagreement: true
    };
  }

  // Caso 3: KNN insuficiente → MLP sozinho
  if (mlpResult.confidence >= 50) {
    return {
      classification: mlpResult.classification,
      confidence: mlpResult.confidence,
      source: 'mlp_only',
      knn_detail: null,
      mlp_detail: mlpResult,
      show_mlp: true,
      learning: true
    };
  }

  // Caso 4: Tudo insuficiente → sem sugestão, biólogo classifica do zero
  return {
    classification: null,
    confidence: 0,
    source: 'insufficient',
    knn_detail: null,
    mlp_detail: mlpResult,
    show_mlp: false,
    learning: true
  };
}
```

### 10.10 UI do indicador cross-species

```
Quando source = 'knn' (atlas maduro):
  🤖 BN (78%)  — Baseado em 10 embriões similares
  ████████████ BN 50%   ██████ BE 20%   ████ BX 20%   ██ BL 10%

Quando source = 'knn_mlp_agree':
  🤖 BN (72%)  — KNN + Classificador concordam
  ████████████ BN 50%   ██████ BE 20%   ████ BX 20%   ██ BL 10%

Quando source = 'knn_mlp_disagree':
  🤖 BN (55%) vs 💡 BX (48%)  — Divergência KNN × Classificador
  [indicador visual mostra ambas sugestões]

Quando source = 'mlp_only':
  💡 BN (62%) — Sugestão do classificador (aprendendo...)
  🔍 23 referências no atlas — classifique manualmente

Quando source = 'insufficient':
  🔍 Aprendendo... Classifique manualmente (5 referências)
```

### 10.11 Script de bootstrap cross-species

```python
#!/usr/bin/env python3
"""
bootstrap_atlas.py — Popular atlas com datasets públicos cross-species.
Executar UMA VEZ antes do primeiro uso do sistema.
"""

import os, json, requests
import torch
from pathlib import Path

DINOV2_URL = os.environ['DINOV2_CLOUD_RUN_URL']
SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_SERVICE_KEY']

# Mapeamento Gardner → PassaGene
GARDNER_TO_PASSAGENE = {
    # (ICM, TE) → classe PassaGene
    ('A', 'a'): 'BE', ('A', 'b'): 'BN', ('A', 'c'): 'BX',
    ('B', 'a'): 'BN', ('B', 'b'): 'BX', ('B', 'c'): 'BL',
    ('C', 'a'): 'BX', ('C', 'b'): 'BL', ('C', 'c'): 'BI',
}

# Mapeamento IETS → PassaGene
IETS_TO_PASSAGENE = {
    1: 'BE',  # Excelente/Bom
    2: 'BN',  # Regular (conservador — poderia ser BX)
    3: 'BI',  # Pobre
}

def process_kromp_dataset(images_dir: str):
    """Processa 2.344 blastocistos humanos do dataset Kromp."""
    csv_path = Path(images_dir) / 'annotations_train.csv'
    # Parse CSV: image_id, EXP, ICM, TE
    # Para cada imagem:
    #   1. Enviar pro DINOv2 /analyze-embryo (gera embedding + composite)
    #   2. Mapear Gardner → PassaGene
    #   3. Inserir no Supabase com species='human'
    print(f"Processando Kromp dataset: {images_dir}")
    # ... implementação

def process_rocha_dataset(images_dir: str):
    """Processa 482 blastocistos bovinos do dataset Rocha."""
    # Parse XLS: image_id, grade (mode of 3 embryologists)
    # Para cada imagem:
    #   1. Enviar pro DINOv2 /analyze-embryo
    #   2. Mapear IETS → PassaGene
    #   3. Inserir no Supabase com species='bovine_rocha'
    print(f"Processando Rocha dataset: {images_dir}")
    # ... implementação

def train_mlp_classifier(supabase_url: str, supabase_key: str):
    """Treina MLP com todos os embeddings do atlas cross-species."""
    # 1. Buscar todos os embeddings + classificações do Supabase
    # 2. Split 80/20 stratified
    # 3. Treinar MLP (768 → 256 → 7) por ~50 epochs
    # 4. Salvar pesos em embryo_classifier.pth
    # 5. Upload pro container DINOv2
    print("Treinando classificador MLP cross-species...")
    # ... implementação

if __name__ == '__main__':
    process_kromp_dataset('./datasets/kromp')
    process_rocha_dataset('./datasets/rocha')
    train_mlp_classifier(SUPABASE_URL, SUPABASE_KEY)
    print("Atlas bootstrap completo: ~2.826 referências cross-species + classificador MLP")
```

### 10.12 Crescimento e transição automática

```
FASE 1 — Bootstrap Cross-Species (dia 0)
  Atlas: 2.826 refs (2.344 humanas + 482 bovinas Rocha)
  Scoring: MLP (peso alto) + KNN cross-species (peso baixo)
  Precisão estimada: ~55-65% (cross-species não é perfeito)
  ▼

FASE 2 — Primeiras semanas (dias 1-14)
  Atlas: 2.826 cross-species + 50-200 bovinas reais
  Scoring: MLP + KNN (dados reais começam a ter peso)
  Precisão estimada: ~65-75%
  ▼

FASE 3 — Atlas em maturação (mês 1-2)
  Atlas: 2.826 cross-species + 500-1.000 bovinas reais
  Scoring: KNN domina (dados reais têm similaridade maior)
  Referências humanas são gradualmente "empurradas" no ranking
  Precisão estimada: ~75-85%
  ▼

FASE 4 — Atlas maduro (mês 3+)
  Atlas: 2.826 cross-species + 1.500+ bovinas reais
  Scoring: KNN puro (referências reais dominam completamente)
  MLP vira verificação interna silenciosa
  Precisão estimada: ~85-90%
  ▼

FASE 5 — Multi-lab (mês 6+)
  Atlas: cross-species + 3.000+ bovinas reais de múltiplos labs
  KNN puro, cada lab contribui, efeito rede
  Precisão estimada: ~90%+
  Possível DEPRECAR referências humanas do KNN (manter só pra MLP)
```

**A transição é orgânica e automática.** Não precisa de intervenção manual. Os dados bovinos reais naturalmente têm similaridade maior com bovinos novos do que as referências humanas, então o KNN automaticamente prioriza dados reais conforme eles acumulam.

### 10.13 O que NÃO fazer

- **NÃO** deixar IA generativa classificar direto sem revisão humana → polui atlas
- **NÃO** misturar embeddings de setups muito diferentes sem flag → species obrigatório
- **NÃO** assumir que cross-species substitui dados reais → é PONTE temporária
- **NÃO** deletar referências cross-species quando atlas matura → mantém como fallback
- **NÃO** adicionar pesos artificiais por espécie → similaridade natural do DINOv2 já resolve

---

## 11. ESCALA COMERCIAL

### 11.1 Como funciona para novos labs

```
Lab novo assina PassaGene → IA funciona dia 1 (banco central)
→ Biólogo despacha normalmente → Cada classificação vira referência
→ Modelo melhora pra TODOS os labs
```

**Nenhuma calibração. Nenhum treinamento. Funciona do primeiro dia.**

### 11.2 Efeito rede

Mais labs → mais referências → KNN mais preciso → mais labs querem usar. Banco central anonimizado (sem dados do lab na busca KNN).

### 11.3 Moat competitivo

1. **Dados proprietários:** Cada embrião anotado por biólogo é dado exclusivo
2. **Efeito rede:** Mais labs = mais dados = modelo melhor
3. **Integração:** Score vive dentro do PassaGene, não é produto isolado
4. **Custo zero de IA:** DINOv2 open source, pgvector incluso
5. **Patente:** Sistema integrado (marketplace + IA + gestão reprodutiva)
6. **Transfer learning cross-species:** Atlas nasce com ~2.800 referências (dados humanos públicos). Nenhum concorrente bovino no Brasil está usando dados humanos para bootstrap. Barreira de conhecimento técnico alto.
7. **Scoring dual (KNN + MLP):** Classificador treinado em dados cross-species funciona desde o dia 1. Concorrentes que usam só IA generativa (Gemini, GPT) alucinam.

---

## 12. EVOLUÇÃO FUTURA — PREDIÇÃO DE PRENHEZ

Quando o banco tiver resultados de DG (diagnóstico de gestação):

```
Embrião novo → embedding → KNN encontra 10 similares
  → Dos 10: 7 têm DG, 5 prenharam (71%)
  → "Embriões similares tiveram 71% de taxa de prenhez (7 casos DG)"
```

| Volume com DG | Confiabilidade |
|---|---|
| < 100 | Não mostrar |
| 100-500 | Indicativo com caveat |
| 500-1.000 | Com confiança |
| 1.000+ | Confiável |

**Patenteável e vendável.** Nenhum outro sistema de FIV bovina no Brasil faz isso.

---

## 13. CONFIGURAÇÃO DE GRAVAÇÃO

### Equipamento do lab de referência

- Microscópio: Nikon SMZ 645 (zoom 0.8-5x)
- Adaptador: OptiREC (físico)
- Celular: Samsung Galaxy S23
- Lente: Telefoto 10MP (3x óptico fixo)

### Configurações Samsung Video Pro

| Parâmetro | Valor | Motivo |
|---|---|---|
| Lente | T (Telefoto 3x) | Zoom óptico sem degradação |
| Resolução | FHD 60fps | Captura micro-movimentos |
| ISO | 100 | Mínimo ruído |
| Shutter | 1/125s | Congela frames sem blur |
| Foco | MF (manual) | Evita ajustes entre frames |
| WB | 2800-4000K manual | Fundo neutro |
| Exposição | Manual travada | Sem mudanças de brilho |
| Estabilização | OFF | Evita crop variável |
| HDR | OFF | Processa frames diferente |
| Codec | H.264 | Menos artefatos |
| Alta taxa de bits | ON | Dados mais limpos |

### Requisitos mínimos para labs clientes

- Vídeo ≥ 2 segundos (30+ frames)
- Embrião focado e visível
- Iluminação estável
- Sem zoom digital (só óptico)

O DINOv2 é robusto a variações. O sistema de subtração de ruído compensa tremidos e artefatos.

---

## 14. VARIÁVEIS DE AMBIENTE

Adicionar: `DINOV2_CLOUD_RUN_URL`  
Manter: `CLOUD_RUN_URL`, `GEMINI_API_KEY` (para box_2d)

---

## 15. SPRINTS

| Sprint | Tempo | O que |
|---|---|---|
| 1. Banco | 1 dia | pgvector, tabela (com species/source), função match_embryos, alters, bucket |
| 2. DINOv2 Cloud Run | 1-2 dias | app.py (com endpoint MLP), Dockerfile, deploy com GPU L4 |
| 3. Cloud Run existente | 1 dia | /extract-and-crop, deprecar /analyze-activity |
| 4. Edge Function | 2-3 dias | Reescrever passos, paralelo, KNN, scoring dual, deletar Gemini |
| 5. Frontend | 3-4 dias | ReviewPanel, PlatePanorama, Minimap, ClassButtons, Dashboard, indicadores cross-species |
| 6. Bootstrap cross-species | 1-2 dias | Baixar Kromp (2.344) + Rocha (482), gerar embeddings, mapear classificações, popular atlas |
| 7. Classificador MLP | 1 dia | Treinar MLP com embeddings cross-species, deploy no container DINOv2 |
| 8. Refinamentos | ongoing | Desfazer, dashboard admin, DG, retenção vídeos, deprecar refs humanas quando atlas maduro |

---

## 16. CHECKLIST

```
[ ] Cloud Run DINOv2 /health ok
[ ] Cloud Run DINOv2 /analyze-embryo retorna embedding 768d + mlp_classification
[ ] Cloud Run /extract-and-crop retorna crops + plate_frame
[ ] 40 frames NUNCA chegam na Edge Function
[ ] KNN retorna vizinhos por similaridade (ou vazio quando banco vazio)
[ ] KNN com insufficient_data quando < 3 vizinhos bons
[ ] Edge Function: pipeline completo funciona
[ ] Edge Function: DINOv2 chamado em paralelo
[ ] Edge Function: scoring dual (KNN + MLP) com peso dinâmico
[ ] plate_frame.jpg salvo no Storage por despacho
[ ] PlatePanorama mostra embriões navegáveis
[ ] EmbryoMinimap mostra posição no card
[ ] Card mostra frame + mapa + sugestão KNN/MLP combinada
[ ] Indicador fonte: "knn" / "knn_mlp_agree" / "knn_mlp_disagree" / "mlp_only" / "insufficient"
[ ] "Aprendendo..." quando insufficient_data ou mlp_only
[ ] Classificação salva em embryo_scores + embryo_references (species='bovine_real')
[ ] "Confirmar → próximo" avança pro pendente
[ ] DispatchSummary aparece quando todos classificados
[ ] Progresso "12/15" atualiza em tempo real
[ ] Atlas bootstrap: Kromp (2.344 humanas) processadas e inseridas com species='human'
[ ] Atlas bootstrap: Rocha (482 bovinas) processadas e inseridas com species='bovine_rocha'
[ ] Classificador MLP treinado com embeddings cross-species e deploy no container
[ ] MLP retorna classificação + confidence + probabilities por classe
[ ] Peso dinâmico KNN↔MLP ajusta automaticamente conforme atlas real cresce
[ ] Referências humanas identificadas com species='human' (analytics)
[ ] Gemini avaliação NÃO é mais chamado
[ ] /extract-frame antigo ainda funciona
```

---

## 17. MUDANÇAS POR ARQUIVO

| Arquivo | Ação |
|---|---|
| **BANCO** | |
| Migration SQL | Criar extensão, tabela (com species/source), função match_embryos, alters |
| **CLOUD RUN NOVO** | |
| `embryoscore-dinov2/app.py` | **Criar** (inclui endpoint MLP + modelo classificador) |
| `embryoscore-dinov2/Dockerfile` | **Criar** |
| `embryoscore-dinov2/embryo_classifier.pth` | **Criar** (pesos MLP treinado cross-species) |
| **CLOUD RUN EXISTENTE** | |
| `/extract-and-crop` | **Adicionar** |
| `/extract-frame` | Não mexer |
| `/analyze-activity` | Deprecar |
| **EDGE FUNCTION** | |
| `supabase/functions/embryo-analyze/index.ts` | **Reescrever** (scoring dual KNN + MLP) |
| **FRONTEND — CRIAR** | |
| `src/components/embryoscore/EmbryoReviewPanel.tsx` | **Criar** |
| `src/components/embryoscore/PlatePanorama.tsx` | **Criar** |
| `src/components/embryoscore/EmbryoMinimap.tsx` | **Criar** |
| `src/components/embryoscore/BiologistClassButtons.tsx` | **Criar** |
| `src/components/embryoscore/DispatchSummary.tsx` | **Criar** |
| **FRONTEND — REESCREVER** | |
| `src/components/embryoscore/EmbryoScoreCard.tsx` | **Reescrever** (indicadores cross-species/dual scoring) |
| `src/components/embryoscore/LoteScoreDashboard.tsx` | **Reescrever** |
| **SCRIPTS — CRIAR** | |
| `scripts/bootstrap_atlas.py` | **Criar** (download + processamento Kromp/Rocha + popular atlas) |
| `scripts/train_classifier.py` | **Criar** (treinar MLP com embeddings cross-species) |
| **NÃO MEXER** | |
| `EmbryoCamera.jsx` | ✅ |
| `useEmbryoVideoUpload.ts` | ✅ |
| `LotesFIV.tsx` | ✅ |
| `LoteDetailView.tsx` | ✅ |
| `VideoUploadButton.tsx` | ✅ |

---

## 18. DESIGN SYSTEM — PassaGene DS (OBRIGATÓRIO)

### Fontes

```
font-heading: Outfit          — títulos, H1-H3, nomes de seção
font-sans:    Manrope          — texto, labels, descrições
font-mono:    JetBrains Mono   — códigos de classe, valores, métricas
```

### Cores

```
Primárias (verde da marca):
  primary:        #2ECC71  — botões, badges ativos, barras votação
  primary-dark:   #1E8449  — hover, bordas ativas
  primary-light:  #82E0AA  — destaques suaves
  primary-subtle: #D5F5E3  — fundo de selecionados, badges

Logo direta:
  passagene.primary: #09C972, primary-dark: #049357, primary-light: #5EDFA3

Semânticas:
  destructive:    #EF4444  — erros, alertas, "Degenerado"
  accent:         #27AE60  — alternativa ao primary

Neutros: background, card, foreground, muted, muted-foreground, border, secondary (CSS vars)
```

### Border Radius

```
rounded-sm: 4px   rounded: 8px (default)   rounded-lg: 12px
rounded-2xl: 20px   rounded-full: pill
```

### Sombras (tom verde sutil)

```
shadow-sm:  0 1px 3px rgba(9,201,114,0.08)
shadow:     0 4px 12px rgba(9,201,114,0.12)
shadow-lg:  0 8px 24px rgba(4,147,87,0.15)
```

### Componentes shadcn/ui

Card, Button (default/outline/ghost/destructive), Input, Label, Table, Badge

### Ícones: lucide-react

Check, X, Eye, Camera, Upload, ChevronRight, Undo2

### Padrões de aplicação EmbryoScore

```tsx
// Card principal
<Card className="rounded-2xl border-border shadow-sm">

// Código classe
<span className="font-mono text-2xl font-bold text-primary">BN</span>

// Métrica
<div className="bg-muted rounded-lg p-3 text-center">
  <span className="font-mono text-lg font-semibold">{value}%</span>
  <span className="text-xs text-muted-foreground block mt-1">Intensidade</span>
</div>

// Botão classe normal
<Button variant="outline" className="rounded-lg p-3 h-auto flex-col">

// Botão classe selecionado
<Button variant="outline" className="rounded-lg p-3 h-auto flex-col border-primary bg-primary-subtle">

// Botão classe sugestão IA
<Button variant="outline" className="rounded-lg p-3 h-auto flex-col ring-1 ring-primary/20">

// Barra votação
<div className="h-5 bg-muted rounded-sm overflow-hidden">
  <div className="h-full bg-primary rounded-sm" style={{ width: `${pct}%` }} />
</div>

// Badge status
<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-subtle text-primary-dark">

// Aprendendo
<div className="text-center py-4 text-muted-foreground text-sm">
  🔍 Aprendendo... Classifique manualmente ({refCount} referências)
</div>

// Dark mode: automático via CSS variables
```

---

## 19. DECISÕES TÉCNICAS — RESUMO

| Decisão | Escolha | Descartado | Motivo |
|---|---|---|---|
| Avaliação | DINOv2 + KNN + MLP | Gemini/Claude direto | IA generativa alucina |
| Modelo visual | DINOv2 ViT-B/14 | CLIP, ResNet | Melhor similaridade visual |
| Cinética | Diff pixels + subtração ruído | Métricas separadas | Preserva info espacial |
| Combinação | Imagem composta | Vetor concatenado | Um processamento só |
| Processamento | Server-side Cloud Run | Browser JS | Não trava celular |
| GPU | Google Cloud Run L4 | Modal, Replicate | Mesmo ecossistema |
| Recorte | Serviço existente Gemini | OpenCV browser | Já funciona, não mexer |
| Busca vetorial | Supabase pgvector | Pinecone, Weaviate | Já usa Supabase |
| Treinamento DINOv2 | Nenhum (out-of-box) | Fine-tune | Funciona sem dados |
| Classificador | MLP treinado cross-species | Nenhum classificador | Funciona desde dia 1, custo zero |
| Bootstrap | Cross-species (humano+bovino) | 35 embriões manuais | 2.826 refs vs 35, IA funciona dia 1 |
| Peso cross-species | Nenhum (similaridade natural) | Peso artificial por espécie | DINOv2 já prioriza setup similar |
| Scoring | Dual (KNN + MLP) com peso dinâmico | KNN sozinho | MLP cobre quando KNN insuficiente |
| Melhoria | KNN banco crescente + MLP fixo | Retreino periódico | Sem retreino, transição orgânica |
| Frames | Nunca saem do Cloud Run | Edge Function manipula | Memória insuficiente |
| Fallback IA generativa | Opcional (prompt rico) | Obrigatório | Custo alto, só se MLP+KNN falham |

---

## 20. OTIMIZAÇÕES INCORPORADAS

| Otimização | Onde |
|---|---|
| 40 frames nunca saem do Cloud Run | Seção 6b, /extract-and-crop |
| Paralelização DINOv2 + KNN | Seção 7, Promise.all |
| Threshold mínimo KNN | Seção 7, MIN_SIMILARITY=0.65 |
| Indicador "Aprendendo..." | Seção 8d |
| Alinhamento de crops | Seção 5.5, align_crops() |
| Placa panorâmica navegável | Seção 8b |
| Minimapa no card | Seção 8c |
| Proteção contra erro | Seção 4b (review_mode) + Sprint 8 (desfazer) |
| Fluxo revisão pré-despacho | Seção 8a |
| Resumo de despacho | Seção 8g |
| Atlas cross-species bootstrap | Seção 10.5, 2.826 refs dia 0 |
| Similaridade natural prioriza dados reais | Seção 4c, sem peso artificial |
| Scoring dual KNN + MLP | Seção 10.8-10.9, peso dinâmico |
| Transição orgânica cross→real | Seção 10.13, sem intervenção manual |
| MLP classificador no mesmo container | Seção 10.9, custo zero adicional |

---

## 21. REFERÊNCIAS

### Tecnologia
- DINOv2: https://github.com/facebookresearch/dinov2
- pgvector: https://github.com/pgvector/pgvector
- Cloud Run GPU: https://cloud.google.com/run/docs/configuring/services/gpu
- Supabase Vector: https://supabase.com/docs/guides/ai/vector-columns

### Datasets públicos (Bootstrap Cross-Species)
- Kromp et al. 2023 — 2.344 blastocistos humanos com Gardner: https://doi.org/10.6084/m9.figshare.20123153.v3
- Rocha et al. 2017 — 482 blastocistos bovinos com IETS: https://doi.org/10.6084/m9.figshare.c.3825241
- Paper Kromp (Scientific Data): https://www.nature.com/articles/s41597-023-02182-3
- Paper Rocha (Scientific Reports): https://www.nature.com/articles/s41598-017-08104-9
- Paper Rocha (Scientific Data): https://www.nature.com/articles/sdata2017192

### Base científica cross-species
- Princípios comuns de auto-organização embrionária mamífera (Development 2020): https://journals.biologists.com/dev/article/147/14/dev183079
- Blastocistos bovinos derivados de stem cells vs IVF (Cell Stem Cell 2023): https://www.cell.com/cell-stem-cell/fulltext/S1934-5909(23)00121-2
- Review: imaging e spectroscopia para gradação de embriões bovinos (Frontiers Vet Sci 2024): https://www.frontiersin.org/journals/veterinary-science/articles/10.3389/fvets.2024.1364570
- STORK — DNN com 50K imagens humanas, AUC >0.98 (npj Digital Medicine 2019): https://www.nature.com/articles/s41746-019-0096-y
- Vitrolife — 780K imagens, grading automático ICM/TE: https://blog.vitrolife.com/togetheralltheway/new-publication-automatic-grading-of-human-blastocysts-from-time-lapse-imaging
- ML para avaliação bovina em campo com vídeo celular (J IVF-Worldwide 2025): https://jivfww.scholasticahq.com/article/141131
- Blasto3Q — classificação bovina via smartphone (Sensors 2018): https://mdpi.com/1424-8220/18/12/4440

### Citação-chave para abordagem cross-species
> "As first step, the successful approaches and tools in human study should be investigated
> for bovine embryos with appropriate modifications."
> — Frontiers in Veterinary Science, 2024 (Review: Application of imaging and spectroscopy
> techniques for grading of bovine embryos)

---

*Documento único de referência para Claude Code. Ordem: banco → DINOv2 (com MLP) → Cloud Run → Edge Function (scoring dual) → Frontend → Bootstrap cross-species → MLP training → Refinamentos. Todos os componentes seguem PassaGene DS.*
