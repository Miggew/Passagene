-- ============================================
-- FIX: Melhorias de integridade para receptoras_cio_livre
-- ============================================
-- Este script adiciona:
-- 1. Constraint UNIQUE para evitar duplicatas
-- 2. Index para melhorar performance de queries
-- 3. Atualização da função encerrar_sessao_te para desativar CIO LIVRE
-- ============================================

-- ============================================
-- PARTE 1: Adicionar constraint UNIQUE
-- ============================================
-- Evita que uma mesma receptora tenha múltiplos registros ativos
-- na mesma fazenda

-- Primeiro, verificar e limpar duplicatas existentes (manter apenas o mais recente)
WITH duplicatas AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY receptora_id, fazenda_id
           ORDER BY created_at DESC NULLS LAST, id DESC
         ) AS rn
  FROM public.receptoras_cio_livre
  WHERE ativa = true
)
UPDATE public.receptoras_cio_livre
SET ativa = false
WHERE id IN (
  SELECT id FROM duplicatas WHERE rn > 1
);

-- Agora criar o índice único
-- Usa filtro parcial para permitir múltiplos registros inativos
DROP INDEX IF EXISTS idx_receptoras_cio_livre_unique_ativa;
CREATE UNIQUE INDEX idx_receptoras_cio_livre_unique_ativa
ON public.receptoras_cio_livre (receptora_id, fazenda_id)
WHERE ativa = true;

-- ============================================
-- PARTE 2: Adicionar índice para performance
-- ============================================
-- Index para a query principal: WHERE ativa = true AND fazenda_id = ?
DROP INDEX IF EXISTS idx_receptoras_cio_livre_fazenda_ativa;
CREATE INDEX idx_receptoras_cio_livre_fazenda_ativa
ON public.receptoras_cio_livre (fazenda_id)
WHERE ativa = true;

-- ============================================
-- PARTE 3: Atualizar função encerrar_sessao_te
-- ============================================
-- Adiciona lógica para desativar registros de CIO LIVRE
-- quando receptoras recebem embriões

CREATE OR REPLACE FUNCTION public.encerrar_sessao_te(
  p_receptora_ids uuid[],
  p_protocolo_receptora_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_protocolo_id uuid;
  v_pendentes integer;
  v_utilizadas integer;
  v_novo_status text;
BEGIN
  -- 1. Desativar registros de CIO LIVRE para as receptoras que receberam embriões
  -- Isso evita que elas apareçam novamente em futuras sessões de TE
  IF p_receptora_ids IS NOT NULL AND array_length(p_receptora_ids, 1) > 0 THEN
    UPDATE public.receptoras_cio_livre
      SET ativa = false
    WHERE receptora_id = ANY(p_receptora_ids)
      AND ativa = true;
  END IF;

  -- 2. Atualizar status das receptoras para SERVIDA
  IF p_receptora_ids IS NOT NULL AND array_length(p_receptora_ids, 1) > 0 THEN
    UPDATE public.receptoras
      SET status_reprodutivo = 'SERVIDA'
    WHERE id = ANY(p_receptora_ids)
      AND (status_reprodutivo IS NULL OR status_reprodutivo NOT LIKE 'PRENHE%');
  END IF;

  -- 3. Atualizar protocolo_receptoras para UTILIZADA
  IF p_protocolo_receptora_ids IS NOT NULL AND array_length(p_protocolo_receptora_ids, 1) > 0 THEN
    UPDATE public.protocolo_receptoras
      SET status = 'UTILIZADA'
    WHERE id = ANY(p_protocolo_receptora_ids);

    -- Para cada protocolo afetado, verificar se todas as receptoras foram processadas
    FOR v_protocolo_id IN (
      SELECT DISTINCT protocolo_id
      FROM public.protocolo_receptoras
      WHERE id = ANY(p_protocolo_receptora_ids)
    )
    LOOP
      -- Contar receptoras pendentes (APTA ou INICIADA)
      SELECT count(*) INTO v_pendentes
      FROM public.protocolo_receptoras
      WHERE protocolo_id = v_protocolo_id
        AND status IN ('APTA', 'INICIADA');

      -- Se não há pendentes, atualizar status do protocolo
      IF v_pendentes = 0 THEN
        -- Contar receptoras utilizadas (TE realizada)
        SELECT count(*) INTO v_utilizadas
        FROM public.protocolo_receptoras
        WHERE protocolo_id = v_protocolo_id
          AND status = 'UTILIZADA';

        -- Definir novo status: EM_TE se alguma foi utilizada, FECHADO se todas INAPTA
        v_novo_status := CASE WHEN v_utilizadas > 0 THEN 'EM_TE' ELSE 'FECHADO' END;

        UPDATE public.protocolos_sincronizacao
          SET status = v_novo_status
        WHERE id = v_protocolo_id
          AND status = 'SINCRONIZADO';
      END IF;
    END LOOP;
  END IF;
END;
$$;

-- Garantir permissões
GRANT EXECUTE ON FUNCTION public.encerrar_sessao_te TO authenticated;

-- ============================================
-- NOTAS
-- ============================================
/*
1. O índice único parcial (WHERE ativa = true) garante que:
   - Cada receptora só pode ter UM registro ativo por fazenda
   - Múltiplos registros inativos são permitidos (histórico)

2. A atualização da função encerrar_sessao_te garante que:
   - Receptoras CIO LIVRE são desativadas ao encerrar sessão
   - Não reaparecem em futuras sessões de TE

3. Para verificar duplicatas existentes antes de aplicar:
   SELECT receptora_id, fazenda_id, COUNT(*)
   FROM receptoras_cio_livre
   WHERE ativa = true
   GROUP BY receptora_id, fazenda_id
   HAVING COUNT(*) > 1;
*/
