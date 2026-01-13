-- ============================================================
-- Criar tabela pacotes_aspiracao
-- ============================================================
-- Objetivo: Agrupar aspirações da mesma fazenda no mesmo dia
--           em um único pacote com destino definido
-- ============================================================

-- 1. Criar tabela pacotes_aspiracao
CREATE TABLE IF NOT EXISTS pacotes_aspiracao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fazenda_id UUID NOT NULL REFERENCES fazendas(id) ON DELETE CASCADE,
    fazenda_destino_id UUID NOT NULL REFERENCES fazendas(id) ON DELETE RESTRICT,
    data_aspiracao DATE NOT NULL,
    horario_inicio TIME,
    veterinario_responsavel TEXT,
    tecnico_responsavel TEXT,
    status TEXT NOT NULL DEFAULT 'EM_ANDAMENTO' CHECK (status IN ('EM_ANDAMENTO', 'FINALIZADO')),
    total_oocitos INTEGER DEFAULT 0,
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE pacotes_aspiracao IS 'Agrupa aspirações da mesma fazenda no mesmo dia em um pacote';
COMMENT ON COLUMN pacotes_aspiracao.fazenda_id IS 'Fazenda onde a aspiração foi realizada';
COMMENT ON COLUMN pacotes_aspiracao.fazenda_destino_id IS 'Fazenda destino dos embriões produzidos a partir dos oócitos';
COMMENT ON COLUMN pacotes_aspiracao.data_aspiracao IS 'Data da aspiração';
COMMENT ON COLUMN pacotes_aspiracao.horario_inicio IS 'Horário de início da aspiração';
COMMENT ON COLUMN pacotes_aspiracao.status IS 'Status do pacote: EM_ANDAMENTO ou FINALIZADO';
COMMENT ON COLUMN pacotes_aspiracao.total_oocitos IS 'Soma total de oócitos de todas as doadoras do pacote';

-- 2. Adicionar coluna pacote_aspiracao_id na tabela aspiracoes_doadoras
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'aspiracoes_doadoras' 
        AND column_name = 'pacote_aspiracao_id'
    ) THEN
        ALTER TABLE aspiracoes_doadoras 
        ADD COLUMN pacote_aspiracao_id UUID REFERENCES pacotes_aspiracao(id) ON DELETE CASCADE;
        
        COMMENT ON COLUMN aspiracoes_doadoras.pacote_aspiracao_id IS 'ID do pacote de aspiração ao qual esta aspiração pertence';
    END IF;
END $$;

-- 3. Adicionar campos novos em aspiracoes_doadoras
DO $$
BEGIN
    -- Adicionar recomendacao_touro
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'aspiracoes_doadoras' 
        AND column_name = 'recomendacao_touro'
    ) THEN
        ALTER TABLE aspiracoes_doadoras 
        ADD COLUMN recomendacao_touro TEXT;
        
        COMMENT ON COLUMN aspiracoes_doadoras.recomendacao_touro IS 'Recomendação de touro para acasalamento com a doadora (opcional)';
    END IF;

    -- Adicionar hora_final
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'aspiracoes_doadoras' 
        AND column_name = 'hora_final'
    ) THEN
        ALTER TABLE aspiracoes_doadoras 
        ADD COLUMN hora_final TIME;
        
        COMMENT ON COLUMN aspiracoes_doadoras.hora_final IS 'Horário final da aspiração desta doadora';
    END IF;
END $$;

-- 4. Criar índice para melhorar performance
CREATE INDEX IF NOT EXISTS idx_pacotes_aspiracao_fazenda_data 
ON pacotes_aspiracao(fazenda_id, data_aspiracao);

CREATE INDEX IF NOT EXISTS idx_aspiracoes_doadoras_pacote 
ON aspiracoes_doadoras(pacote_aspiracao_id);

-- 5. Criar função para atualizar total_oocitos do pacote
CREATE OR REPLACE FUNCTION atualizar_total_oocitos_pacote()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.pacote_aspiracao_id IS NOT NULL THEN
        UPDATE pacotes_aspiracao
        SET total_oocitos = (
            SELECT COALESCE(SUM(total_oocitos), 0)
            FROM aspiracoes_doadoras
            WHERE pacote_aspiracao_id = NEW.pacote_aspiracao_id
        ),
        updated_at = NOW()
        WHERE id = NEW.pacote_aspiracao_id;
    END IF;
    
    IF OLD.pacote_aspiracao_id IS NOT NULL AND (OLD.pacote_aspiracao_id != NEW.pacote_aspiracao_id OR NEW.pacote_aspiracao_id IS NULL) THEN
        UPDATE pacotes_aspiracao
        SET total_oocitos = (
            SELECT COALESCE(SUM(total_oocitos), 0)
            FROM aspiracoes_doadoras
            WHERE pacote_aspiracao_id = OLD.pacote_aspiracao_id
        ),
        updated_at = NOW()
        WHERE id = OLD.pacote_aspiracao_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Criar trigger para atualizar total automaticamente
DROP TRIGGER IF EXISTS trigger_atualizar_total_oocitos_pacote ON aspiracoes_doadoras;
CREATE TRIGGER trigger_atualizar_total_oocitos_pacote
AFTER INSERT OR UPDATE OR DELETE ON aspiracoes_doadoras
FOR EACH ROW
EXECUTE FUNCTION atualizar_total_oocitos_pacote();
