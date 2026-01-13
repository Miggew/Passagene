-- ============================================================
-- REESTRUTURAÇÃO DE LOTES FIV
-- ============================================================
-- Objetivo: Mudar de aspiração individual para pacote de aspiração
--           Permitir múltiplas doses de sêmen por doadora
--           Permitir fração de dose (ex: 0.5)
--           Contador de dias até dia 7
-- ============================================================

-- 1. Criar nova tabela para acasalamentos (relação doadora + sêmen dentro do lote)
CREATE TABLE IF NOT EXISTS lote_fiv_acasalamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lote_fiv_id UUID NOT NULL REFERENCES lotes_fiv(id) ON DELETE CASCADE,
    aspiracao_doadora_id UUID NOT NULL REFERENCES aspiracoes_doadoras(id) ON DELETE RESTRICT,
    dose_semen_id UUID NOT NULL REFERENCES doses_semen(id) ON DELETE RESTRICT,
    quantidade_fracionada DECIMAL(5,2) NOT NULL DEFAULT 1.0 CHECK (quantidade_fracionada > 0),
    quantidade_embrioes INTEGER,
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(lote_fiv_id, aspiracao_doadora_id, dose_semen_id)
);

COMMENT ON TABLE lote_fiv_acasalamentos IS 'Acasalamentos dentro de um lote FIV - relaciona doadora, sêmen e quantidade';
COMMENT ON COLUMN lote_fiv_acasalamentos.lote_fiv_id IS 'ID do lote FIV ao qual este acasalamento pertence';
COMMENT ON COLUMN lote_fiv_acasalamentos.aspiracao_doadora_id IS 'ID da aspiração da doadora';
COMMENT ON COLUMN lote_fiv_acasalamentos.dose_semen_id IS 'ID da dose de sêmen utilizada';
COMMENT ON COLUMN lote_fiv_acasalamentos.quantidade_fracionada IS 'Quantidade fracionada de dose (ex: 0.5, 1.0, 2.0)';
COMMENT ON COLUMN lote_fiv_acasalamentos.quantidade_embrioes IS 'Quantidade de embriões produzidos (preenchido no dia 7)';

-- 2. Criar tabela de relacionamento many-to-many para fazendas destino
CREATE TABLE IF NOT EXISTS lote_fiv_fazendas_destino (
    lote_fiv_id UUID NOT NULL REFERENCES lotes_fiv(id) ON DELETE CASCADE,
    fazenda_id UUID NOT NULL REFERENCES fazendas(id) ON DELETE RESTRICT,
    PRIMARY KEY (lote_fiv_id, fazenda_id)
);

COMMENT ON TABLE lote_fiv_fazendas_destino IS 'Fazendas destino de um lote FIV (many-to-many)';

-- 3. Adicionar pacote_aspiracao_id na tabela lotes_fiv
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'lotes_fiv' AND column_name = 'pacote_aspiracao_id') THEN
        ALTER TABLE lotes_fiv ADD COLUMN pacote_aspiracao_id UUID REFERENCES pacotes_aspiracao(id) ON DELETE RESTRICT;
        COMMENT ON COLUMN lotes_fiv.pacote_aspiracao_id IS 'ID do pacote de aspiração ao qual este lote pertence';
    END IF;
END $$;

-- 4. Adicionar data_abertura na tabela lotes_fiv
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'lotes_fiv' AND column_name = 'data_abertura') THEN
        ALTER TABLE lotes_fiv ADD COLUMN data_abertura DATE;
        COMMENT ON COLUMN lotes_fiv.data_abertura IS 'Data de abertura do lote (data do pacote + 1 dia)';
    END IF;
END $$;

-- 5. Adicionar status na tabela lotes_fiv
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'lotes_fiv' AND column_name = 'status') THEN
        ALTER TABLE lotes_fiv ADD COLUMN status TEXT DEFAULT 'ABERTO' CHECK (status IN ('ABERTO', 'FECHADO'));
        COMMENT ON COLUMN lotes_fiv.status IS 'Status do lote: ABERTO ou FECHADO';
    END IF;
END $$;

-- NOTA: A coluna aspiracao_id será mantida por compatibilidade por enquanto
-- A coluna dose_semen_id será mantida por compatibilidade por enquanto
-- A coluna fazenda_destino_id será mantida por compatibilidade por enquanto
-- Essas colunas podem ser removidas depois que o frontend for atualizado
