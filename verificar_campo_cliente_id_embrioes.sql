-- Script para verificar se o campo cliente_id foi adicionado corretamente na tabela embrioes

-- ============================================================
-- PASSO 1: Verificar se a coluna existe
-- ============================================================

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'embrioes'
  AND column_name = 'cliente_id';

-- ============================================================
-- PASSO 2: Verificar se o índice foi criado
-- ============================================================

SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'embrioes'
  AND indexname = 'idx_embrioes_cliente_id';

-- ============================================================
-- PASSO 3: Verificar a foreign key constraint
-- ============================================================

SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'embrioes'
  AND kcu.column_name = 'cliente_id';

-- ============================================================
-- PASSO 4: Verificar embriões congelados sem cliente
-- ============================================================

SELECT 
    COUNT(*) as total_embrioes_congelados_sem_cliente
FROM embrioes
WHERE status_atual = 'CONGELADO'
  AND cliente_id IS NULL;

-- ============================================================
-- PASSO 5: Verificar embriões con cliente atribuído
-- ============================================================

SELECT 
    e.id,
    e.identificacao,
    e.status_atual,
    e.cliente_id,
    c.nome as cliente_nome,
    e.data_congelamento
FROM embrioes e
LEFT JOIN clientes c ON c.id = e.cliente_id
WHERE e.cliente_id IS NOT NULL
ORDER BY e.data_congelamento DESC
LIMIT 10;

-- ============================================================
-- RESULTADO ESPERADO
-- ============================================================
-- 
-- PASSO 1: Deve retornar uma linha com:
--   - column_name: cliente_id
--   - data_type: uuid
--   - is_nullable: YES
--   - column_default: NULL
--
-- PASSO 2: Deve retornar uma linha com o índice criado
--
-- PASSO 3: Deve retornar uma linha com a foreign key para clientes(id)
--
-- PASSO 4: Mostra quantos embriões congelados ainda não têm cliente atribuído
--
-- PASSO 5: Mostra os embriões que já foram direcionados para clientes
