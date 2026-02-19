-- KNN v2: match_embryos_v2 + UNIQUE constraint for upsert
-- Run in Supabase Dashboard > SQL Editor
-- Idempotent: safe to re-run

-- UNIQUE constraint for upsert (allows pipeline + frontend to upsert by embriao_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_embryo_ref_embriao'
  ) THEN
    ALTER TABLE embryo_references ADD CONSTRAINT uq_embryo_ref_embriao UNIQUE (embriao_id);
  END IF;
END $$;

-- match_embryos_v2: visual HNSW search + kinetic re-ranking
CREATE OR REPLACE FUNCTION match_embryos_v2(
  query_embedding vector(768),
  query_kinetic_intensity REAL DEFAULT NULL,
  query_kinetic_harmony REAL DEFAULT NULL,
  query_kinetic_stability REAL DEFAULT NULL,
  match_count INT DEFAULT 10,
  visual_top_n INT DEFAULT 30,
  alpha FLOAT DEFAULT 0.7,
  beta FLOAT DEFAULT 0.3,
  filter_lab_id UUID DEFAULT NULL,
  min_similarity FLOAT DEFAULT 0.50
)
RETURNS TABLE (
  id UUID, classification TEXT,
  visual_similarity REAL, kinetic_similarity REAL, composite_score REAL,
  species TEXT,
  kinetic_intensity REAL, kinetic_harmony REAL, kinetic_stability REAL,
  pregnancy_result BOOLEAN,
  best_frame_path TEXT, motion_map_path TEXT
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  WITH visual_neighbors AS (
    SELECT er.id, er.classification,
      (1 - (er.embedding <=> query_embedding))::REAL as vis_sim,
      er.species, er.kinetic_intensity, er.kinetic_harmony, er.kinetic_stability,
      er.pregnancy_result, er.best_frame_path, er.motion_map_path
    FROM embryo_references er
    WHERE (filter_lab_id IS NULL OR er.lab_id = filter_lab_id)
      AND (1 - (er.embedding <=> query_embedding)) > min_similarity
    ORDER BY er.embedding <=> query_embedding ASC
    LIMIT visual_top_n
  ),
  scored AS (
    SELECT vn.*,
      CASE WHEN query_kinetic_intensity IS NULL OR vn.kinetic_intensity IS NULL
        THEN 0.0
        ELSE (1.0 - (
          ABS(COALESCE(vn.kinetic_intensity,0) - COALESCE(query_kinetic_intensity,0)) +
          ABS(COALESCE(vn.kinetic_harmony,0) - COALESCE(query_kinetic_harmony,0)) +
          ABS(COALESCE(vn.kinetic_stability,0) - COALESCE(query_kinetic_stability,0))
        ) / 3.0)
      END::REAL as kin_sim,
      (alpha * vn.vis_sim + beta *
        CASE WHEN query_kinetic_intensity IS NULL OR vn.kinetic_intensity IS NULL
          THEN vn.vis_sim
          ELSE (1.0 - (
            ABS(COALESCE(vn.kinetic_intensity,0) - COALESCE(query_kinetic_intensity,0)) +
            ABS(COALESCE(vn.kinetic_harmony,0) - COALESCE(query_kinetic_harmony,0)) +
            ABS(COALESCE(vn.kinetic_stability,0) - COALESCE(query_kinetic_stability,0))
          ) / 3.0)
        END
      )::REAL as comp_score
    FROM visual_neighbors vn
  )
  SELECT s.id, s.classification,
    s.vis_sim, s.kin_sim, s.comp_score,
    s.species, s.kinetic_intensity, s.kinetic_harmony, s.kinetic_stability,
    s.pregnancy_result, s.best_frame_path, s.motion_map_path
  FROM scored s
  ORDER BY s.comp_score DESC
  LIMIT match_count;
END;
$$;
