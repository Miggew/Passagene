-- Add manual_bboxes column to embryo_analysis_queue
-- Stores biologist-provided bounding boxes from touch-to-classify flow
-- Format: DetectedBbox + classification + touch_order (JSONB array)
-- When present, Cloud Run skips OpenCV detection and uses these positions directly

ALTER TABLE embryo_analysis_queue
ADD COLUMN IF NOT EXISTS manual_bboxes JSONB DEFAULT NULL;

COMMENT ON COLUMN embryo_analysis_queue.manual_bboxes IS
'Bboxes marcados pelo biólogo via toque na imagem. Formato DetectedBbox + classification + touch_order. Enviados ao Cloud Run no lugar do OpenCV.';
