-- ============================================================
-- ROLLBACK das Políticas RLS - PassaGene
-- USE SOMENTE SE HOUVER PROBLEMAS!
-- Este script remove todas as políticas e desabilita RLS
-- ============================================================

-- ATENÇÃO: Este script remove toda a segurança RLS.
-- Só execute se realmente necessário!

-- ============================================================
-- PARTE 1: REMOVER POLÍTICAS
-- ============================================================

-- Clientes
DROP POLICY IF EXISTS "clientes_select_policy" ON clientes;
DROP POLICY IF EXISTS "clientes_insert_policy" ON clientes;
DROP POLICY IF EXISTS "clientes_update_policy" ON clientes;
DROP POLICY IF EXISTS "clientes_delete_policy" ON clientes;

-- Fazendas
DROP POLICY IF EXISTS "fazendas_select_policy" ON fazendas;
DROP POLICY IF EXISTS "fazendas_insert_policy" ON fazendas;
DROP POLICY IF EXISTS "fazendas_update_policy" ON fazendas;
DROP POLICY IF EXISTS "fazendas_delete_policy" ON fazendas;

-- Doses de Sêmen
DROP POLICY IF EXISTS "doses_semen_select_policy" ON doses_semen;
DROP POLICY IF EXISTS "doses_semen_insert_policy" ON doses_semen;
DROP POLICY IF EXISTS "doses_semen_update_policy" ON doses_semen;
DROP POLICY IF EXISTS "doses_semen_delete_policy" ON doses_semen;

-- Embriões Congelados
DROP POLICY IF EXISTS "embrioes_congelados_select_policy" ON embrioes_congelados;
DROP POLICY IF EXISTS "embrioes_congelados_insert_policy" ON embrioes_congelados;
DROP POLICY IF EXISTS "embrioes_congelados_update_policy" ON embrioes_congelados;
DROP POLICY IF EXISTS "embrioes_congelados_delete_policy" ON embrioes_congelados;

-- Doadoras
DROP POLICY IF EXISTS "doadoras_select_policy" ON doadoras;
DROP POLICY IF EXISTS "doadoras_insert_policy" ON doadoras;
DROP POLICY IF EXISTS "doadoras_update_policy" ON doadoras;
DROP POLICY IF EXISTS "doadoras_delete_policy" ON doadoras;

-- Receptoras
DROP POLICY IF EXISTS "receptoras_select_policy" ON receptoras;
DROP POLICY IF EXISTS "receptoras_insert_policy" ON receptoras;
DROP POLICY IF EXISTS "receptoras_update_policy" ON receptoras;
DROP POLICY IF EXISTS "receptoras_delete_policy" ON receptoras;

-- Protocolos
DROP POLICY IF EXISTS "protocolos_sincronizacao_select_policy" ON protocolos_sincronizacao;
DROP POLICY IF EXISTS "protocolos_sincronizacao_insert_policy" ON protocolos_sincronizacao;
DROP POLICY IF EXISTS "protocolos_sincronizacao_update_policy" ON protocolos_sincronizacao;
DROP POLICY IF EXISTS "protocolos_sincronizacao_delete_policy" ON protocolos_sincronizacao;

-- Pacotes de Aspiração
DROP POLICY IF EXISTS "pacote_aspiracoes_select_policy" ON pacote_aspiracoes;
DROP POLICY IF EXISTS "pacote_aspiracoes_insert_policy" ON pacote_aspiracoes;
DROP POLICY IF EXISTS "pacote_aspiracoes_update_policy" ON pacote_aspiracoes;
DROP POLICY IF EXISTS "pacote_aspiracoes_delete_policy" ON pacote_aspiracoes;

-- Sessões TE
DROP POLICY IF EXISTS "sessoes_te_select_policy" ON sessoes_te;
DROP POLICY IF EXISTS "sessoes_te_insert_policy" ON sessoes_te;
DROP POLICY IF EXISTS "sessoes_te_update_policy" ON sessoes_te;
DROP POLICY IF EXISTS "sessoes_te_delete_policy" ON sessoes_te;

-- Sessões DG
DROP POLICY IF EXISTS "sessoes_dg_select_policy" ON sessoes_dg;
DROP POLICY IF EXISTS "sessoes_dg_insert_policy" ON sessoes_dg;
DROP POLICY IF EXISTS "sessoes_dg_update_policy" ON sessoes_dg;
DROP POLICY IF EXISTS "sessoes_dg_delete_policy" ON sessoes_dg;

-- Sessões Sexagem
DROP POLICY IF EXISTS "sessoes_sexagem_select_policy" ON sessoes_sexagem;
DROP POLICY IF EXISTS "sessoes_sexagem_insert_policy" ON sessoes_sexagem;
DROP POLICY IF EXISTS "sessoes_sexagem_update_policy" ON sessoes_sexagem;
DROP POLICY IF EXISTS "sessoes_sexagem_delete_policy" ON sessoes_sexagem;

-- Protocolo Receptoras
DROP POLICY IF EXISTS "protocolo_receptoras_select_policy" ON protocolo_receptoras;
DROP POLICY IF EXISTS "protocolo_receptoras_insert_policy" ON protocolo_receptoras;
DROP POLICY IF EXISTS "protocolo_receptoras_update_policy" ON protocolo_receptoras;
DROP POLICY IF EXISTS "protocolo_receptoras_delete_policy" ON protocolo_receptoras;

-- Aspirações Doadoras
DROP POLICY IF EXISTS "aspiracoes_doadoras_select_policy" ON aspiracoes_doadoras;
DROP POLICY IF EXISTS "aspiracoes_doadoras_insert_policy" ON aspiracoes_doadoras;
DROP POLICY IF EXISTS "aspiracoes_doadoras_update_policy" ON aspiracoes_doadoras;
DROP POLICY IF EXISTS "aspiracoes_doadoras_delete_policy" ON aspiracoes_doadoras;

-- Lotes FIV
DROP POLICY IF EXISTS "lotes_fiv_select_policy" ON lotes_fiv;
DROP POLICY IF EXISTS "lotes_fiv_insert_policy" ON lotes_fiv;
DROP POLICY IF EXISTS "lotes_fiv_update_policy" ON lotes_fiv;
DROP POLICY IF EXISTS "lotes_fiv_delete_policy" ON lotes_fiv;

-- Embriões
DROP POLICY IF EXISTS "embrioes_select_policy" ON embrioes;
DROP POLICY IF EXISTS "embrioes_insert_policy" ON embrioes;
DROP POLICY IF EXISTS "embrioes_update_policy" ON embrioes;
DROP POLICY IF EXISTS "embrioes_delete_policy" ON embrioes;

-- Transferências
DROP POLICY IF EXISTS "transferencias_embriao_select_policy" ON transferencias_embriao;
DROP POLICY IF EXISTS "transferencias_embriao_insert_policy" ON transferencias_embriao;
DROP POLICY IF EXISTS "transferencias_embriao_update_policy" ON transferencias_embriao;
DROP POLICY IF EXISTS "transferencias_embriao_delete_policy" ON transferencias_embriao;

-- Diagnósticos
DROP POLICY IF EXISTS "diagnosticos_gestacao_select_policy" ON diagnosticos_gestacao;
DROP POLICY IF EXISTS "diagnosticos_gestacao_insert_policy" ON diagnosticos_gestacao;
DROP POLICY IF EXISTS "diagnosticos_gestacao_update_policy" ON diagnosticos_gestacao;
DROP POLICY IF EXISTS "diagnosticos_gestacao_delete_policy" ON diagnosticos_gestacao;

-- Sexagens
DROP POLICY IF EXISTS "sexagens_select_policy" ON sexagens;
DROP POLICY IF EXISTS "sexagens_insert_policy" ON sexagens;
DROP POLICY IF EXISTS "sexagens_update_policy" ON sexagens;
DROP POLICY IF EXISTS "sexagens_delete_policy" ON sexagens;

-- Touros
DROP POLICY IF EXISTS "touros_select_policy" ON touros;
DROP POLICY IF EXISTS "touros_insert_policy" ON touros;
DROP POLICY IF EXISTS "touros_update_policy" ON touros;
DROP POLICY IF EXISTS "touros_delete_policy" ON touros;

-- User Profiles
DROP POLICY IF EXISTS "user_profiles_select_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_self_policy" ON user_profiles;

-- Hubs
DROP POLICY IF EXISTS "hubs_select_policy" ON hubs;
DROP POLICY IF EXISTS "hubs_modify_policy" ON hubs;

-- User Hub Permissions
DROP POLICY IF EXISTS "user_hub_permissions_select_policy" ON user_hub_permissions;
DROP POLICY IF EXISTS "user_hub_permissions_modify_policy" ON user_hub_permissions;

-- ============================================================
-- PARTE 2: DESABILITAR RLS
-- ============================================================

ALTER TABLE clientes DISABLE ROW LEVEL SECURITY;
ALTER TABLE fazendas DISABLE ROW LEVEL SECURITY;
ALTER TABLE doses_semen DISABLE ROW LEVEL SECURITY;
ALTER TABLE embrioes_congelados DISABLE ROW LEVEL SECURITY;
ALTER TABLE doadoras DISABLE ROW LEVEL SECURITY;
ALTER TABLE receptoras DISABLE ROW LEVEL SECURITY;
ALTER TABLE protocolos_sincronizacao DISABLE ROW LEVEL SECURITY;
ALTER TABLE pacote_aspiracoes DISABLE ROW LEVEL SECURITY;
ALTER TABLE sessoes_te DISABLE ROW LEVEL SECURITY;
ALTER TABLE sessoes_dg DISABLE ROW LEVEL SECURITY;
ALTER TABLE sessoes_sexagem DISABLE ROW LEVEL SECURITY;
ALTER TABLE protocolo_receptoras DISABLE ROW LEVEL SECURITY;
ALTER TABLE aspiracoes_doadoras DISABLE ROW LEVEL SECURITY;
ALTER TABLE lotes_fiv DISABLE ROW LEVEL SECURITY;
ALTER TABLE embrioes DISABLE ROW LEVEL SECURITY;
ALTER TABLE transferencias_embriao DISABLE ROW LEVEL SECURITY;
ALTER TABLE diagnosticos_gestacao DISABLE ROW LEVEL SECURITY;
ALTER TABLE sexagens DISABLE ROW LEVEL SECURITY;
ALTER TABLE touros DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE hubs DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_hub_permissions DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- PARTE 3: REMOVER FUNÇÕES AUXILIARES (OPCIONAL)
-- ============================================================

-- DROP FUNCTION IF EXISTS get_user_cliente_id();
-- DROP FUNCTION IF EXISTS is_admin_or_operacional();
-- DROP FUNCTION IF EXISTS is_cliente();

-- ============================================================
-- VERIFICAÇÃO
-- ============================================================

-- Verificar que RLS foi desabilitado
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
