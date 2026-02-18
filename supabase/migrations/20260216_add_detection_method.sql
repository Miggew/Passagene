-- Migration: Add detection_method to embryo_scores
-- Date: 2026-02-16
-- Description: Adds the missing column required by the new embryo-analyze function.

ALTER TABLE embryo_scores 
ADD COLUMN IF NOT EXISTS detection_method TEXT;

COMMENT ON COLUMN embryo_scores.detection_method IS 'Method used for detection (e.g., opencv, yolo_custom, gemini)';
