-- Add IETS grading columns to embryo_scores
ALTER TABLE embryo_scores 
ADD COLUMN IF NOT EXISTS stage_code INTEGER,
ADD COLUMN IF NOT EXISTS quality_grade INTEGER,
ADD COLUMN IF NOT EXISTS visual_features JSONB,
ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC;

-- Add comments for clarity
COMMENT ON COLUMN embryo_scores.stage_code IS 'IETS Stage Code (1-9)';
COMMENT ON COLUMN embryo_scores.quality_grade IS 'IETS Quality Grade (1-4)';
COMMENT ON COLUMN embryo_scores.visual_features IS 'Detected anomalies and features (e.g. extruded cells)';
