-- Add gemini_classification column to embryo_scores
-- Stores the Gemini AI classification separately from biologist classification
ALTER TABLE embryo_scores
ADD COLUMN IF NOT EXISTS gemini_classification TEXT;

COMMENT ON COLUMN embryo_scores.gemini_classification IS 'Gemini AI classification (BE/BN/BX/BL/BI/Mo/Dg). Revealed after biologist classifies.';
