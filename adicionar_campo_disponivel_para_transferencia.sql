-- Adicionar campo disponivel_para_transferencia na tabela lotes_fiv
-- Este campo controla se o lote está disponível para ser usado em transferências

ALTER TABLE lotes_fiv 
ADD COLUMN IF NOT EXISTS disponivel_para_transferencia BOOLEAN DEFAULT FALSE;

-- Comentário explicativo
COMMENT ON COLUMN lotes_fiv.disponivel_para_transferencia IS 'Indica se o lote está disponível para ser usado em transferências de embriões. Só deve ser marcado como true após todos os embriões serem classificados e o responsável confirmar que está pronto para transferência.';
