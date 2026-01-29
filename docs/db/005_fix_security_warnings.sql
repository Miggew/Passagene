-- ============================================
-- FIX: Corrigir avisos de segurança do Supabase
-- ============================================
-- Este script corrige:
-- 1. Function Search Path Mutable (4 funções)
-- 2. RLS Policies Always True (remover acesso anon perigoso)
-- 3. Leaked Password Protection (configurar no dashboard)
-- ============================================

-- ============================================
-- PARTE 1: Corrigir search_path das funções
-- ============================================
-- O search_path mutável permite ataques de "search path injection"
-- Definir search_path fixo previne isso

-- Função: encerrar_sessao_te
CREATE OR REPLACE FUNCTION public.encerrar_sessao_te(
  p_receptora_ids uuid[],
  p_protocolo_receptora_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF p_receptora_ids IS NOT NULL AND array_length(p_receptora_ids, 1) > 0 THEN
    UPDATE public.receptoras
      SET status_reprodutivo = 'SERVIDA'
    WHERE id = ANY(p_receptora_ids)
      AND (status_reprodutivo IS NULL OR status_reprodutivo NOT LIKE 'PRENHE%');
  END IF;

  IF p_protocolo_receptora_ids IS NOT NULL AND array_length(p_protocolo_receptora_ids, 1) > 0 THEN
    UPDATE public.protocolo_receptoras
      SET status = 'UTILIZADA'
    WHERE id = ANY(p_protocolo_receptora_ids);
  END IF;
END;
$$;

-- Função: is_admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.v_user_permissions
    WHERE user_id = auth.uid()
    AND role = 'admin'
  );
END;
$$;

-- Função: descartar_embrioes_d9
CREATE OR REPLACE FUNCTION public.descartar_embrioes_d9()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.embrioes
  SET status_atual = 'DESCARTADO',
      data_descarte = current_date
  WHERE status_atual = 'FRESCO'
    AND id IN (
      SELECT embriao_id
      FROM public.v_embrioes_disponiveis_te
      WHERE d8_limite IS NOT NULL
        AND d8_limite < current_date
    )
    AND id NOT IN (
      SELECT embriao_id
      FROM public.transferencias_embrioes
      WHERE status_te = 'REALIZADA'
    );
END;
$$;

-- Função: update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================
-- PARTE 2: Remover políticas RLS perigosas para 'anon'
-- ============================================
-- IMPORTANTE: O role 'anon' é para usuários NÃO autenticados.
-- Permitir INSERT/UPDATE/DELETE para anon é um risco grave!
--
-- Estratégia: Remover políticas 'anon' para escrita e manter
-- apenas para 'authenticated'

-- Lista de tabelas com políticas anon perigosas
DO $$
DECLARE
  tabelas TEXT[] := ARRAY[
    'aspiracoes_doadoras',
    'clientes',
    'diagnosticos_gestacao',
    'doadoras',
    'doses_semen',
    'embrioes',
    'fazendas',
    'lotes_fiv',
    'protocolo_receptoras',
    'protocolos_sincronizacao',
    'receptora_fazenda_historico',
    'receptoras',
    'transferencias_embrioes'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    -- Remover políticas anon perigosas
    EXECUTE format('DROP POLICY IF EXISTS anon_delete ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS anon_insert ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS anon_update ON public.%I', t);

    RAISE NOTICE 'Removidas políticas anon de: %', t;
  END LOOP;
END $$;

-- Remover políticas 'allow_write_*' que incluem anon
DROP POLICY IF EXISTS allow_write_aspiracoes_doadoras ON public.aspiracoes_doadoras;
DROP POLICY IF EXISTS allow_write_acasalamento_embrioes_media ON public.acasalamento_embrioes_media;
DROP POLICY IF EXISTS allow_write_historico_embrioes ON public.historico_embrioes;
DROP POLICY IF EXISTS allow_write_lote_fiv_acasalamentos ON public.lote_fiv_acasalamentos;
DROP POLICY IF EXISTS allow_write_lote_fiv_fazendas_destino ON public.lote_fiv_fazendas_destino;
DROP POLICY IF EXISTS allow_write_pacotes_aspiracao ON public.pacotes_aspiracao;
DROP POLICY IF EXISTS allow_write_pacotes_aspiracao_fazendas_destino ON public.pacotes_aspiracao_fazendas_destino;
DROP POLICY IF EXISTS allow_write_receptora_renomeacoes_historico ON public.receptora_renomeacoes_historico;
DROP POLICY IF EXISTS allow_write_touros ON public.touros;

-- Remover políticas anon de tabelas extras
DROP POLICY IF EXISTS anon_delete ON public.pacotes_producao;
DROP POLICY IF EXISTS anon_insert ON public.pacotes_producao;
DROP POLICY IF EXISTS anon_update ON public.pacotes_producao;

-- ============================================
-- PARTE 3: Verificar se RLS está habilitado
-- ============================================
-- Garantir que RLS está habilitado em todas as tabelas

DO $$
DECLARE
  tabelas TEXT[] := ARRAY[
    'acasalamento_embrioes_media',
    'animais',
    'aspiracoes_doadoras',
    'atributos_definicoes',
    'clientes',
    'diagnosticos_gestacao',
    'doadora_atributos',
    'doadoras',
    'doses_semen',
    'embrioes',
    'fazendas',
    'historico_embrioes',
    'lote_fiv_acasalamentos',
    'lote_fiv_fazendas_destino',
    'lotes_fiv',
    'pacotes_aspiracao',
    'pacotes_aspiracao_fazendas_destino',
    'pacotes_producao',
    'protocolo_receptoras',
    'protocolos_sincronizacao',
    'receptora_fazenda_historico',
    'receptora_renomeacoes_historico',
    'receptoras',
    'receptoras_cio_livre',
    'touros',
    'transferencias_embrioes',
    'transferencias_sessoes'
  ];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    RAISE NOTICE 'RLS habilitado em: %', t;
  END LOOP;
END $$;

-- ============================================
-- PARTE 4: Manter políticas de leitura para anon (SELECT)
-- ============================================
-- Se o app usa chave anon para leitura, precisamos manter SELECT
-- Caso contrário, remova estas políticas também

-- Criar políticas de leitura para anon (se necessário)
-- DESCOMENTE se precisar de acesso anon para leitura:
/*
DO $$
DECLARE
  tabelas TEXT[] := ARRAY['clientes', 'fazendas', 'doadoras', 'receptoras', 'touros'];
  t TEXT;
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    EXECUTE format('
      CREATE POLICY IF NOT EXISTS anon_select ON public.%I
      FOR SELECT TO anon
      USING (true)
    ', t);
  END LOOP;
END $$;
*/

-- ============================================
-- PARTE 5: Conceder permissões
-- ============================================
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Permissões de execução nas funções corrigidas
GRANT EXECUTE ON FUNCTION public.encerrar_sessao_te TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.descartar_embrioes_d9 TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column TO authenticated;

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================
/*
1. LEAKED PASSWORD PROTECTION:
   - Não pode ser configurado via SQL
   - Vá para: Supabase Dashboard > Authentication > Settings
   - Habilite "Password strength" e "Leaked password protection"

2. POLÍTICAS RLS "ALWAYS TRUE":
   - As políticas para 'authenticated' com USING(true) são
     aceitáveis se TODOS os usuários autenticados devem ter
     acesso total.
   - Se precisar de controle mais granular (ex: multi-tenant),
     substitua por condições específicas como:
     USING (auth.uid() = user_id)
     ou
     USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()))

3. PARA VERIFICAR AS CORREÇÕES:
   Execute no SQL Editor:

   -- Verificar funções com search_path
   SELECT proname, prosecdef, proconfig
   FROM pg_proc
   WHERE pronamespace = 'public'::regnamespace
   AND proname IN ('encerrar_sessao_te', 'is_admin', 'descartar_embrioes_d9', 'update_updated_at_column');

   -- Verificar políticas anon restantes
   SELECT tablename, policyname, roles, cmd, qual
   FROM pg_policies
   WHERE schemaname = 'public'
   AND 'anon' = ANY(roles)
   AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL');
*/
