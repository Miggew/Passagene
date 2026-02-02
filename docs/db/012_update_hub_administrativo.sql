-- Atualizar rotas do hub administrativo para usar a nova rota unificada
-- Data: 2026-02-01

UPDATE hubs
SET routes = '{"/administrativo"}'
WHERE code = 'administrativo';

-- Comentário:
-- A rota /administrativo agora consolida:
-- - /clientes (aba Clientes)
-- - /fazendas (aba Fazendas - listagem, mas /fazendas/:id mantém FazendaDetail)
-- - /usuarios (aba Usuários - apenas para admins)
-- - Nova aba "Visão Geral" com KPIs

-- Se o hub não existir com code='administrativo', criar:
-- INSERT INTO hubs (code, name, description, routes, display_order)
-- VALUES (
--   'administrativo',
--   'Administrativo',
--   'Gestão de clientes, fazendas e usuários',
--   ARRAY['/administrativo'],
--   1
-- )
-- ON CONFLICT (code) DO UPDATE SET routes = ARRAY['/administrativo'];
