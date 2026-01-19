-- ============================================================================
-- Migrar status de protocolos existentes para os novos status
-- PASSO2_FECHADO → SINCRONIZADO
-- EM_TE → FECHADO
-- ============================================================================

-- Primeiro, vamos ver quantos protocolos têm cada status antigo
SELECT 
    status,
    COUNT(*) as quantidade
FROM public.protocolos_sincronizacao
WHERE status IN ('PASSO2_FECHADO', 'EM_TE')
GROUP BY status;

-- Atualizar PASSO2_FECHADO para SINCRONIZADO
UPDATE public.protocolos_sincronizacao
SET status = 'SINCRONIZADO'
WHERE status = 'PASSO2_FECHADO';

-- Verificar quantos foram atualizados
SELECT 
    'Protocolos PASSO2_FECHADO atualizados para SINCRONIZADO' as acao,
    COUNT(*) as quantidade
FROM public.protocolos_sincronizacao
WHERE status = 'SINCRONIZADO';

-- Atualizar EM_TE para FECHADO
UPDATE public.protocolos_sincronizacao
SET status = 'FECHADO'
WHERE status = 'EM_TE';

-- Verificar quantos foram atualizados
SELECT 
    'Protocolos EM_TE atualizados para FECHADO' as acao,
    COUNT(*) as quantidade
FROM public.protocolos_sincronizacao
WHERE status = 'FECHADO';

-- Verificar se ainda existem protocolos com status antigos
SELECT 
    status,
    COUNT(*) as quantidade
FROM public.protocolos_sincronizacao
WHERE status IN ('PASSO2_FECHADO', 'EM_TE')
GROUP BY status;

-- Se retornar 0 linhas, significa que todos foram migrados com sucesso!
