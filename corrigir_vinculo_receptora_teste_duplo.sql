-- Query única para corrigir o vínculo da receptora "teste duplo" na fazenda Bucaina
-- Fecha o vínculo da receptora errada e cria o vínculo da receptora correta (SINCRONIZADA)

WITH alvo AS (
  SELECT
    '15f77862-9821-482b-8019-1e6c9c714223'::uuid AS receptora_id_correta,
    'd488a22a-56eb-4787-b545-e5b488ccfadd'::uuid AS receptora_id_errada,
    ps.fazenda_id AS fazenda_id,
    ps.data_inicio::date AS data_inicio
  FROM protocolos_sincronizacao ps
  WHERE ps.id = '24c55d63-fd3f-479f-8e8f-7f5d576f7b6b'::uuid
),
fechar_vinculo_errado AS (
  UPDATE receptora_fazenda_historico rfh
  SET
    data_fim = (SELECT data_inicio - INTERVAL '1 day' FROM alvo),
    observacoes = COALESCE(rfh.observacoes, '') || ' | Auto-fix: vínculo fechado - receptora não está SINCRONIZADA, substituída por receptora correta',
    updated_at = NOW()
  WHERE rfh.receptora_id = (SELECT receptora_id_errada FROM alvo)
    AND rfh.data_fim IS NULL
  RETURNING rfh.id, rfh.receptora_id, rfh.fazenda_id
),
criar_vinculo_correto AS (
  INSERT INTO receptora_fazenda_historico (receptora_id, fazenda_id, data_inicio, data_fim, observacoes)
  SELECT
    a.receptora_id_correta,
    a.fazenda_id,
    a.data_inicio,
    NULL,
    'Auto-fix: criado vínculo ativo - receptora SINCRONIZADA corrigida para aparecer no menu TE'
  FROM alvo a
  WHERE NOT EXISTS (
    SELECT 1
    FROM receptora_fazenda_historico rfh
    WHERE rfh.receptora_id = a.receptora_id_correta
      AND rfh.data_fim IS NULL
      AND rfh.fazenda_id = a.fazenda_id
  )
  RETURNING id, receptora_id, fazenda_id, data_inicio
)
SELECT
  '✅ CORRIGIDO' AS status,
  vw.receptora_id,
  r.identificacao,
  r.nome,
  vw.fazenda_id_atual,
  vw.fazenda_nome_atual,
  vw.data_inicio_atual,
  v.fase_ciclo,
  v.status_efetivo
FROM vw_receptoras_fazenda_atual vw
JOIN receptoras r ON r.id = vw.receptora_id
LEFT JOIN v_protocolo_receptoras_status v ON v.receptora_id = vw.receptora_id AND v.fase_ciclo = 'SINCRONIZADA'
WHERE vw.receptora_id = (SELECT receptora_id_correta FROM alvo);
