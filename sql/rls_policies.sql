-- ============================================================
-- Row Level Security (RLS) - PassaGene
-- Execute este script no SQL Editor do Supabase
-- ============================================================
--
-- IMPORTANTE: Execute este script APÓS criar o hub de relatórios
--
-- Este script implementa controle de acesso por cliente:
-- - Admin/Operacional: veem todos os dados
-- - Cliente: vê apenas dados vinculados ao seu cliente_id
--
-- ============================================================

-- ============================================================
-- PARTE 1: FUNÇÃO AUXILIAR
-- ============================================================

-- Função para obter o cliente_id do usuário logado
CREATE OR REPLACE FUNCTION get_user_cliente_id()
RETURNS uuid AS $$
  SELECT cliente_id FROM user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Função para verificar se o usuário é admin ou operacional
CREATE OR REPLACE FUNCTION is_admin_or_operacional()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND user_type IN ('admin', 'operacional')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Função para verificar se o usuário é cliente
CREATE OR REPLACE FUNCTION is_cliente()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND user_type = 'cliente'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Função para obter a fazenda atual de uma receptora (via histórico de movimentações)
-- Retorna a fazenda_id mais recente do histórico
CREATE OR REPLACE FUNCTION get_receptora_fazenda_atual(p_receptora_id uuid)
RETURNS uuid AS $$
  SELECT fazenda_id
  FROM receptora_fazenda_historico
  WHERE receptora_id = p_receptora_id
  ORDER BY data_inicio DESC
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Função para verificar se uma receptora pertence a um cliente
-- Verifica se a fazenda atual da receptora pertence ao cliente logado
CREATE OR REPLACE FUNCTION receptora_belongs_to_cliente(p_receptora_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM receptora_fazenda_historico rfh
    JOIN fazendas f ON rfh.fazenda_id = f.id
    WHERE rfh.receptora_id = p_receptora_id
    AND f.cliente_id = get_user_cliente_id()
    AND rfh.data_inicio = (
      SELECT MAX(data_inicio)
      FROM receptora_fazenda_historico
      WHERE receptora_id = p_receptora_id
    )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- PARTE 2: HABILITAR RLS NAS TABELAS
-- ============================================================

-- Tabelas com acesso direto por cliente_id
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fazendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE doses_semen ENABLE ROW LEVEL SECURITY;

-- Tabelas vinculadas via fazenda_id
ALTER TABLE doadoras ENABLE ROW LEVEL SECURITY;
ALTER TABLE receptoras ENABLE ROW LEVEL SECURITY;
ALTER TABLE protocolos_sincronizacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE pacotes_aspiracao ENABLE ROW LEVEL SECURITY;
ALTER TABLE transferencias_sessoes ENABLE ROW LEVEL SECURITY;

-- Tabelas vinculadas indiretamente
ALTER TABLE protocolo_receptoras ENABLE ROW LEVEL SECURITY;
ALTER TABLE aspiracoes_doadoras ENABLE ROW LEVEL SECURITY;
ALTER TABLE lotes_fiv ENABLE ROW LEVEL SECURITY;
ALTER TABLE embrioes ENABLE ROW LEVEL SECURITY;
ALTER TABLE transferencias_embrioes ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnosticos_gestacao ENABLE ROW LEVEL SECURITY;

-- Tabelas auxiliares
ALTER TABLE receptoras_cio_livre ENABLE ROW LEVEL SECURITY;
ALTER TABLE receptora_fazenda_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE pacotes_aspiracao_fazendas_destino ENABLE ROW LEVEL SECURITY;
ALTER TABLE lote_fiv_acasalamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE lote_fiv_fazendas_destino ENABLE ROW LEVEL SECURITY;

-- Tabelas públicas (catálogo)
ALTER TABLE touros ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PARTE 3: POLÍTICAS PARA TABELAS COM cliente_id DIRETO
-- ============================================================

-- CLIENTES
-- Admin/Operacional veem todos, Cliente vê apenas o próprio
DROP POLICY IF EXISTS "clientes_select_policy" ON clientes;
CREATE POLICY "clientes_select_policy" ON clientes
  FOR SELECT USING (
    is_admin_or_operacional()
    OR id = get_user_cliente_id()
  );

DROP POLICY IF EXISTS "clientes_insert_policy" ON clientes;
CREATE POLICY "clientes_insert_policy" ON clientes
  FOR INSERT WITH CHECK (is_admin_or_operacional());

DROP POLICY IF EXISTS "clientes_update_policy" ON clientes;
CREATE POLICY "clientes_update_policy" ON clientes
  FOR UPDATE USING (is_admin_or_operacional());

DROP POLICY IF EXISTS "clientes_delete_policy" ON clientes;
CREATE POLICY "clientes_delete_policy" ON clientes
  FOR DELETE USING (is_admin_or_operacional());

-- FAZENDAS
DROP POLICY IF EXISTS "fazendas_select_policy" ON fazendas;
CREATE POLICY "fazendas_select_policy" ON fazendas
  FOR SELECT USING (
    is_admin_or_operacional()
    OR cliente_id = get_user_cliente_id()
  );

DROP POLICY IF EXISTS "fazendas_insert_policy" ON fazendas;
CREATE POLICY "fazendas_insert_policy" ON fazendas
  FOR INSERT WITH CHECK (is_admin_or_operacional());

DROP POLICY IF EXISTS "fazendas_update_policy" ON fazendas;
CREATE POLICY "fazendas_update_policy" ON fazendas
  FOR UPDATE USING (is_admin_or_operacional());

DROP POLICY IF EXISTS "fazendas_delete_policy" ON fazendas;
CREATE POLICY "fazendas_delete_policy" ON fazendas
  FOR DELETE USING (is_admin_or_operacional());

-- DOSES DE SÊMEN
DROP POLICY IF EXISTS "doses_semen_select_policy" ON doses_semen;
CREATE POLICY "doses_semen_select_policy" ON doses_semen
  FOR SELECT USING (
    is_admin_or_operacional()
    OR cliente_id = get_user_cliente_id()
  );

DROP POLICY IF EXISTS "doses_semen_insert_policy" ON doses_semen;
CREATE POLICY "doses_semen_insert_policy" ON doses_semen
  FOR INSERT WITH CHECK (is_admin_or_operacional());

DROP POLICY IF EXISTS "doses_semen_update_policy" ON doses_semen;
CREATE POLICY "doses_semen_update_policy" ON doses_semen
  FOR UPDATE USING (is_admin_or_operacional());

DROP POLICY IF EXISTS "doses_semen_delete_policy" ON doses_semen;
CREATE POLICY "doses_semen_delete_policy" ON doses_semen
  FOR DELETE USING (is_admin_or_operacional());

-- ============================================================
-- PARTE 4: POLÍTICAS PARA TABELAS VINCULADAS VIA fazenda_id
-- ============================================================

-- DOADORAS (vinculadas via fazenda_id)
DROP POLICY IF EXISTS "doadoras_select_policy" ON doadoras;
CREATE POLICY "doadoras_select_policy" ON doadoras
  FOR SELECT USING (
    is_admin_or_operacional()
    OR fazenda_id IN (
      SELECT id FROM fazendas WHERE cliente_id = get_user_cliente_id()
    )
  );

DROP POLICY IF EXISTS "doadoras_insert_policy" ON doadoras;
CREATE POLICY "doadoras_insert_policy" ON doadoras
  FOR INSERT WITH CHECK (is_admin_or_operacional());

DROP POLICY IF EXISTS "doadoras_update_policy" ON doadoras;
CREATE POLICY "doadoras_update_policy" ON doadoras
  FOR UPDATE USING (is_admin_or_operacional());

DROP POLICY IF EXISTS "doadoras_delete_policy" ON doadoras;
CREATE POLICY "doadoras_delete_policy" ON doadoras
  FOR DELETE USING (is_admin_or_operacional());

-- RECEPTORAS (vinculadas via tabela de histórico receptora_fazenda_historico)
DROP POLICY IF EXISTS "receptoras_select_policy" ON receptoras;
CREATE POLICY "receptoras_select_policy" ON receptoras
  FOR SELECT USING (
    is_admin_or_operacional()
    OR receptora_belongs_to_cliente(id)
  );

DROP POLICY IF EXISTS "receptoras_insert_policy" ON receptoras;
CREATE POLICY "receptoras_insert_policy" ON receptoras
  FOR INSERT WITH CHECK (is_admin_or_operacional());

DROP POLICY IF EXISTS "receptoras_update_policy" ON receptoras;
CREATE POLICY "receptoras_update_policy" ON receptoras
  FOR UPDATE USING (is_admin_or_operacional());

DROP POLICY IF EXISTS "receptoras_delete_policy" ON receptoras;
CREATE POLICY "receptoras_delete_policy" ON receptoras
  FOR DELETE USING (is_admin_or_operacional());

-- PROTOCOLOS DE SINCRONIZAÇÃO
DROP POLICY IF EXISTS "protocolos_sincronizacao_select_policy" ON protocolos_sincronizacao;
CREATE POLICY "protocolos_sincronizacao_select_policy" ON protocolos_sincronizacao
  FOR SELECT USING (
    is_admin_or_operacional()
    OR fazenda_id IN (
      SELECT id FROM fazendas WHERE cliente_id = get_user_cliente_id()
    )
  );

DROP POLICY IF EXISTS "protocolos_sincronizacao_insert_policy" ON protocolos_sincronizacao;
CREATE POLICY "protocolos_sincronizacao_insert_policy" ON protocolos_sincronizacao
  FOR INSERT WITH CHECK (is_admin_or_operacional());

DROP POLICY IF EXISTS "protocolos_sincronizacao_update_policy" ON protocolos_sincronizacao;
CREATE POLICY "protocolos_sincronizacao_update_policy" ON protocolos_sincronizacao
  FOR UPDATE USING (is_admin_or_operacional());

DROP POLICY IF EXISTS "protocolos_sincronizacao_delete_policy" ON protocolos_sincronizacao;
CREATE POLICY "protocolos_sincronizacao_delete_policy" ON protocolos_sincronizacao
  FOR DELETE USING (is_admin_or_operacional());

-- PACOTES DE ASPIRAÇÃO
DROP POLICY IF EXISTS "pacotes_aspiracao_select_policy" ON pacotes_aspiracao;
CREATE POLICY "pacotes_aspiracao_select_policy" ON pacotes_aspiracao
  FOR SELECT USING (
    is_admin_or_operacional()
    OR fazenda_id IN (
      SELECT id FROM fazendas WHERE cliente_id = get_user_cliente_id()
    )
  );

DROP POLICY IF EXISTS "pacotes_aspiracao_insert_policy" ON pacotes_aspiracao;
CREATE POLICY "pacotes_aspiracao_insert_policy" ON pacotes_aspiracao
  FOR INSERT WITH CHECK (is_admin_or_operacional());

DROP POLICY IF EXISTS "pacotes_aspiracao_update_policy" ON pacotes_aspiracao;
CREATE POLICY "pacotes_aspiracao_update_policy" ON pacotes_aspiracao
  FOR UPDATE USING (is_admin_or_operacional());

DROP POLICY IF EXISTS "pacotes_aspiracao_delete_policy" ON pacotes_aspiracao;
CREATE POLICY "pacotes_aspiracao_delete_policy" ON pacotes_aspiracao
  FOR DELETE USING (is_admin_or_operacional());

-- TRANSFERÊNCIAS SESSÕES (TE)
DROP POLICY IF EXISTS "transferencias_sessoes_select_policy" ON transferencias_sessoes;
CREATE POLICY "transferencias_sessoes_select_policy" ON transferencias_sessoes
  FOR SELECT USING (
    is_admin_or_operacional()
    OR fazenda_id IN (
      SELECT id FROM fazendas WHERE cliente_id = get_user_cliente_id()
    )
  );

DROP POLICY IF EXISTS "transferencias_sessoes_insert_policy" ON transferencias_sessoes;
CREATE POLICY "transferencias_sessoes_insert_policy" ON transferencias_sessoes
  FOR INSERT WITH CHECK (is_admin_or_operacional());

DROP POLICY IF EXISTS "transferencias_sessoes_update_policy" ON transferencias_sessoes;
CREATE POLICY "transferencias_sessoes_update_policy" ON transferencias_sessoes
  FOR UPDATE USING (is_admin_or_operacional());

DROP POLICY IF EXISTS "transferencias_sessoes_delete_policy" ON transferencias_sessoes;
CREATE POLICY "transferencias_sessoes_delete_policy" ON transferencias_sessoes
  FOR DELETE USING (is_admin_or_operacional());

-- ============================================================
-- PARTE 5: POLÍTICAS PARA TABELAS VINCULADAS INDIRETAMENTE
-- ============================================================

-- PROTOCOLO_RECEPTORAS (via protocolo_id → protocolos_sincronizacao)
DROP POLICY IF EXISTS "protocolo_receptoras_select_policy" ON protocolo_receptoras;
CREATE POLICY "protocolo_receptoras_select_policy" ON protocolo_receptoras
  FOR SELECT USING (
    is_admin_or_operacional()
    OR protocolo_id IN (
      SELECT ps.id FROM protocolos_sincronizacao ps
      JOIN fazendas f ON ps.fazenda_id = f.id
      WHERE f.cliente_id = get_user_cliente_id()
    )
  );

DROP POLICY IF EXISTS "protocolo_receptoras_insert_policy" ON protocolo_receptoras;
CREATE POLICY "protocolo_receptoras_insert_policy" ON protocolo_receptoras
  FOR INSERT WITH CHECK (is_admin_or_operacional());

DROP POLICY IF EXISTS "protocolo_receptoras_update_policy" ON protocolo_receptoras;
CREATE POLICY "protocolo_receptoras_update_policy" ON protocolo_receptoras
  FOR UPDATE USING (is_admin_or_operacional());

DROP POLICY IF EXISTS "protocolo_receptoras_delete_policy" ON protocolo_receptoras;
CREATE POLICY "protocolo_receptoras_delete_policy" ON protocolo_receptoras
  FOR DELETE USING (is_admin_or_operacional());

-- ASPIRAÇÕES_DOADORAS (via pacote_aspiracao_id → pacotes_aspiracao)
DROP POLICY IF EXISTS "aspiracoes_doadoras_select_policy" ON aspiracoes_doadoras;
CREATE POLICY "aspiracoes_doadoras_select_policy" ON aspiracoes_doadoras
  FOR SELECT USING (
    is_admin_or_operacional()
    OR pacote_aspiracao_id IN (
      SELECT pa.id FROM pacotes_aspiracao pa
      JOIN fazendas f ON pa.fazenda_id = f.id
      WHERE f.cliente_id = get_user_cliente_id()
    )
  );

DROP POLICY IF EXISTS "aspiracoes_doadoras_insert_policy" ON aspiracoes_doadoras;
CREATE POLICY "aspiracoes_doadoras_insert_policy" ON aspiracoes_doadoras
  FOR INSERT WITH CHECK (is_admin_or_operacional());

DROP POLICY IF EXISTS "aspiracoes_doadoras_update_policy" ON aspiracoes_doadoras;
CREATE POLICY "aspiracoes_doadoras_update_policy" ON aspiracoes_doadoras
  FOR UPDATE USING (is_admin_or_operacional());

DROP POLICY IF EXISTS "aspiracoes_doadoras_delete_policy" ON aspiracoes_doadoras;
CREATE POLICY "aspiracoes_doadoras_delete_policy" ON aspiracoes_doadoras
  FOR DELETE USING (is_admin_or_operacional());

-- LOTES_FIV (via pacote_aspiracao_id → pacotes_aspiracao)
DROP POLICY IF EXISTS "lotes_fiv_select_policy" ON lotes_fiv;
CREATE POLICY "lotes_fiv_select_policy" ON lotes_fiv
  FOR SELECT USING (
    is_admin_or_operacional()
    OR pacote_aspiracao_id IN (
      SELECT pa.id FROM pacotes_aspiracao pa
      JOIN fazendas f ON pa.fazenda_id = f.id
      WHERE f.cliente_id = get_user_cliente_id()
    )
  );

DROP POLICY IF EXISTS "lotes_fiv_insert_policy" ON lotes_fiv;
CREATE POLICY "lotes_fiv_insert_policy" ON lotes_fiv
  FOR INSERT WITH CHECK (is_admin_or_operacional());

DROP POLICY IF EXISTS "lotes_fiv_update_policy" ON lotes_fiv;
CREATE POLICY "lotes_fiv_update_policy" ON lotes_fiv
  FOR UPDATE USING (is_admin_or_operacional());

DROP POLICY IF EXISTS "lotes_fiv_delete_policy" ON lotes_fiv;
CREATE POLICY "lotes_fiv_delete_policy" ON lotes_fiv
  FOR DELETE USING (is_admin_or_operacional());

-- EMBRIÕES (via lote_fiv_id → lotes_fiv → pacotes_aspiracao)
DROP POLICY IF EXISTS "embrioes_select_policy" ON embrioes;
CREATE POLICY "embrioes_select_policy" ON embrioes
  FOR SELECT USING (
    is_admin_or_operacional()
    OR lote_fiv_id IN (
      SELECT lf.id FROM lotes_fiv lf
      JOIN pacotes_aspiracao pa ON lf.pacote_aspiracao_id = pa.id
      JOIN fazendas f ON pa.fazenda_id = f.id
      WHERE f.cliente_id = get_user_cliente_id()
    )
  );

DROP POLICY IF EXISTS "embrioes_insert_policy" ON embrioes;
CREATE POLICY "embrioes_insert_policy" ON embrioes
  FOR INSERT WITH CHECK (is_admin_or_operacional());

DROP POLICY IF EXISTS "embrioes_update_policy" ON embrioes;
CREATE POLICY "embrioes_update_policy" ON embrioes
  FOR UPDATE USING (is_admin_or_operacional());

DROP POLICY IF EXISTS "embrioes_delete_policy" ON embrioes;
CREATE POLICY "embrioes_delete_policy" ON embrioes
  FOR DELETE USING (is_admin_or_operacional());

-- TRANSFERÊNCIAS DE EMBRIÃO (via receptora_id)
DROP POLICY IF EXISTS "transferencias_embrioes_select_policy" ON transferencias_embrioes;
CREATE POLICY "transferencias_embrioes_select_policy" ON transferencias_embrioes
  FOR SELECT USING (
    is_admin_or_operacional()
    OR receptora_belongs_to_cliente(receptora_id)
  );

DROP POLICY IF EXISTS "transferencias_embrioes_insert_policy" ON transferencias_embrioes;
CREATE POLICY "transferencias_embrioes_insert_policy" ON transferencias_embrioes
  FOR INSERT WITH CHECK (is_admin_or_operacional());

DROP POLICY IF EXISTS "transferencias_embrioes_update_policy" ON transferencias_embrioes;
CREATE POLICY "transferencias_embrioes_update_policy" ON transferencias_embrioes
  FOR UPDATE USING (is_admin_or_operacional());

DROP POLICY IF EXISTS "transferencias_embrioes_delete_policy" ON transferencias_embrioes;
CREATE POLICY "transferencias_embrioes_delete_policy" ON transferencias_embrioes
  FOR DELETE USING (is_admin_or_operacional());

-- DIAGNÓSTICOS DE GESTAÇÃO (via receptora_id → receptoras)
DROP POLICY IF EXISTS "diagnosticos_gestacao_select_policy" ON diagnosticos_gestacao;
CREATE POLICY "diagnosticos_gestacao_select_policy" ON diagnosticos_gestacao
  FOR SELECT USING (
    is_admin_or_operacional()
    OR receptora_belongs_to_cliente(receptora_id)
  );

DROP POLICY IF EXISTS "diagnosticos_gestacao_insert_policy" ON diagnosticos_gestacao;
CREATE POLICY "diagnosticos_gestacao_insert_policy" ON diagnosticos_gestacao
  FOR INSERT WITH CHECK (is_admin_or_operacional());

DROP POLICY IF EXISTS "diagnosticos_gestacao_update_policy" ON diagnosticos_gestacao;
CREATE POLICY "diagnosticos_gestacao_update_policy" ON diagnosticos_gestacao
  FOR UPDATE USING (is_admin_or_operacional());

DROP POLICY IF EXISTS "diagnosticos_gestacao_delete_policy" ON diagnosticos_gestacao;
CREATE POLICY "diagnosticos_gestacao_delete_policy" ON diagnosticos_gestacao
  FOR DELETE USING (is_admin_or_operacional());

-- ============================================================
-- PARTE 6: TABELAS AUXILIARES
-- ============================================================

-- RECEPTORAS_CIO_LIVRE
DROP POLICY IF EXISTS "receptoras_cio_livre_select_policy" ON receptoras_cio_livre;
CREATE POLICY "receptoras_cio_livre_select_policy" ON receptoras_cio_livre
  FOR SELECT USING (
    is_admin_or_operacional()
    OR receptora_belongs_to_cliente(receptora_id)
  );

DROP POLICY IF EXISTS "receptoras_cio_livre_insert_policy" ON receptoras_cio_livre;
CREATE POLICY "receptoras_cio_livre_insert_policy" ON receptoras_cio_livre
  FOR INSERT WITH CHECK (is_admin_or_operacional());

DROP POLICY IF EXISTS "receptoras_cio_livre_update_policy" ON receptoras_cio_livre;
CREATE POLICY "receptoras_cio_livre_update_policy" ON receptoras_cio_livre
  FOR UPDATE USING (is_admin_or_operacional());

DROP POLICY IF EXISTS "receptoras_cio_livre_delete_policy" ON receptoras_cio_livre;
CREATE POLICY "receptoras_cio_livre_delete_policy" ON receptoras_cio_livre
  FOR DELETE USING (is_admin_or_operacional());

-- RECEPTORA_FAZENDA_HISTORICO
DROP POLICY IF EXISTS "receptora_fazenda_historico_select_policy" ON receptora_fazenda_historico;
CREATE POLICY "receptora_fazenda_historico_select_policy" ON receptora_fazenda_historico
  FOR SELECT USING (
    is_admin_or_operacional()
    OR fazenda_id IN (
      SELECT id FROM fazendas WHERE cliente_id = get_user_cliente_id()
    )
  );

DROP POLICY IF EXISTS "receptora_fazenda_historico_insert_policy" ON receptora_fazenda_historico;
CREATE POLICY "receptora_fazenda_historico_insert_policy" ON receptora_fazenda_historico
  FOR INSERT WITH CHECK (is_admin_or_operacional());

DROP POLICY IF EXISTS "receptora_fazenda_historico_update_policy" ON receptora_fazenda_historico;
CREATE POLICY "receptora_fazenda_historico_update_policy" ON receptora_fazenda_historico
  FOR UPDATE USING (is_admin_or_operacional());

DROP POLICY IF EXISTS "receptora_fazenda_historico_delete_policy" ON receptora_fazenda_historico;
CREATE POLICY "receptora_fazenda_historico_delete_policy" ON receptora_fazenda_historico
  FOR DELETE USING (is_admin_or_operacional());

-- PACOTES_ASPIRACAO_FAZENDAS_DESTINO
DROP POLICY IF EXISTS "pacotes_aspiracao_fazendas_destino_select_policy" ON pacotes_aspiracao_fazendas_destino;
CREATE POLICY "pacotes_aspiracao_fazendas_destino_select_policy" ON pacotes_aspiracao_fazendas_destino
  FOR SELECT USING (
    is_admin_or_operacional()
    OR pacote_aspiracao_id IN (
      SELECT pa.id FROM pacotes_aspiracao pa
      JOIN fazendas f ON pa.fazenda_id = f.id
      WHERE f.cliente_id = get_user_cliente_id()
    )
  );

DROP POLICY IF EXISTS "pacotes_aspiracao_fazendas_destino_insert_policy" ON pacotes_aspiracao_fazendas_destino;
CREATE POLICY "pacotes_aspiracao_fazendas_destino_insert_policy" ON pacotes_aspiracao_fazendas_destino
  FOR INSERT WITH CHECK (is_admin_or_operacional());

DROP POLICY IF EXISTS "pacotes_aspiracao_fazendas_destino_update_policy" ON pacotes_aspiracao_fazendas_destino;
CREATE POLICY "pacotes_aspiracao_fazendas_destino_update_policy" ON pacotes_aspiracao_fazendas_destino
  FOR UPDATE USING (is_admin_or_operacional());

DROP POLICY IF EXISTS "pacotes_aspiracao_fazendas_destino_delete_policy" ON pacotes_aspiracao_fazendas_destino;
CREATE POLICY "pacotes_aspiracao_fazendas_destino_delete_policy" ON pacotes_aspiracao_fazendas_destino
  FOR DELETE USING (is_admin_or_operacional());

-- LOTE_FIV_ACASALAMENTOS
DROP POLICY IF EXISTS "lote_fiv_acasalamentos_select_policy" ON lote_fiv_acasalamentos;
CREATE POLICY "lote_fiv_acasalamentos_select_policy" ON lote_fiv_acasalamentos
  FOR SELECT USING (
    is_admin_or_operacional()
    OR lote_fiv_id IN (
      SELECT lf.id FROM lotes_fiv lf
      JOIN pacotes_aspiracao pa ON lf.pacote_aspiracao_id = pa.id
      JOIN fazendas f ON pa.fazenda_id = f.id
      WHERE f.cliente_id = get_user_cliente_id()
    )
  );

DROP POLICY IF EXISTS "lote_fiv_acasalamentos_insert_policy" ON lote_fiv_acasalamentos;
CREATE POLICY "lote_fiv_acasalamentos_insert_policy" ON lote_fiv_acasalamentos
  FOR INSERT WITH CHECK (is_admin_or_operacional());

DROP POLICY IF EXISTS "lote_fiv_acasalamentos_update_policy" ON lote_fiv_acasalamentos;
CREATE POLICY "lote_fiv_acasalamentos_update_policy" ON lote_fiv_acasalamentos
  FOR UPDATE USING (is_admin_or_operacional());

DROP POLICY IF EXISTS "lote_fiv_acasalamentos_delete_policy" ON lote_fiv_acasalamentos;
CREATE POLICY "lote_fiv_acasalamentos_delete_policy" ON lote_fiv_acasalamentos
  FOR DELETE USING (is_admin_or_operacional());

-- LOTE_FIV_FAZENDAS_DESTINO
DROP POLICY IF EXISTS "lote_fiv_fazendas_destino_select_policy" ON lote_fiv_fazendas_destino;
CREATE POLICY "lote_fiv_fazendas_destino_select_policy" ON lote_fiv_fazendas_destino
  FOR SELECT USING (
    is_admin_or_operacional()
    OR lote_fiv_id IN (
      SELECT lf.id FROM lotes_fiv lf
      JOIN pacotes_aspiracao pa ON lf.pacote_aspiracao_id = pa.id
      JOIN fazendas f ON pa.fazenda_id = f.id
      WHERE f.cliente_id = get_user_cliente_id()
    )
  );

DROP POLICY IF EXISTS "lote_fiv_fazendas_destino_insert_policy" ON lote_fiv_fazendas_destino;
CREATE POLICY "lote_fiv_fazendas_destino_insert_policy" ON lote_fiv_fazendas_destino
  FOR INSERT WITH CHECK (is_admin_or_operacional());

DROP POLICY IF EXISTS "lote_fiv_fazendas_destino_update_policy" ON lote_fiv_fazendas_destino;
CREATE POLICY "lote_fiv_fazendas_destino_update_policy" ON lote_fiv_fazendas_destino
  FOR UPDATE USING (is_admin_or_operacional());

DROP POLICY IF EXISTS "lote_fiv_fazendas_destino_delete_policy" ON lote_fiv_fazendas_destino;
CREATE POLICY "lote_fiv_fazendas_destino_delete_policy" ON lote_fiv_fazendas_destino
  FOR DELETE USING (is_admin_or_operacional());

-- ============================================================
-- PARTE 7: TABELAS PÚBLICAS (CATÁLOGO)
-- ============================================================

-- TOUROS (catálogo público - todos podem ver, só admin pode modificar)
DROP POLICY IF EXISTS "touros_select_policy" ON touros;
CREATE POLICY "touros_select_policy" ON touros
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "touros_insert_policy" ON touros;
CREATE POLICY "touros_insert_policy" ON touros
  FOR INSERT WITH CHECK (is_admin_or_operacional());

DROP POLICY IF EXISTS "touros_update_policy" ON touros;
CREATE POLICY "touros_update_policy" ON touros
  FOR UPDATE USING (is_admin_or_operacional());

DROP POLICY IF EXISTS "touros_delete_policy" ON touros;
CREATE POLICY "touros_delete_policy" ON touros
  FOR DELETE USING (is_admin_or_operacional());

-- ============================================================
-- PARTE 8: TABELAS DE SISTEMA (acesso restrito)
-- ============================================================

-- USER_PROFILES
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_profiles_select_policy" ON user_profiles;
CREATE POLICY "user_profiles_select_policy" ON user_profiles
  FOR SELECT USING (
    is_admin_or_operacional()
    OR id = auth.uid()
  );

DROP POLICY IF EXISTS "user_profiles_update_self_policy" ON user_profiles;
CREATE POLICY "user_profiles_update_self_policy" ON user_profiles
  FOR UPDATE USING (
    is_admin_or_operacional()
    OR id = auth.uid()
  );

-- HUBS (todos podem ver, só admin pode modificar)
ALTER TABLE hubs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hubs_select_policy" ON hubs;
CREATE POLICY "hubs_select_policy" ON hubs
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "hubs_modify_policy" ON hubs;
CREATE POLICY "hubs_modify_policy" ON hubs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- USER_HUB_PERMISSIONS (usuário vê suas próprias, admin vê todas)
ALTER TABLE user_hub_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_hub_permissions_select_policy" ON user_hub_permissions;
CREATE POLICY "user_hub_permissions_select_policy" ON user_hub_permissions
  FOR SELECT USING (
    is_admin_or_operacional()
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "user_hub_permissions_modify_policy" ON user_hub_permissions;
CREATE POLICY "user_hub_permissions_modify_policy" ON user_hub_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- ============================================================
-- VERIFICAÇÃO
-- ============================================================
-- Execute as queries abaixo para verificar se as políticas foram criadas:
--
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;
--
-- ============================================================
