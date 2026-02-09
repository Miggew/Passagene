-- ============================================
-- DIAGNÓSTICO: Listar todas as policies das tabelas EmbryoScore
-- Execute no SQL Editor para ver o estado atual
-- ============================================

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN (
  'acasalamento_embrioes_media',
  'embryo_analysis_queue',
  'embryo_scores',
  'embryo_score_config',
  'embrioes'
)
ORDER BY tablename, policyname;
