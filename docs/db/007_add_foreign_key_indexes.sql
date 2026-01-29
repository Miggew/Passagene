-- ============================================
-- INFO: Adicionar índices em Foreign Keys
-- ============================================
-- Supabase recomenda criar índices em colunas FK para:
-- - Melhorar performance de JOINs
-- - Acelerar DELETE/UPDATE em cascata
-- - Otimizar queries que filtram por FK
--
-- IMPORTANTE: Este script é OPCIONAL (nível INFO).
-- Execute apenas se perceber lentidão em queries.
-- ============================================

-- ============================================
-- PARTE 1: Índices para animais
-- ============================================
CREATE INDEX IF NOT EXISTS idx_animais_fazenda_id
ON public.animais(fazenda_id);

-- ============================================
-- PARTE 2: Índices para aspiracoes_doadoras
-- ============================================
-- Nota: aspiracoes_doadoras não tem coluna aspiracao_id
CREATE INDEX IF NOT EXISTS idx_aspiracoes_doadoras_doadora_id
ON public.aspiracoes_doadoras(doadora_id);

-- ============================================
-- PARTE 3: Índices para diagnosticos_gestacao
-- ============================================
CREATE INDEX IF NOT EXISTS idx_diagnosticos_gestacao_receptora_id
ON public.diagnosticos_gestacao(receptora_id);

CREATE INDEX IF NOT EXISTS idx_diagnosticos_gestacao_transferencia_id
ON public.diagnosticos_gestacao(transferencia_embriao_id);

-- ============================================
-- PARTE 4: Índices para doadoras
-- ============================================
CREATE INDEX IF NOT EXISTS idx_doadoras_animal_id
ON public.doadoras(animal_id);

-- ============================================
-- PARTE 5: Índices para doses_semen
-- ============================================
CREATE INDEX IF NOT EXISTS idx_doses_semen_touro_id
ON public.doses_semen(touro_id);

-- ============================================
-- PARTE 6: Índices para embrioes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_embrioes_acasalamento_id
ON public.embrioes(acasalamento_id);

CREATE INDEX IF NOT EXISTS idx_embrioes_doadora_id
ON public.embrioes(doadora_id);

-- ============================================
-- PARTE 7: Índices para fazendas
-- ============================================
CREATE INDEX IF NOT EXISTS idx_fazendas_cliente_id
ON public.fazendas(cliente_id);

-- ============================================
-- PARTE 8: Índices para historico_embrioes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_historico_embrioes_embriao_id
ON public.historico_embrioes(embriao_id);

-- ============================================
-- PARTE 9: Índices para lote_fiv_acasalamentos
-- ============================================
CREATE INDEX IF NOT EXISTS idx_lote_fiv_acasalamentos_doadora_id
ON public.lote_fiv_acasalamentos(doadora_id);

CREATE INDEX IF NOT EXISTS idx_lote_fiv_acasalamentos_lote_fiv_id
ON public.lote_fiv_acasalamentos(lote_fiv_id);

CREATE INDEX IF NOT EXISTS idx_lote_fiv_acasalamentos_touro_id
ON public.lote_fiv_acasalamentos(touro_id);

-- ============================================
-- PARTE 10: Índices para lote_fiv_fazendas_destino
-- ============================================
CREATE INDEX IF NOT EXISTS idx_lote_fiv_fazendas_destino_fazenda_id
ON public.lote_fiv_fazendas_destino(fazenda_id);

CREATE INDEX IF NOT EXISTS idx_lote_fiv_fazendas_destino_lote_fiv_id
ON public.lote_fiv_fazendas_destino(lote_fiv_id);

-- ============================================
-- PARTE 11: Índices para lotes_fiv
-- ============================================
CREATE INDEX IF NOT EXISTS idx_lotes_fiv_fazenda_id
ON public.lotes_fiv(fazenda_id);

-- ============================================
-- PARTE 12: Índices para pacotes_aspiracao
-- ============================================
CREATE INDEX IF NOT EXISTS idx_pacotes_aspiracao_lote_fiv_id
ON public.pacotes_aspiracao(lote_fiv_id);

-- ============================================
-- PARTE 13: Índices para pacotes_aspiracao_fazendas_destino
-- ============================================
CREATE INDEX IF NOT EXISTS idx_pacotes_aspiracao_fazendas_destino_fazenda_id
ON public.pacotes_aspiracao_fazendas_destino(fazenda_id);

CREATE INDEX IF NOT EXISTS idx_pacotes_aspiracao_fazendas_destino_pacote_id
ON public.pacotes_aspiracao_fazendas_destino(pacote_aspiracao_id);

-- ============================================
-- PARTE 14: Índices para protocolo_receptoras
-- ============================================
CREATE INDEX IF NOT EXISTS idx_protocolo_receptoras_protocolo_id
ON public.protocolo_receptoras(protocolo_id);

CREATE INDEX IF NOT EXISTS idx_protocolo_receptoras_receptora_id
ON public.protocolo_receptoras(receptora_id);

-- ============================================
-- PARTE 15: Índices para protocolos_sincronizacao
-- ============================================
CREATE INDEX IF NOT EXISTS idx_protocolos_sincronizacao_fazenda_id
ON public.protocolos_sincronizacao(fazenda_id);

-- ============================================
-- PARTE 16: Índices para transferencias_embrioes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_transferencias_embrioes_embriao_id
ON public.transferencias_embrioes(embriao_id);

CREATE INDEX IF NOT EXISTS idx_transferencias_embrioes_protocolo_receptora_id
ON public.transferencias_embrioes(protocolo_receptora_id);

CREATE INDEX IF NOT EXISTS idx_transferencias_embrioes_sessao_id
ON public.transferencias_embrioes(sessao_id);

-- ============================================
-- VERIFICAÇÃO
-- ============================================
-- Execute para confirmar que os índices foram criados:
/*
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
*/

-- ============================================
-- SOBRE ÍNDICES "NÃO UTILIZADOS"
-- ============================================
-- O Supabase também reportou 20 índices não utilizados.
-- RECOMENDAÇÃO: NÃO REMOVA esses índices ainda.
--
-- Motivos:
-- 1. O sistema pode ser novo/com pouco uso
-- 2. Estatísticas podem estar desatualizadas
-- 3. Queries importantes podem não ter sido executadas ainda
--
-- Monitore por 2-4 semanas com uso real antes de considerar
-- remoção. Use esta query para verificar uso:
/*
SELECT
    schemaname,
    relname AS table_name,
    indexrelname AS index_name,
    idx_scan AS times_used,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC, pg_relation_size(indexrelid) DESC;
*/
