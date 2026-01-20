-- Script para adicionar campo cliente_id na tabela embrioes
-- Este campo será usado para identificar a qual cliente pertence o estoque de embriões congelados

-- ============================================================
-- PASSO 1: Adicionar coluna cliente_id na tabela embrioes
-- ============================================================

ALTER TABLE public.embrioes
ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL;

-- ============================================================
-- PASSO 2: Adicionar índice para otimizar buscas por cliente
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_embrioes_cliente_id ON public.embrioes(cliente_id);

-- ============================================================
-- PASSO 3: Adicionar comentário explicativo
-- ============================================================

COMMENT ON COLUMN public.embrioes.cliente_id IS 'ID do cliente dono do estoque de embriões congelados. NULL indica que o embrião ainda não foi direcionado para nenhum cliente.';

-- ============================================================
-- OBSERVAÇÃO IMPORTANTE
-- ============================================================
-- Este campo será usado apenas para embriões congelados (status_atual = 'CONGELADO')
-- Embriões frescos não devem ter cliente_id atribuído até serem congelados e direcionados.
-- 
-- Quando um embrião é congelado e direcionado para um cliente:
-- - O campo cliente_id é preenchido
-- - O embrião aparece no estoque do cliente
-- - O embrião pode ser usado em transferências do cliente
