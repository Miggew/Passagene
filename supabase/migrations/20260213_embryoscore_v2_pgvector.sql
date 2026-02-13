-- ============================================================
-- EmbryoScore v2 — pgvector + tabelas + RPC
-- Idempotente: todas as operações usam IF NOT EXISTS / OR REPLACE
-- ============================================================

-- 1a. Habilitar pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 1b. Tabela embryo_references (atlas de referências)
CREATE TABLE IF NOT EXISTS embryo_references (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Identificação
  lab_id UUID NOT NULL,
  lote_fiv_id UUID REFERENCES lotes_fiv(id),
  acasalamento_id UUID REFERENCES lote_fiv_acasalamentos(id),
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

  -- Imagens no Supabase Storage (bucket: embryoscore)
  best_frame_path TEXT,
  motion_map_path TEXT,
  composite_path TEXT,
  crop_image_path TEXT,

  -- Resultado de DG (preenchido depois, quando disponível)
  pregnancy_result BOOLEAN,
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

-- 1c. Índices
CREATE INDEX IF NOT EXISTS embryo_refs_embedding_idx
  ON embryo_references
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_embryo_refs_class ON embryo_references(classification);
CREATE INDEX IF NOT EXISTS idx_embryo_refs_lab ON embryo_references(lab_id);
CREATE INDEX IF NOT EXISTS idx_embryo_refs_pregnancy ON embryo_references(pregnancy_result);
CREATE INDEX IF NOT EXISTS idx_embryo_refs_species ON embryo_references(species);

-- 1d. Função RPC de busca KNN
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

-- 1e. ALTER embryo_scores — campos v2
-- Cada ADD COLUMN é idempotente via IF NOT EXISTS
ALTER TABLE embryo_scores ADD COLUMN IF NOT EXISTS knn_classification TEXT;
ALTER TABLE embryo_scores ADD COLUMN IF NOT EXISTS knn_confidence REAL;
ALTER TABLE embryo_scores ADD COLUMN IF NOT EXISTS knn_votes JSONB;
ALTER TABLE embryo_scores ADD COLUMN IF NOT EXISTS knn_neighbor_ids UUID[];
ALTER TABLE embryo_scores ADD COLUMN IF NOT EXISTS knn_real_bovine_count INT;
ALTER TABLE embryo_scores ADD COLUMN IF NOT EXISTS embedding vector(768);
ALTER TABLE embryo_scores ADD COLUMN IF NOT EXISTS kinetic_intensity REAL;
ALTER TABLE embryo_scores ADD COLUMN IF NOT EXISTS kinetic_harmony REAL;
ALTER TABLE embryo_scores ADD COLUMN IF NOT EXISTS kinetic_symmetry REAL;
ALTER TABLE embryo_scores ADD COLUMN IF NOT EXISTS kinetic_stability REAL;
ALTER TABLE embryo_scores ADD COLUMN IF NOT EXISTS kinetic_bg_noise REAL;
ALTER TABLE embryo_scores ADD COLUMN IF NOT EXISTS motion_map_path TEXT;
ALTER TABLE embryo_scores ADD COLUMN IF NOT EXISTS composite_path TEXT;
ALTER TABLE embryo_scores ADD COLUMN IF NOT EXISTS biologist_classification TEXT;
ALTER TABLE embryo_scores ADD COLUMN IF NOT EXISTS biologist_agreed BOOLEAN;
ALTER TABLE embryo_scores ADD COLUMN IF NOT EXISTS mlp_classification TEXT;
ALTER TABLE embryo_scores ADD COLUMN IF NOT EXISTS mlp_confidence REAL;
ALTER TABLE embryo_scores ADD COLUMN IF NOT EXISTS mlp_probabilities JSONB;
ALTER TABLE embryo_scores ADD COLUMN IF NOT EXISTS combined_source TEXT;
ALTER TABLE embryo_scores ADD COLUMN IF NOT EXISTS combined_classification TEXT;
ALTER TABLE embryo_scores ADD COLUMN IF NOT EXISTS combined_confidence REAL;

-- 1f. ALTER embryo_analysis_queue — plate_frame_path
-- (detected_bboxes already exists from previous migrations)
ALTER TABLE embryo_analysis_queue ADD COLUMN IF NOT EXISTS plate_frame_path TEXT;

-- 1g. Storage bucket (must be created via Supabase Dashboard or API, not SQL)
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('embryoscore', 'embryoscore', false)
-- ON CONFLICT (id) DO NOTHING;

-- RLS policy for embryoscore bucket (service_role bypasses RLS, so this is for client access)
-- Note: actual bucket creation should be done via Supabase Dashboard
-- These policies will be applied once the bucket exists

-- Allow authenticated users to read files from embryoscore bucket
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'embryoscore') THEN
    -- Read access for authenticated users
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'embryoscore_read_authenticated'
    ) THEN
      CREATE POLICY embryoscore_read_authenticated ON storage.objects
        FOR SELECT USING (bucket_id = 'embryoscore' AND auth.role() = 'authenticated');
    END IF;

    -- Insert/Update for service role only (Edge Functions use service_role)
    -- No additional policy needed as service_role bypasses RLS
  END IF;
END $$;
