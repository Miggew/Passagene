-- Tabela de vinculo entre usuarios operacionais e clientes
-- Data: 2026-02-01
-- Permite que operacionais tenham acesso a multiplos clientes

CREATE TABLE IF NOT EXISTS user_clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, cliente_id)
);

-- Index para queries
CREATE INDEX IF NOT EXISTS idx_user_clientes_user ON user_clientes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_clientes_cliente ON user_clientes(cliente_id);

-- Comentario:
-- Esta tabela permite vincular usuarios do tipo 'operacional' a clientes especificos.
-- Um operacional pode ter acesso a multiplos clientes.
-- Um cliente pode ter multiplos operacionais vinculados.
--
-- O acesso funciona assim:
-- - Admin: acesso a tudo (sem necessidade de vinculos)
-- - Cliente: acesso via user_profiles.cliente_id (1:1)
-- - Operacional: acesso via user_clientes (N:N)
--
-- As fazendas, receptoras, embrioes, doses, etc. sao acessados
-- atraves do cliente_id das fazendas.
