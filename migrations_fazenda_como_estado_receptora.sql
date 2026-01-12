-- ============================================================
-- Migration: Fazenda como Estado da Receptora
-- ============================================================
-- Objetivo: Refatorar modelagem para que fazenda seja apenas
--           um estado/localização atual da receptora (mutável),
--           e protocolo/ciclo seja vinculado à receptora, não à fazenda.
-- ============================================================

BEGIN;

-- ============================================================
-- PARTE A: Tabela de Histórico de Fazendas da Receptora
-- ============================================================

-- 1. Criar tabela receptora_fazenda_historico (se não existir)
CREATE TABLE IF NOT EXISTS receptora_fazenda_historico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receptora_id UUID NOT NULL REFERENCES receptoras(id) ON DELETE CASCADE,
    fazenda_id UUID NOT NULL REFERENCES fazendas(id) ON DELETE RESTRICT,
    data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
    data_fim DATE NULL, -- NULL = vínculo ativo
    observacoes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 1.1. Garantir que todas as colunas existam (caso a tabela já exista sem algumas colunas)
DO $$
BEGIN
    -- Adicionar colunas faltantes se a tabela já existir
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'receptora_fazenda_historico') THEN
        -- Renomear data_entrada para data_inicio (se existir)
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'receptora_fazenda_historico' AND column_name = 'data_entrada') THEN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'receptora_fazenda_historico' AND column_name = 'data_inicio') THEN
                ALTER TABLE receptora_fazenda_historico RENAME COLUMN data_entrada TO data_inicio;
            END IF;
        END IF;
        
        -- Adicionar coluna data_inicio se não existir
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'receptora_fazenda_historico' AND column_name = 'data_inicio') THEN
            ALTER TABLE receptora_fazenda_historico ADD COLUMN data_inicio DATE NOT NULL DEFAULT CURRENT_DATE;
        END IF;
        
        -- Adicionar coluna data_fim se não existir
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'receptora_fazenda_historico' AND column_name = 'data_fim') THEN
            ALTER TABLE receptora_fazenda_historico ADD COLUMN data_fim DATE NULL;
        END IF;
        
        -- Adicionar outras colunas se necessário
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'receptora_fazenda_historico' AND column_name = 'observacoes') THEN
            ALTER TABLE receptora_fazenda_historico ADD COLUMN observacoes TEXT;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'receptora_fazenda_historico' AND column_name = 'created_at') THEN
            ALTER TABLE receptora_fazenda_historico ADD COLUMN created_at TIMESTAMP DEFAULT NOW();
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'receptora_fazenda_historico' AND column_name = 'updated_at') THEN
            ALTER TABLE receptora_fazenda_historico ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
        END IF;
    END IF;
END $$;

-- 2. Criar índice único parcial para garantir apenas 1 vínculo ativo por receptora
--    Usando índice parcial com WHERE data_fim IS NULL
--    Drop índice se existir (caso precise recriar)
DROP INDEX IF EXISTS idx_receptora_fazenda_ativo;
CREATE UNIQUE INDEX idx_receptora_fazenda_ativo 
ON receptora_fazenda_historico (receptora_id) 
WHERE data_fim IS NULL;

-- 3. Índice para consultas por fazenda_id
CREATE INDEX IF NOT EXISTS idx_receptora_fazenda_historico_fazenda 
ON receptora_fazenda_historico (fazenda_id);

-- 4. Índice para consultas por receptora_id (inclui histórico)
CREATE INDEX IF NOT EXISTS idx_receptora_fazenda_historico_receptora 
ON receptora_fazenda_historico (receptora_id, data_inicio DESC);

-- ============================================================
-- PARTE B: View para Fazenda Atual da Receptora
-- ============================================================

-- 5. Criar view vw_receptoras_fazenda_atual
DROP VIEW IF EXISTS vw_receptoras_fazenda_atual CASCADE;

CREATE VIEW vw_receptoras_fazenda_atual AS
SELECT 
    rfh.receptora_id,
    rfh.fazenda_id AS fazenda_id_atual,
    rfh.data_inicio AS data_inicio_atual,
    f.nome AS fazenda_nome_atual,
    c.id AS cliente_id,
    c.nome AS cliente_nome
FROM receptora_fazenda_historico rfh
INNER JOIN fazendas f ON f.id = rfh.fazenda_id
INNER JOIN clientes c ON c.id = f.cliente_id
WHERE rfh.data_fim IS NULL;

-- Comentário na view
DO $$
BEGIN
    COMMENT ON VIEW vw_receptoras_fazenda_atual IS 'View que retorna a fazenda atual (ativa) de cada receptora, baseada no registro mais recente com data_fim NULL em receptora_fazenda_historico.';
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- ============================================================
-- PARTE C: Migração de Dados Existentes (se necessário)
-- ============================================================

-- 6. Migrar dados de receptoras.fazenda_atual_id para receptora_fazenda_historico
--    Apenas para receptoras que ainda não têm registro no histórico
--    e que têm fazenda_atual_id preenchido
--    NOTA: A coluna data_entrada já foi renomeada para data_inicio no bloco anterior
DO $$
DECLARE
    rec_count INTEGER;
BEGIN
    -- Verificar se a coluna data_inicio existe (após renomeação)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'receptora_fazenda_historico' AND column_name = 'data_inicio') THEN
        RAISE NOTICE 'Coluna data_inicio não encontrada. Pulando migração de dados.';
        RETURN;
    END IF;
    
    -- Inserir registro histórico para receptoras que têm fazenda_atual_id mas não têm histórico
    -- Verificar se data_fim existe para usar na query
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'receptora_fazenda_historico' AND column_name = 'data_fim') THEN
        -- Usar verificação com data_fim
        INSERT INTO receptora_fazenda_historico (receptora_id, fazenda_id, data_inicio, data_fim)
        SELECT 
            r.id,
            r.fazenda_atual_id,
            COALESCE(r.created_at::DATE, CURRENT_DATE),
            NULL -- vínculo ativo
        FROM receptoras r
        WHERE r.fazenda_atual_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM receptora_fazenda_historico rfh 
              WHERE rfh.receptora_id = r.id 
              AND rfh.data_fim IS NULL
          );
    ELSE
        -- Sem coluna data_fim, inserir sem verificação de conflito
        INSERT INTO receptora_fazenda_historico (receptora_id, fazenda_id, data_inicio)
        SELECT 
            r.id,
            r.fazenda_atual_id,
            COALESCE(r.created_at::DATE, CURRENT_DATE)
        FROM receptoras r
        WHERE r.fazenda_atual_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM receptora_fazenda_historico rfh 
              WHERE rfh.receptora_id = r.id
          );
    END IF;
    
    GET DIAGNOSTICS rec_count = ROW_COUNT;
    RAISE NOTICE 'Migrados % registros de fazenda_atual_id para receptora_fazenda_historico', rec_count;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Erro ao migrar dados: %. Pulando migração de dados.', SQLERRM;
END $$;

-- ============================================================
-- PARTE D: Desacoplar Fazenda de protocolo_receptoras
-- ============================================================

-- 7. Renomear fazenda_atual_id para evento_fazenda_id em protocolo_receptoras
--    (opcional: mantém histórico de "onde estava" no momento do evento)
--    Se a coluna existir, renomear; senão, criar como NULL
DO $$
BEGIN
    -- Verificar se fazenda_atual_id existe
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'protocolo_receptoras' 
        AND column_name = 'fazenda_atual_id'
    ) THEN
        -- Renomear coluna (mantém dados existentes)
        ALTER TABLE protocolo_receptoras 
        RENAME COLUMN fazenda_atual_id TO evento_fazenda_id;
        
        -- Adicionar comentário explicativo
        COMMENT ON COLUMN protocolo_receptoras.evento_fazenda_id IS 'Fazenda onde a receptora estava no momento da inclusão no protocolo (apenas para auditoria). Não usado para lógica do ciclo. Pode ser NULL.';
    ELSE
        -- Criar coluna nova se não existir
        ALTER TABLE protocolo_receptoras 
        ADD COLUMN IF NOT EXISTS evento_fazenda_id UUID NULL REFERENCES fazendas(id);
        
        COMMENT ON COLUMN protocolo_receptoras.evento_fazenda_id IS 'Fazenda onde a receptora estava no momento da inclusão no protocolo (apenas para auditoria). Não usado para lógica do ciclo. Pode ser NULL.';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Erro ao renomear/criar evento_fazenda_id: %', SQLERRM;
END $$;

-- ============================================================
-- PARTE E: Desacoplar Fazenda de transferencias_embrioes
-- ============================================================

-- 8. Renomear fazenda_id para evento_fazenda_id em transferencias_embrioes
--    (opcional: mantém histórico de "onde estava" no momento da TE)
DO $$
BEGIN
    -- Verificar se fazenda_id existe
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transferencias_embrioes' 
        AND column_name = 'fazenda_id'
    ) THEN
        -- Renomear coluna (mantém dados existentes)
        ALTER TABLE transferencias_embrioes 
        RENAME COLUMN fazenda_id TO evento_fazenda_id;
        
        -- Adicionar comentário explicativo
        COMMENT ON COLUMN transferencias_embrioes.evento_fazenda_id IS 'Fazenda onde ocorreu a transferência (apenas para auditoria). Não usado para lógica do ciclo. Pode ser NULL.';
    ELSE
        -- Criar coluna nova se não existir
        ALTER TABLE transferencias_embrioes 
        ADD COLUMN IF NOT EXISTS evento_fazenda_id UUID NULL REFERENCES fazendas(id);
        
        COMMENT ON COLUMN transferencias_embrioes.evento_fazenda_id IS 'Fazenda onde ocorreu a transferência (apenas para auditoria). Não usado para lógica do ciclo. Pode ser NULL.';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Erro ao renomear/criar evento_fazenda_id em transferencias_embrioes: %', SQLERRM;
END $$;

-- ============================================================
-- PARTE F: Função Helper para Mover Receptora (RPC)
-- ============================================================

-- 9. Criar função RPC para mover receptora de fazenda (opcional, mas útil)
CREATE OR REPLACE FUNCTION mover_receptora_fazenda(
    p_receptora_id UUID,
    p_nova_fazenda_id UUID,
    p_data_mudanca DATE DEFAULT CURRENT_DATE,
    p_observacoes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_historico_id UUID;
BEGIN
    -- 1. Fechar vínculo atual (se existir)
    UPDATE receptora_fazenda_historico
    SET data_fim = p_data_mudanca - INTERVAL '1 day', -- fecha no dia anterior
        updated_at = NOW()
    WHERE receptora_id = p_receptora_id
      AND data_fim IS NULL;
    
    -- 2. Abrir novo vínculo
    INSERT INTO receptora_fazenda_historico (receptora_id, fazenda_id, data_inicio, observacoes)
    VALUES (p_receptora_id, p_nova_fazenda_id, p_data_mudanca, p_observacoes)
    RETURNING id INTO v_historico_id;
    
    -- 3. (Opcional) Atualizar receptoras.fazenda_atual_id para manter compatibilidade temporária
    --    Durante transição, pode ser útil manter sincronizado
    UPDATE receptoras
    SET fazenda_atual_id = p_nova_fazenda_id
    WHERE id = p_receptora_id;
    
    RETURN v_historico_id;
END;
$$;

-- Comentário na função
COMMENT ON FUNCTION mover_receptora_fazenda IS 'Move uma receptora para uma nova fazenda. Fecha o vínculo atual e abre um novo. NÃO afeta protocolos, ciclos ou histórico reprodutivo.';

-- ============================================================
-- PARTE G: Nota sobre RPC criar_protocolo_passo1_atomico
-- ============================================================
-- NOTA: Se a RPC criar_protocolo_passo1_atomico existir e usar 
-- p_fazenda_atual_id, ela deve ser atualizada para usar 
-- evento_fazenda_id ao invés de fazenda_atual_id.
-- 
-- A coluna protocolo_receptoras.fazenda_atual_id foi renomeada 
-- para evento_fazenda_id nesta migration.
-- 
-- Exemplo de atualização (se necessário):
-- ALTER FUNCTION criar_protocolo_passo1_atomico(...) 
-- RENAME p_fazenda_atual_id TO p_evento_fazenda_id;
-- E atualizar o corpo da função para usar evento_fazenda_id.
-- ============================================================

COMMIT;

-- ============================================================
-- VERIFICAÇÃO (Execute após aplicar a migration)
-- ============================================================
-- Verificar estrutura da tabela:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'receptora_fazenda_historico'
-- ORDER BY ordinal_position;

-- Verificar índice único parcial:
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename = 'receptora_fazenda_historico'
-- AND indexname = 'idx_receptora_fazenda_ativo';

-- Testar view:
-- SELECT * FROM vw_receptoras_fazenda_atual LIMIT 10;

-- Verificar colunas renomeadas:
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'protocolo_receptoras' 
-- AND column_name LIKE '%fazenda%';

-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'transferencias_embrioes' 
-- AND column_name LIKE '%fazenda%';
