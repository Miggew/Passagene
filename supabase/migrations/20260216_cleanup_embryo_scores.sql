-- Migration: cleanup_embryo_scores_legacy_columns
-- Description: Drops legacy v1 columns that are no longer used in v2.1 pipeline.

ALTER TABLE embryo_scores
DROP COLUMN IF EXISTS morph_score,
DROP COLUMN IF EXISTS kinetic_score,
DROP COLUMN IF EXISTS stage,
DROP COLUMN IF EXISTS icm_grade,
DROP COLUMN IF EXISTS te_grade,
DROP COLUMN IF EXISTS morph_notes,
DROP COLUMN IF EXISTS kinetic_notes;

-- Optional: Comments to document the change
COMMENT ON TABLE embryo_scores IS 'Stores AI analysis results. Legacy v1 columns were removed on 2026-02-16.';
