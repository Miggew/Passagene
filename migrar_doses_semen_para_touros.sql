-- Migration: Migrar estrutura de doses_semen para usar touros
-- Descrição: Adiciona campo touro_id na tabela doses_semen e migra dados existentes.
-- ATENÇÃO: Este script deve ser executado após criar a tabela touros.

-- Passo 1: Adicionar campo touro_id (nullable inicialmente para permitir migração)
ALTER TABLE public.doses_semen 
ADD COLUMN IF NOT EXISTS touro_id UUID REFERENCES public.touros(id) ON DELETE RESTRICT;

-- Passo 2: Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_doses_semen_touro_id ON public.doses_semen(touro_id);

-- Passo 3: Remover campos obsoletos (nome e raca agora vêm do touro)
-- Como o BD será zerado, podemos remover diretamente
ALTER TABLE public.doses_semen 
DROP COLUMN IF EXISTS nome,
DROP COLUMN IF EXISTS raca;

-- Passo 4: Tornar touro_id obrigatório (estrutura limpa desde o início)
ALTER TABLE public.doses_semen 
ALTER COLUMN touro_id SET NOT NULL;

-- Comentários
COMMENT ON COLUMN public.doses_semen.touro_id IS 'Referência ao touro do catálogo. As informações do touro (nome, raça, etc.) são obtidas da tabela touros.';
