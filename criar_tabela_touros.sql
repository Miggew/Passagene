-- Migration: Criar tabela de touros (catálogo de touros)
-- Descrição: Cria a tabela touros que será o catálogo geral de touros.
-- Estrutura: Campos comuns na tabela principal + campos dinâmicos em JSONB por raça.
-- As doses de sêmen dos clientes serão relacionadas a esses touros.

-- Criar tabela touros
CREATE TABLE IF NOT EXISTS public.touros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- ============================================
    -- CAMPOS COMUNS (todas as raças)
    -- ============================================
    
    -- Identificação básica
    registro TEXT NOT NULL UNIQUE,
    nome TEXT NOT NULL,
    raca TEXT NOT NULL, -- Chave para determinar schema dinâmico
    data_nascimento DATE,
    
    -- Proprietário e fazenda (comum a todas as raças)
    proprietario TEXT,
    fazenda_nome TEXT,
    
    -- Pedigree básico (comum)
    pai_registro TEXT,
    pai_nome TEXT,
    mae_registro TEXT,
    mae_nome TEXT,
    genealogia_texto TEXT, -- Texto livre para genealogia completa
    
    -- Links e mídia (comum)
    foto_url TEXT,
    link_catalogo TEXT, -- Link para catálogo externo
    link_video TEXT, -- Link para vídeo (YouTube, etc.)
    
    -- ============================================
    -- CAMPOS DINÂMICOS (JSONB - variam por raça)
    -- ============================================
    
    -- Dados genéticos específicos da raça
    -- Exemplos:
    -- Holandesa: nm_dolares, tpi, ptat, udc, flc, bwc, gpa_lpi, pro_dolar
    -- Nelore: sumario_ancp, sumario_abcz_pmgz, genepius
    -- Girolando: gpta_leite, ipplg, ietg, ifpg, ireg, csmg
    dados_geneticos JSONB DEFAULT '{}'::jsonb,
    
    -- Dados de produção específicos da raça
    -- Exemplos:
    -- Holandesa: leite_kg, gordura_kg, gordura_porcent, proteina_kg, etc.
    -- Nelore: mp120, dpn, dp365, etc.
    dados_producao JSONB DEFAULT '{}'::jsonb,
    
    -- Dados de conformação física
    -- Exemplos:
    -- Holandesa: estatura, largura_peito, sistema_mamario, pernas_pes, etc.
    -- Nelore: (menos comum, mas pode ter)
    dados_conformacao JSONB DEFAULT '{}'::jsonb,
    
    -- Medidas físicas (especialmente Nelore)
    -- Exemplos:
    -- Nelore: cc, ag, cg, lg, pt, pc, ce (medidas em cm)
    medidas_fisicas JSONB DEFAULT '{}'::jsonb,
    
    -- Dados de saúde e reprodução
    -- Exemplos:
    -- Holandesa: perm_rebanho, ccs, facilidade_parto, fertilidade_filhas, etc.
    dados_saude_reproducao JSONB DEFAULT '{}'::jsonb,
    
    -- Caseínas e proteínas do leite (principalmente Holandesa/Girolando)
    -- Exemplos:
    -- beta_caseina: "A1A2", "A2A2"
    -- kappa_caseina: "AA", "BB", "AB"
    -- beta_lactoglobulina: "AA", "AB", "BB"
    caseinas JSONB DEFAULT '{}'::jsonb,
    
    -- Outros dados específicos da raça
    -- Exemplos:
    -- Girolando: composicao_genetica: "5/8 HOLANDÊS + 3/8 GIR"
    -- Badges: ["A2A2", "GENOMAX", "SEMEXX", "GRAZINGPRO", etc.]
    outros_dados JSONB DEFAULT '{}'::jsonb,
    
    -- ============================================
    -- OUTROS CAMPOS COMUNS
    -- ============================================
    
    observacoes TEXT,
    disponivel BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_touros_registro ON public.touros(registro);
CREATE INDEX IF NOT EXISTS idx_touros_nome ON public.touros(nome);
CREATE INDEX IF NOT EXISTS idx_touros_raca ON public.touros(raca);
CREATE INDEX IF NOT EXISTS idx_touros_disponivel ON public.touros(disponivel);

-- Criar índices GIN para busca rápida em campos JSONB
CREATE INDEX IF NOT EXISTS idx_touros_dados_geneticos ON public.touros USING GIN (dados_geneticos);
CREATE INDEX IF NOT EXISTS idx_touros_dados_producao ON public.touros USING GIN (dados_producao);
CREATE INDEX IF NOT EXISTS idx_touros_dados_conformacao ON public.touros USING GIN (dados_conformacao);

-- Criar trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_touros_updated_at 
    BEFORE UPDATE ON public.touros 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários nas colunas principais
COMMENT ON TABLE public.touros IS 'Catálogo geral de touros. As doses de sêmen dos clientes referenciam touros desta tabela. Campos dinâmicos por raça são armazenados em JSONB.';
COMMENT ON COLUMN public.touros.registro IS 'Registro único do touro (ex: 250HO14579, JCVL2889)';
COMMENT ON COLUMN public.touros.nome IS 'Nome do touro (ex: HANCOCK, DORITOS FIV CABO VERDE)';
COMMENT ON COLUMN public.touros.raca IS 'Raça do touro. Determina quais campos dinâmicos são exibidos (Holandesa, Nelore, Girolando, Gir, Guzerá, etc.)';
COMMENT ON COLUMN public.touros.dados_geneticos IS 'Campos genéticos específicos da raça (JSONB). Estrutura varia conforme raca.';
COMMENT ON COLUMN public.touros.dados_producao IS 'Dados de produção específicos da raça (JSONB). Estrutura varia conforme raca.';
COMMENT ON COLUMN public.touros.dados_conformacao IS 'Dados de conformação física (JSONB). Estrutura varia conforme raca.';
COMMENT ON COLUMN public.touros.medidas_fisicas IS 'Medidas físicas corporais (JSONB). Principalmente para Nelore (CC, AG, CG, etc.).';
COMMENT ON COLUMN public.touros.dados_saude_reproducao IS 'Dados de saúde e reprodução (JSONB). Estrutura varia conforme raca.';
COMMENT ON COLUMN public.touros.caseinas IS 'Proteínas do leite: beta_caseina, kappa_caseina, beta_lactoglobulina (JSONB).';
COMMENT ON COLUMN public.touros.outros_dados IS 'Outros dados específicos da raça: composição genética, badges, etc. (JSONB).';
COMMENT ON COLUMN public.touros.disponivel IS 'Indica se o touro está disponível no catálogo.';
