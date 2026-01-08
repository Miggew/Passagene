-- ============================================================
-- Limpeza de Protocolos Problemáticos
-- ============================================================
-- ATENÇÃO: Revise cuidadosamente antes de executar os DELETEs
-- ============================================================

-- ============================================================
-- 1. VERIFICAR todos os protocolos com passo2_data mas sem receptoras
-- ============================================================
SELECT 
  p.id,
  p.fazenda_id,
  p.data_inicio,
  p.passo2_data,
  p.passo2_tecnico_responsavel,
  p.status,
  p.created_at,
  COUNT(pr.id) as receptoras_count
FROM protocolos_sincronizacao p
LEFT JOIN protocolo_receptoras pr ON pr.protocolo_id = p.id
WHERE 
  p.passo2_data IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM protocolo_receptoras pr2 
    WHERE pr2.protocolo_id = p.id
  )
GROUP BY p.id, p.fazenda_id, p.data_inicio, p.passo2_data, p.passo2_tecnico_responsavel, p.status, p.created_at
ORDER BY p.created_at DESC;

-- ============================================================
-- 2. DELETAR protocolos com passo2_data mas sem receptoras
-- ============================================================
-- IMPORTANTE: Execute a query acima primeiro e confirme que são realmente zumbis
-- ✅ APROVADO: Apenas 1 protocolo encontrado, sem receptoras - seguro para deletar

DELETE FROM protocolos_sincronizacao
WHERE id IN (
  SELECT p.id
  FROM protocolos_sincronizacao p
  WHERE 
    p.passo2_data IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM protocolo_receptoras pr 
      WHERE pr.protocolo_id = p.id
    )
);

-- ============================================================
-- 2.1. VERIFICAR se foi deletado corretamente (execute após o DELETE)
-- ============================================================
SELECT COUNT(*) as protocolos_restantes
FROM protocolos_sincronizacao p
WHERE 
  p.passo2_data IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM protocolo_receptoras pr 
    WHERE pr.protocolo_id = p.id
  );
-- Resultado esperado: 0 (zero protocolos problemáticos restantes)

-- ============================================================
-- 3. VERIFICAR protocolo específico (se quiser investigar)
-- ============================================================
-- Substitua o ID abaixo pelo ID do protocolo que você quer investigar
-- SELECT 
--   p.*,
--   (SELECT COUNT(*) FROM protocolo_receptoras pr WHERE pr.protocolo_id = p.id) as receptoras_count
-- FROM protocolos_sincronizacao p
-- WHERE p.id = '8629d5c0-e72b-4255-bba7-6a6229f035d6';
