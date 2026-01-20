-- Migration: Configurar doses_semen para usar touros (BD limpo)
-- Descrição: Adiciona campo touro_id na tabela doses_semen.
-- Este script é para quando o banco de dados será zerado (sem dados existentes).

-- Passo 1: Adicionar campo touro_id (obrigatório desde o início)
ALTER TABLE public.doses_semen 
ADD COLUMN IF NOT EXISTS touro_id UUID NOT NULL REFERENCES public.touros(id) ON DELETE RESTRICT;

-- Passo 2: Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_doses_semen_touro_id ON public.doses_semen(touro_id);

-- Passo 3: Remover campos obsoletos (nome e raca agora vêm do touro)
ALTER TABLE public.doses_semen 
DROP COLUMN IF EXISTS nome,
DROP COLUMN IF EXISTS raca;

-- Comentários
COMMENT ON COLUMN public.doses_semen.touro_id IS 'Referência ao touro do catálogo. As informações do touro (nome, raça, etc.) são obtidas da tabela touros. OBRIGATÓRIO: todas as doses devem estar associadas a um touro.';
