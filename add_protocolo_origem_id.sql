-- ============================================================
-- Adicionar coluna protocolo_origem_id em protocolos_sincronizacao
-- ============================================================
-- Objetivo: Rastrear protocolos que são "espelhos" de outros protocolos
--           quando receptoras são movidas entre fazendas
-- ============================================================

-- Adicionar coluna protocolo_origem_id (opcional, para rastreamento)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'protocolos_sincronizacao'
        AND column_name = 'protocolo_origem_id'
    ) THEN
        ALTER TABLE protocolos_sincronizacao
        ADD COLUMN protocolo_origem_id UUID NULL REFERENCES protocolos_sincronizacao(id) ON DELETE SET NULL;
        
        COMMENT ON COLUMN protocolos_sincronizacao.protocolo_origem_id IS 'ID do protocolo original quando este protocolo é criado como espelho de outro protocolo (ex: quando receptoras são movidas entre fazendas). NULL para protocolos normais.';
        
        RAISE NOTICE 'Coluna protocolo_origem_id adicionada a protocolos_sincronizacao';
    ELSE
        RAISE NOTICE 'Coluna protocolo_origem_id já existe em protocolos_sincronizacao';
    END IF;
END $$;

-- Verificar resultado
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'protocolos_sincronizacao'
  AND column_name = 'protocolo_origem_id';
