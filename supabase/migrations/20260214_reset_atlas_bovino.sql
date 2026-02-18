-- ============================================================
-- FASE 2: Lavagem Gástrica do Atlas
--
-- O banco KNN estava envenenado com 200 referências de embriões
-- HUMANOS (species='human'), que destruíam a similaridade para
-- embriões bovinos. O MLP classifier também estava inoperante.
--
-- Esta migration limpa:
-- 1. Todas as referências não-bovinas do atlas
-- 2. Todos os scores inúteis (insufficient, score=0)
--
-- O atlas ficará com 0 referências — Cold Start intencional.
-- O biólogo alimentará o atlas via Blind Review (Fase 3).
-- ============================================================

-- 1. Purgar referências não-bovinas do atlas KNN
-- Mantém apenas species = 'bovine_real' (se existir alguma)
DELETE FROM embryo_references
WHERE species != 'bovine_real';

-- 2. Limpar scores inúteis gerados com atlas envenenado
-- Remove scores com combined_source='insufficient' (KNN sem dados)
-- e scores com embryo_score=0 (resultado sem valor clínico)
DELETE FROM embryo_scores
WHERE combined_source = 'insufficient'
   OR embryo_score = 0;

-- 3. Limpar scores antigos marcados como não-correntes que tinham lixo
DELETE FROM embryo_scores
WHERE is_current = false
  AND combined_source IS NOT NULL
  AND combined_source IN ('insufficient', 'mlp_only')
  AND embryo_score <= 10;
