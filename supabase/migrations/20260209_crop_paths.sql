-- Adiciona coluna crop_paths para armazenar os caminhos dos crops JPEG no Storage
-- Cada crop é uma imagem recortada ao redor de um embrião detectado pelo OpenCV
-- Usado como "bússola visual" para o Gemini identificar qual embrião analisar

ALTER TABLE public.embryo_analysis_queue
  ADD COLUMN IF NOT EXISTS crop_paths jsonb;

COMMENT ON COLUMN public.embryo_analysis_queue.crop_paths IS 'Array de paths no Storage (embryo-videos bucket) para crops JPEG de cada embrião detectado. Índice alinhado com detected_bboxes.';

-- Atualizar bucket embryo-videos para aceitar image/jpeg além de vídeos
-- (necessário para upload de crops JPEG)
UPDATE storage.buckets
SET allowed_mime_types = array_cat(
  COALESCE(allowed_mime_types, ARRAY[]::text[]),
  ARRAY['image/jpeg', 'image/png']::text[]
)
WHERE id = 'embryo-videos'
  AND NOT ('image/jpeg' = ANY(COALESCE(allowed_mime_types, ARRAY[]::text[])));
