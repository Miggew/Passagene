-- ============================================================================
-- SCRIPT DE INVESTIGAÇÃO: Status de Protocolos de Sincronização
-- Objetivo: Descobrir a origem de todos os status, incluindo EM_TE
-- ============================================================================

-- ============================================================================
-- PARTE 1: VERIFICAR VIEWS RELACIONADAS A PROTOCOLOS
-- ============================================================================

-- 1.1 Listar todas as views relacionadas a protocolos
SELECT 
    schemaname,
    viewname,
    definition
FROM pg_views
WHERE viewname LIKE '%protocolo%' OR viewname LIKE '%protocolos%'
ORDER BY viewname;

-- 1.2 Verificar view v_protocolo_receptoras_status (se existir)
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name LIKE '%protocolo%status%' OR table_name LIKE '%status%protocolo%'
ORDER BY table_name, ordinal_position;

-- 1.3 Ver estrutura completa de views relacionadas
SELECT 
    table_schema,
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (table_name LIKE '%protocolo%' OR table_name LIKE '%status%')
  AND table_name IN (SELECT table_name FROM information_schema.views WHERE table_schema = 'public')
ORDER BY table_name, ordinal_position;

-- ============================================================================
-- PARTE 2: VERIFICAR TRIGGERS NA TABELA protocolos_sincronizacao
-- ============================================================================

-- 2.1 Listar todos os triggers na tabela protocolos_sincronizacao
SELECT 
    tgname AS trigger_name,
    tgtype,
    tgenabled,
    tgisinternal,
    pg_get_triggerdef(oid) AS trigger_definition
FROM pg_trigger
WHERE tgrelid = 'protocolos_sincronizacao'::regclass
ORDER BY tgname;

-- 2.2 Ver funções chamadas por triggers
SELECT DISTINCT
    t.tgname AS trigger_name,
    p.proname AS function_name,
    pg_get_functiondef(p.oid) AS function_definition
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgrelid = 'protocolos_sincronizacao'::regclass
ORDER BY t.tgname;

-- 2.3 Verificar todas as funções relacionadas a protocolos
SELECT 
    p.proname AS function_name,
    pg_get_function_arguments(p.oid) AS arguments,
    pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND (p.proname LIKE '%protocolo%' OR p.proname LIKE '%status%')
ORDER BY p.proname;

-- ============================================================================
-- PARTE 3: VERIFICAR VALORES REAIS DE STATUS NO BANCO
-- ============================================================================

-- 3.1 Contar protocolos por status (todos os status encontrados)
SELECT 
    status,
    COUNT(*) AS quantidade,
    MIN(data_inicio) AS primeira_data,
    MAX(data_inicio) AS ultima_data,
    COUNT(DISTINCT fazenda_id) AS num_fazendas
FROM protocolos_sincronizacao
GROUP BY status
ORDER BY quantidade DESC;

-- 3.2 Ver detalhes de protocolos com status EM_TE (se existirem)
SELECT 
    id,
    fazenda_id,
    data_inicio,
    data_retirada,
    status,
    passo2_data,
    passo2_tecnico_responsavel,
    created_at,
    (SELECT COUNT(*) FROM protocolo_receptoras WHERE protocolo_id = ps.id) AS num_receptoras,
    (SELECT COUNT(*) FROM protocolo_receptoras WHERE protocolo_id = ps.id AND status = 'UTILIZADA') AS num_utilizadas
FROM protocolos_sincronizacao ps
WHERE status = 'EM_TE'
ORDER BY data_inicio DESC
LIMIT 20;

-- 3.3 Ver protocolos com status não padrão (todos exceto os conhecidos)
SELECT 
    status,
    COUNT(*) AS quantidade,
    STRING_AGG(DISTINCT 
        CASE 
            WHEN passo2_data IS NOT NULL THEN 'Tem passo2_data'
            ELSE 'Sem passo2_data'
        END, 
        ', '
    ) AS caracteristicas
FROM protocolos_sincronizacao
WHERE status NOT IN ('ABERTO', 'PASSO1_ABERTO', 'PASSO1_FECHADO', 'PRIMEIRO_PASSO_FECHADO', 'PASSO2_FECHADO', 'EM_TE')
   OR status IS NULL
GROUP BY status
ORDER BY quantidade DESC;

-- ============================================================================
-- PARTE 4: ANALISAR RELAÇÃO ENTRE STATUS E ESTADO DO PROTOCOLO
-- ============================================================================

-- 4.1 Análise cruzada: Status vs presença de passo2_data
SELECT 
    status,
    CASE 
        WHEN passo2_data IS NOT NULL THEN 'Com passo2_data'
        ELSE 'Sem passo2_data'
    END AS tem_passo2,
    COUNT(*) AS quantidade
FROM protocolos_sincronizacao
GROUP BY status, CASE WHEN passo2_data IS NOT NULL THEN 'Com passo2_data' ELSE 'Sem passo2_data' END
ORDER BY status, tem_passo2;

-- 4.2 Análise cruzada: Status vs receptoras UTILIZADAS
SELECT 
    ps.status,
    COUNT(*) AS total_protocolos,
    COUNT(CASE WHEN pr_count.num_utilizadas > 0 THEN 1 END) AS protocolos_com_utilizadas,
    COUNT(CASE WHEN pr_count.num_utilizadas = pr_count.num_receptoras AND pr_count.num_receptoras > 0 THEN 1 END) AS protocolos_100pct_utilizadas
FROM protocolos_sincronizacao ps
LEFT JOIN (
    SELECT 
        protocolo_id,
        COUNT(*) AS num_receptoras,
        COUNT(CASE WHEN status = 'UTILIZADA' THEN 1 END) AS num_utilizadas
    FROM protocolo_receptoras
    GROUP BY protocolo_id
) pr_count ON pr_count.protocolo_id = ps.id
GROUP BY ps.status
ORDER BY total_protocolos DESC;

-- 4.3 Detalhar protocolos que poderiam ser EM_TE (baseado em condições)
SELECT 
    ps.id,
    ps.status AS status_atual,
    ps.data_inicio,
    ps.passo2_data,
    (SELECT COUNT(*) FROM protocolo_receptoras WHERE protocolo_id = ps.id) AS num_receptoras,
    (SELECT COUNT(*) FROM protocolo_receptoras WHERE protocolo_id = ps.id AND status = 'UTILIZADA') AS num_utilizadas,
    (SELECT COUNT(*) FROM protocolo_receptoras WHERE protocolo_id = ps.id AND status = 'APTA') AS num_aptas,
    CASE 
        WHEN ps.status IN ('PASSO1_FECHADO', 'PRIMEIRO_PASSO_FECHADO')
         AND ps.passo2_data IS NOT NULL
         AND EXISTS (SELECT 1 FROM protocolo_receptoras WHERE protocolo_id = ps.id AND status = 'UTILIZADA')
         AND ps.status != 'PASSO2_FECHADO'
        THEN 'PODERIA SER EM_TE'
        ELSE 'Não atende critérios'
    END AS analise_em_te
FROM protocolos_sincronizacao ps
WHERE ps.status IN ('PASSO1_FECHADO', 'PRIMEIRO_PASSO_FECHADO', 'EM_TE', 'PASSO2_FECHADO')
ORDER BY ps.data_inicio DESC
LIMIT 50;

-- ============================================================================
-- PARTE 5: VERIFICAR CONSTRAINTS E CHECK CONSTRAINTS
-- ============================================================================

-- 5.1 Verificar constraints na tabela protocolos_sincronizacao
SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'protocolos_sincronizacao'::regclass
ORDER BY contype, conname;

-- 5.2 Verificar se há CHECK constraint limitando valores de status
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'protocolos_sincronizacao'::regclass
  AND contype = 'c'
  AND pg_get_constraintdef(oid) LIKE '%status%';

-- ============================================================================
-- PARTE 6: VERIFICAR ATUALIZAÇÕES AUTOMÁTICAS DE STATUS
-- ============================================================================

-- 6.1 Buscar por funções que atualizam status de protocolos
SELECT 
    p.proname AS function_name,
    pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND pg_get_functiondef(p.oid) LIKE '%UPDATE%protocolos_sincronizacao%status%'
ORDER BY p.proname;

-- 6.2 Buscar por funções que mencionam EM_TE
SELECT 
    p.proname AS function_name,
    pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND pg_get_functiondef(p.oid) LIKE '%EM_TE%'
ORDER BY p.proname;

-- ============================================================================
-- PARTE 7: VERIFICAR STATUS DE PROTOCOLO_RECEPTORAS
-- ============================================================================

-- 7.1 Ver todos os status únicos em protocolo_receptoras
SELECT 
    status,
    COUNT(*) AS quantidade,
    COUNT(DISTINCT protocolo_id) AS num_protocolos
FROM protocolo_receptoras
GROUP BY status
ORDER BY quantidade DESC;

-- 7.2 Ver relação entre status de protocolo e status de receptoras
SELECT 
    ps.status AS status_protocolo,
    pr.status AS status_receptora,
    COUNT(*) AS quantidade
FROM protocolos_sincronizacao ps
JOIN protocolo_receptoras pr ON pr.protocolo_id = ps.id
GROUP BY ps.status, pr.status
ORDER BY ps.status, quantidade DESC;

-- ============================================================================
-- PARTE 8: ANÁLISE DE STATUS REDUNDANTES
-- ============================================================================

-- 8.1 Comparar PASSO1_FECHADO vs PRIMEIRO_PASSO_FECHADO
SELECT 
    status,
    COUNT(*) AS quantidade,
    COUNT(CASE WHEN passo2_data IS NOT NULL THEN 1 END) AS com_passo2,
    COUNT(CASE WHEN passo2_data IS NULL THEN 1 END) AS sem_passo2,
    MIN(data_inicio) AS primeira_data,
    MAX(data_inicio) AS ultima_data
FROM protocolos_sincronizacao
WHERE status IN ('PASSO1_FECHADO', 'PRIMEIRO_PASSO_FECHADO')
GROUP BY status
ORDER BY status;

-- 8.2 Comparar ABERTO vs PASSO1_ABERTO
SELECT 
    ps.status,
    COUNT(*) AS quantidade,
    MIN(ps.data_inicio) AS primeira_data,
    MAX(ps.data_inicio) AS ultima_data,
    COUNT(CASE WHEN pr_counts.num_receptoras = 0 THEN 1 END) AS sem_receptoras
FROM protocolos_sincronizacao ps
LEFT JOIN (
    SELECT protocolo_id, COUNT(*) AS num_receptoras
    FROM protocolo_receptoras
    GROUP BY protocolo_id
) pr_counts ON pr_counts.protocolo_id = ps.id
WHERE ps.status IN ('ABERTO', 'PASSO1_ABERTO')
GROUP BY ps.status
ORDER BY ps.status;

-- 8.3 Resumo: Status mais usados vs menos usados
SELECT 
    status,
    COUNT(*) AS quantidade,
    ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM protocolos_sincronizacao), 2) AS percentual,
    CASE 
        WHEN status IN ('PASSO2_FECHADO') THEN '✅ Status Final - Usado'
        WHEN status IN ('PASSO1_FECHADO', 'PRIMEIRO_PASSO_FECHADO') THEN '✅ Status Intermediário - Usado'
        WHEN status IN ('ABERTO', 'PASSO1_ABERTO') THEN '✅ Status Inicial - Usado'
        WHEN status = 'EM_TE' THEN '❓ Status Desconhecido - Investigar'
        WHEN status IS NULL THEN '⚠️ NULL - Possível Problema'
        ELSE '❌ Status Não Reconhecido - Possível Erro'
    END AS classificacao
FROM protocolos_sincronizacao
GROUP BY status
ORDER BY quantidade DESC;

-- ============================================================================
-- PARTE 9: QUERY UNIFICADA DE RESUMO
-- ============================================================================

-- Resumo executivo: Status e suas características
SELECT 
    ps.status AS "Status",
    COUNT(*) AS "Quantidade",
    ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM protocolos_sincronizacao), 2) AS "Percentual",
    CASE 
        WHEN BOOL_OR(ps.passo2_data IS NOT NULL) THEN 'Sim'
        ELSE 'Não'
    END AS "Tem Passo2",
    ROUND(AVG(COALESCE(pr_counts.num_receptoras, 0)), 1)::NUMERIC(10,1) AS "Media Receptoras",
    MIN(ps.data_inicio) AS "Primeira Data",
    MAX(ps.data_inicio) AS "Ultima Data",
    CASE 
        WHEN ps.status IN ('PASSO2_FECHADO') THEN '✅ Status Final'
        WHEN ps.status IN ('PASSO1_FECHADO', 'PRIMEIRO_PASSO_FECHADO') THEN '✅ Status Intermediário'
        WHEN ps.status IN ('ABERTO', 'PASSO1_ABERTO') THEN '✅ Status Inicial'
        WHEN ps.status = 'EM_TE' THEN '❓ Status Desconhecido'
        WHEN ps.status IS NULL THEN '⚠️ NULL'
        ELSE '❌ Status Não Reconhecido'
    END AS "Classificacao"
FROM protocolos_sincronizacao ps
LEFT JOIN (
    SELECT protocolo_id, COUNT(*) AS num_receptoras
    FROM protocolo_receptoras
    GROUP BY protocolo_id
) pr_counts ON pr_counts.protocolo_id = ps.id
GROUP BY ps.status
ORDER BY COUNT(*) DESC;

-- ============================================================================
-- INSTRUÇÕES DE USO
-- ============================================================================
-- Execute este script no SQL Editor do Supabase
-- 1. Execute as queries uma por uma ou em blocos
-- 2. Analise os resultados para cada parte
-- 3. Compare com os status encontrados no código
-- 4. Identifique:
--    - Status que são redundantes (ex: PASSO1_FECHADO vs PRIMEIRO_PASSO_FECHADO)
--    - Status que não são usados no código mas existem no banco
--    - Status que são usados no código mas não existem no banco
--    - Origem do EM_TE (se encontrado)
