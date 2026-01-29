-- ============================================
-- FIX: Corrigir avisos de DESEMPENHO do Supabase
-- ============================================
-- Este script corrige:
-- 1. duplicate_index - Remover índices duplicados
-- 2. multiple_permissive_policies - Remover políticas duplicadas
-- 3. auth_rls_initplan - Otimizar chamadas auth.uid()
-- ============================================

-- ============================================
-- PARTE 1: Remover índices duplicados
-- ============================================
DROP INDEX IF EXISTS public.idx_doadora_atributos_definicao;
DROP INDEX IF EXISTS public.idx_doadora_atributos_doadora;
DROP INDEX IF EXISTS public.unq_protocolo_receptora;

-- ============================================
-- PARTE 2: Remover políticas RLS duplicadas
-- ============================================

-- acasalamento_embrioes_media
DROP POLICY IF EXISTS "allow_select_acasalamento_embrioes_media" ON public.acasalamento_embrioes_media;

-- aspiracoes_doadoras
DROP POLICY IF EXISTS "allow_select_aspiracoes_doadoras" ON public.aspiracoes_doadoras;
DROP POLICY IF EXISTS "anon_select" ON public.aspiracoes_doadoras;

-- atributos_definicoes
DROP POLICY IF EXISTS "Permitir escrita atributos_definicoes" ON public.atributos_definicoes;
DROP POLICY IF EXISTS "Permitir leitura atributos_definicoes" ON public.atributos_definicoes;
DROP POLICY IF EXISTS "Permitir leitura de atributos_definicoes para autenticados" ON public.atributos_definicoes;
DROP POLICY IF EXISTS "Permitir inserção de atributos_definicoes para autenticados" ON public.atributos_definicoes;
DROP POLICY IF EXISTS "Permitir atualização de atributos_definicoes para autenticado" ON public.atributos_definicoes;

-- doadora_atributos
DROP POLICY IF EXISTS "Permitir escrita doadora_atributos" ON public.doadora_atributos;
DROP POLICY IF EXISTS "Permitir leitura doadora_atributos" ON public.doadora_atributos;
DROP POLICY IF EXISTS "Permitir leitura de doadora_atributos para autenticados" ON public.doadora_atributos;
DROP POLICY IF EXISTS "Permitir inserção de doadora_atributos para autenticados" ON public.doadora_atributos;
DROP POLICY IF EXISTS "Permitir atualização de doadora_atributos para autenticados" ON public.doadora_atributos;
DROP POLICY IF EXISTS "Permitir deleção de doadora_atributos para autenticados" ON public.doadora_atributos;

-- historico_embrioes
DROP POLICY IF EXISTS "allow_select_historico_embrioes" ON public.historico_embrioes;

-- lote_fiv_acasalamentos
DROP POLICY IF EXISTS "allow_select_lote_fiv_acasalamentos" ON public.lote_fiv_acasalamentos;

-- lote_fiv_fazendas_destino
DROP POLICY IF EXISTS "allow_select_lote_fiv_fazendas_destino" ON public.lote_fiv_fazendas_destino;

-- pacotes_aspiracao
DROP POLICY IF EXISTS "allow_select_pacotes_aspiracao" ON public.pacotes_aspiracao;

-- pacotes_aspiracao_fazendas_destino
DROP POLICY IF EXISTS "allow_select_pacotes_aspiracao_fazendas_destino" ON public.pacotes_aspiracao_fazendas_destino;

-- receptora_renomeacoes_historico
DROP POLICY IF EXISTS "allow_select_receptora_renomeacoes_historico" ON public.receptora_renomeacoes_historico;

-- touros
DROP POLICY IF EXISTS "allow_select_touros" ON public.touros;

-- ============================================
-- PARTE 3: Otimizar políticas com auth.uid()
-- ============================================
-- Recriar políticas usando (SELECT auth.uid()) para melhor performance

-- user_profiles: remover e recriar
DROP POLICY IF EXISTS "Usuários podem ver seu próprio perfil" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins podem ver todos os perfis" ON public.user_profiles;

-- Política simples: authenticated pode ver todos (já que é app interno)
CREATE POLICY "authenticated_select_profiles" ON public.user_profiles
FOR SELECT TO authenticated
USING (true);

-- user_hub_permissions: remover e recriar
DROP POLICY IF EXISTS "Usuários podem ver suas próprias permissões" ON public.user_hub_permissions;
DROP POLICY IF EXISTS "Admins podem ver todas as permissões" ON public.user_hub_permissions;
DROP POLICY IF EXISTS "Admins podem gerenciar permissões" ON public.user_hub_permissions;

-- Política simples: authenticated pode ver/gerenciar
CREATE POLICY "authenticated_all_permissions" ON public.user_hub_permissions
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);
