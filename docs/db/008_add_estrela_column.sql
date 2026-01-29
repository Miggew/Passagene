-- Migração: Adicionar campo "estrela" na tabela de embriões
-- Data: 2026-01-28
-- Descrição: Campo para marcar embriões top/excelentes (estrela desenhada pela bióloga)

-- Adicionar coluna estrela
ALTER TABLE embrioes
ADD COLUMN IF NOT EXISTS estrela BOOLEAN DEFAULT FALSE;

-- Comentário na coluna
COMMENT ON COLUMN embrioes.estrela IS 'Embrião top/excelente marcado com estrela pela bióloga no laboratório';
