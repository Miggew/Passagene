-- Adiciona coluna crop_image_path na tabela embryo_scores
-- Armazena o path no Storage (bucket embryo-videos) do crop JPEG do embrião
-- Populado pelo Edge Function embryo-analyze a partir de crop_paths da queue

ALTER TABLE public.embryo_scores
  ADD COLUMN IF NOT EXISTS crop_image_path text;

COMMENT ON COLUMN public.embryo_scores.crop_image_path IS 'Path no Storage (embryo-videos bucket) do crop JPEG deste embrião. Usado para exibir thumbnail sem re-baixar o vídeo inteiro.';
