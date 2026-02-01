-- ============================================================
-- Script para adicionar o Hub Relatórios ao banco de dados
-- Execute este script no SQL Editor do Supabase
-- ============================================================

-- 1. Inserir o novo hub na tabela hubs
INSERT INTO hubs (code, name, description, routes, display_order)
VALUES (
  'relatorios',
  'Relatórios',
  'Central de consultas e relatórios',
  ARRAY['/relatorios', '/relatorios/servicos', '/relatorios/animais', '/relatorios/material', '/relatorios/producao'],
  5
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  routes = EXCLUDED.routes,
  display_order = EXCLUDED.display_order;

-- 2. Dar permissão de acesso ao Hub Relatórios para usuários admin
-- (Admins já têm acesso a tudo automaticamente, mas isso garante consistência)

-- 3. Para dar acesso a um usuário operacional específico, use:
-- INSERT INTO user_hub_permissions (user_id, hub_code, can_access)
-- VALUES ('USER_ID_AQUI', 'relatorios', true);

-- ============================================================
-- VERIFICAÇÃO
-- ============================================================
-- Execute esta query para verificar se o hub foi criado:
-- SELECT * FROM hubs WHERE code = 'relatorios';
