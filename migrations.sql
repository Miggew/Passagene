-- Migração SQL para melhorias do PassaGene
-- Execute este arquivo no SQL Editor do Supabase

-- 1. Adicionar campos para o 2º passo na tabela protocolos_sincronizacao
ALTER TABLE protocolos_sincronizacao
ADD COLUMN IF NOT EXISTS passo2_data DATE,
ADD COLUMN IF NOT EXISTS passo2_tecnico_responsavel TEXT;

-- 2. Tornar motivo_inapta opcional (já deve ser opcional, mas garantindo)
-- Se a coluna já existir com NOT NULL, descomente a linha abaixo:
-- ALTER TABLE protocolo_receptoras ALTER COLUMN motivo_inapta DROP NOT NULL;

-- Verificar se as colunas foram criadas corretamente
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'protocolos_sincronizacao' 
-- AND column_name IN ('passo2_data', 'passo2_tecnico_responsavel');
