-- Add Feedback Loop columns to embryo_scores
ALTER TABLE embryo_scores
ADD COLUMN IF NOT EXISTS manual_grade_override text, -- User's corrected grade (e.g., "Mórula (Grau 1)")
ADD COLUMN IF NOT EXISTS gemini_reasoning text, -- "Why" the AI chose the grade
ADD COLUMN IF NOT EXISTS is_ground_truth boolean DEFAULT false; -- True if reviewed/corrected by biologist

-- Update RLS (if strict) or comments
COMMENT ON COLUMN embryo_scores.manual_grade_override IS 'Correction provided by biologist. Overrides AI classification.';
COMMENT ON COLUMN embryo_scores.gemini_reasoning IS 'Explanation text from Gemini VLM.';
COMMENT ON COLUMN embryo_scores.is_ground_truth IS 'Flag indicating this score is verified human data for future training.';
