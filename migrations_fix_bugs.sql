-- ============================================================
-- Correções de Bugs - PassaGene
-- Data: 2026-01-08
-- ============================================================

-- ============================================================
-- 1. RPC para criar protocolo e vínculos de receptoras de forma atômica
-- ============================================================

CREATE OR REPLACE FUNCTION criar_protocolo_passo1_atomico(
  p_fazenda_id UUID,
  p_data_inicio DATE,
  p_responsavel_inicio TEXT,
  p_receptoras_ids UUID[],
  p_fazenda_atual_id UUID,
  p_data_inclusao DATE,
  p_observacoes TEXT DEFAULT NULL,
  p_receptoras_observacoes TEXT[] DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_protocolo_id UUID;
  v_receptora_id UUID;
  v_index INTEGER;
BEGIN
  -- Validar que há pelo menos 1 receptora
  IF array_length(p_receptoras_ids, 1) IS NULL OR array_length(p_receptoras_ids, 1) = 0 THEN
    RAISE EXCEPTION 'Deve haver pelo menos 1 receptora selecionada';
  END IF;

  -- Validar que todos os IDs são válidos (não NULL)
  FOREACH v_receptora_id IN ARRAY p_receptoras_ids
  LOOP
    IF v_receptora_id IS NULL THEN
      RAISE EXCEPTION 'ID de receptora inválido (NULL)';
    END IF;
  END LOOP;

  -- Criar protocolo
  INSERT INTO protocolos_sincronizacao (
    fazenda_id,
    data_inicio,
    responsavel_inicio,
    observacoes,
    status
  ) VALUES (
    p_fazenda_id,
    p_data_inicio,
    p_responsavel_inicio,
    p_observacoes,
    'PASSO1_FECHADO'
  ) RETURNING id INTO v_protocolo_id;

  -- Criar vínculos de receptoras em lote
  -- Se p_receptoras_observacoes foi fornecido, usar observações correspondentes
  IF p_receptoras_observacoes IS NOT NULL AND array_length(p_receptoras_observacoes, 1) = array_length(p_receptoras_ids, 1) THEN
    -- Criar com observações individuais
    FOR v_index IN 1..array_length(p_receptoras_ids, 1)
    LOOP
      INSERT INTO protocolo_receptoras (
        protocolo_id,
        receptora_id,
        fazenda_atual_id,
        data_inclusao,
        status,
        observacoes
      ) VALUES (
        v_protocolo_id,
        p_receptoras_ids[v_index],
        p_fazenda_atual_id,
        p_data_inclusao,
        'INICIADA',
        NULLIF(TRIM(p_receptoras_observacoes[v_index]), '')
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  ELSE
    -- Criar sem observações individuais (ou se array não foi fornecido)
    INSERT INTO protocolo_receptoras (
      protocolo_id,
      receptora_id,
      fazenda_atual_id,
      data_inclusao,
      status
    )
    SELECT
      v_protocolo_id,
      unnest(p_receptoras_ids) AS receptora_id,
      p_fazenda_atual_id,
      p_data_inclusao,
      'INICIADA'
    ON CONFLICT DO NOTHING;
  END IF;

  -- Retornar ID do protocolo criado
  RETURN v_protocolo_id;
END;
$$;

-- Garantir permissões
GRANT EXECUTE ON FUNCTION criar_protocolo_passo1_atomico TO authenticated;
GRANT EXECUTE ON FUNCTION criar_protocolo_passo1_atomico TO anon;

-- ============================================================
-- 2. Índice para melhorar performance da busca por fazenda + data
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_protocolos_fazenda_data 
ON protocolos_sincronizacao(fazenda_id, data_inicio DESC);

-- ============================================================
-- 3. SQL para AUDITORIA de protocolos zumbis (Apenas SELECT - não deleta)
-- ============================================================

-- Protocolos sem receptoras vinculadas (criados recentemente - últimos 30 dias)
SELECT 
  p.id,
  p.fazenda_id,
  p.data_inicio,
  p.status,
  p.created_at,
  COUNT(pr.id) as receptoras_count
FROM protocolos_sincronizacao p
LEFT JOIN protocolo_receptoras pr ON pr.protocolo_id = p.id
WHERE 
  -- Criado nos últimos 30 dias
  p.created_at >= NOW() - INTERVAL '30 days'
  -- Sem receptoras vinculadas
  AND NOT EXISTS (
    SELECT 1 FROM protocolo_receptoras pr2 
    WHERE pr2.protocolo_id = p.id
  )
  -- Status que indicam problema
  AND p.status IN ('PASSO1_FECHADO', 'ABERTO', 'PASSO1_ABERTO')
GROUP BY p.id, p.fazenda_id, p.data_inicio, p.status, p.created_at
ORDER BY p.created_at DESC;

-- ============================================================
-- 4. SQL para LIMPEZA de protocolos zumbis (DELETE - execute com cuidado!)
-- ============================================================

-- IMPORTANTE: Execute primeiro a query de auditoria acima para revisar o que será removido
-- Só execute este DELETE se tiver certeza de que os registros são realmente zumbis

-- Deletar protocolos órfãos (sem receptoras, criados nos últimos 30 dias, status específico)
-- DELETE FROM protocolos_sincronizacao
-- WHERE id IN (
--   SELECT p.id
--   FROM protocolos_sincronizacao p
--   WHERE 
--     p.created_at >= NOW() - INTERVAL '30 days'
--     AND p.status IN ('PASSO1_FECHADO', 'ABERTO', 'PASSO1_ABERTO')
--     AND NOT EXISTS (
--       SELECT 1 FROM protocolo_receptoras pr 
--       WHERE pr.protocolo_id = p.id
--     )
-- );

-- ============================================================
-- 5. Query para verificar protocolos com passo2_data mas sem receptoras
-- ============================================================

-- Verificar se existem protocolos com passo2 iniciado mas sem receptoras
-- (isso não deveria acontecer, mas pode ser resultado do bug anterior)
SELECT 
  p.id,
  p.fazenda_id,
  p.data_inicio,
  p.passo2_data,
  p.status,
  COUNT(pr.id) as receptoras_count
FROM protocolos_sincronizacao p
LEFT JOIN protocolo_receptoras pr ON pr.protocolo_id = p.id
WHERE 
  p.passo2_data IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM protocolo_receptoras pr2 
    WHERE pr2.protocolo_id = p.id
  )
GROUP BY p.id, p.fazenda_id, p.data_inicio, p.passo2_data, p.status
ORDER BY p.created_at DESC;
