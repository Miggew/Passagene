-- ============================================================
-- Hub Escritório — SQL Consolidado
-- Executar no Supabase Dashboard (SQL Editor) em ordem
-- ============================================================

-- ============================================================
-- 1. TABELAS
-- ============================================================

-- Histórico de relatórios importados (OCR ou manual)
CREATE TABLE IF NOT EXISTS report_imports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  report_type text NOT NULL,          -- 'p1','p2','te','dg','sexagem','aspiracao'
  image_path text,                    -- path no Supabase Storage (null se manual)
  extracted_data jsonb,               -- JSON bruto do Gemini (null se manual)
  final_data jsonb NOT NULL,          -- JSON final após correções do usuário
  status text DEFAULT 'processing',   -- 'processing','review','completed','reverted'
  fazenda_id uuid REFERENCES fazendas(id),
  protocolo_id uuid,                  -- referência ao protocolo (se aplicável)
  pacote_aspiracao_id uuid,           -- referência à aspiração (se aplicável)
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  reverted_at timestamptz             -- quando foi desfeito (null = ativo)
);

-- Correções para aprendizado do OCR
CREATE TABLE IF NOT EXISTS ocr_corrections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  report_type text NOT NULL,          -- 'p1','p2','te','dg','sexagem','aspiracao'
  field_type text NOT NULL,           -- 'registro','raca','resultado','viaveis'...
  raw_value text NOT NULL,            -- o que a IA leu
  corrected_value text NOT NULL,      -- o que o usuário corrigiu
  fazenda_id uuid REFERENCES fazendas(id),
  veterinario text,                   -- contexto da caligrafia
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- 2. ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_ocr_corrections_lookup
  ON ocr_corrections(fazenda_id, report_type, field_type);

CREATE INDEX IF NOT EXISTS idx_report_imports_status
  ON report_imports(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_report_imports_fazenda
  ON report_imports(fazenda_id, created_at DESC);

-- ============================================================
-- 3. RLS (Row Level Security)
-- ============================================================

ALTER TABLE report_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_corrections ENABLE ROW LEVEL SECURITY;

-- report_imports: admin/operacional podem tudo
CREATE POLICY "report_imports_select" ON report_imports
  FOR SELECT USING (is_admin_or_operacional());

CREATE POLICY "report_imports_insert" ON report_imports
  FOR INSERT WITH CHECK (is_admin_or_operacional());

CREATE POLICY "report_imports_update" ON report_imports
  FOR UPDATE USING (is_admin_or_operacional());

-- ocr_corrections: admin/operacional podem tudo
CREATE POLICY "ocr_corrections_select" ON ocr_corrections
  FOR SELECT USING (is_admin_or_operacional());

CREATE POLICY "ocr_corrections_insert" ON ocr_corrections
  FOR INSERT WITH CHECK (is_admin_or_operacional());

-- ============================================================
-- 4. RPCs ATÔMICAS (SECURITY DEFINER)
-- ============================================================

-- ------------------------------------------------------------
-- 4.1 registrar_dg_batch
-- Registra diagnósticos de gestação em batch
-- Input: array de {protocolo_receptora_id, receptora_id, resultado, observacoes}
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION registrar_dg_batch(
  p_data_diagnostico date,
  p_veterinario text,
  p_tecnico text,
  p_fazenda_id uuid,
  p_resultados jsonb  -- array de resultados DG
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_pr_id uuid;
  v_rec_id uuid;
  v_resultado text;
  v_obs text;
  v_data_te date;
  v_count int := 0;
  v_import_ids uuid[] := '{}';
BEGIN
  -- Permissão
  IF NOT is_admin_or_operacional() THEN
    RAISE EXCEPTION 'Sem permissão para registrar DG';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_resultados)
  LOOP
    v_pr_id := (v_item->>'protocolo_receptora_id')::uuid;
    v_rec_id := (v_item->>'receptora_id')::uuid;
    v_resultado := v_item->>'resultado';
    v_obs := v_item->>'observacoes';

    -- Validar status atual da receptora no protocolo
    IF NOT EXISTS (
      SELECT 1 FROM protocolo_receptoras
      WHERE id = v_pr_id AND status IN ('SERVIDA', 'UTILIZADA')
    ) THEN
      RAISE EXCEPTION 'Receptora % não está com status SERVIDA/UTILIZADA', v_pr_id;
    END IF;

    -- Validar resultado
    IF v_resultado NOT IN ('PRENHE', 'VAZIA', 'RETOQUE') THEN
      RAISE EXCEPTION 'Resultado DG inválido: %', v_resultado;
    END IF;

    -- Buscar data_te da transferência
    SELECT te.data_te INTO v_data_te
    FROM transferencias_embrioes te
    JOIN protocolo_receptoras pr ON pr.receptora_id = te.receptora_id
    WHERE pr.id = v_pr_id
    ORDER BY te.data_te DESC
    LIMIT 1;

    -- Inserir diagnóstico
    INSERT INTO diagnosticos_gestacao (
      receptora_id, data_te, tipo_diagnostico, data_diagnostico,
      resultado, numero_gestacoes, veterinario_responsavel,
      tecnico_responsavel, observacoes, fazenda_id
    ) VALUES (
      v_rec_id,
      COALESCE(v_data_te, p_data_diagnostico),
      'DG',
      p_data_diagnostico,
      v_resultado,
      COALESCE(
        (SELECT COUNT(*) + 1 FROM diagnosticos_gestacao WHERE receptora_id = v_rec_id),
        1
      ),
      p_veterinario,
      p_tecnico,
      v_obs,
      p_fazenda_id
    );

    -- Atualizar status na protocolo_receptoras
    UPDATE protocolo_receptoras
    SET status = CASE
      WHEN v_resultado = 'PRENHE' THEN 'PRENHE'
      WHEN v_resultado = 'VAZIA' THEN 'VAZIA'
      WHEN v_resultado = 'RETOQUE' THEN 'PRENHE_RETOQUE'
    END
    WHERE id = v_pr_id;

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'count', v_count);
END;
$$;

-- ------------------------------------------------------------
-- 4.2 registrar_sexagem_batch
-- Registra sexagens em batch (insere em diagnosticos_gestacao)
-- Input: array de {protocolo_receptora_id, receptora_id, resultado, observacoes}
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION registrar_sexagem_batch(
  p_data_sexagem date,
  p_veterinario text,
  p_tecnico text,
  p_fazenda_id uuid,
  p_resultados jsonb  -- array de resultados sexagem
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_pr_id uuid;
  v_rec_id uuid;
  v_resultado text;
  v_obs text;
  v_data_te date;
  v_count int := 0;
  v_status_final text;
BEGIN
  IF NOT is_admin_or_operacional() THEN
    RAISE EXCEPTION 'Sem permissão para registrar sexagem';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_resultados)
  LOOP
    v_pr_id := (v_item->>'protocolo_receptora_id')::uuid;
    v_rec_id := (v_item->>'receptora_id')::uuid;
    v_resultado := v_item->>'resultado';
    v_obs := v_item->>'observacoes';

    -- Validar status atual
    IF NOT EXISTS (
      SELECT 1 FROM protocolo_receptoras
      WHERE id = v_pr_id AND status IN ('PRENHE', 'PRENHE_RETOQUE')
    ) THEN
      RAISE EXCEPTION 'Receptora % não está PRENHE/PRENHE_RETOQUE', v_pr_id;
    END IF;

    -- Validar resultado
    IF v_resultado NOT IN ('PRENHE_FEMEA', 'PRENHE_MACHO', 'PRENHE_SEM_SEXO', 'PRENHE_2_SEXOS', 'VAZIA') THEN
      RAISE EXCEPTION 'Resultado sexagem inválido: %', v_resultado;
    END IF;

    -- Buscar data_te
    SELECT te.data_te INTO v_data_te
    FROM transferencias_embrioes te
    JOIN protocolo_receptoras pr ON pr.receptora_id = te.receptora_id
    WHERE pr.id = v_pr_id
    ORDER BY te.data_te DESC
    LIMIT 1;

    -- Inserir diagnóstico de sexagem
    INSERT INTO diagnosticos_gestacao (
      receptora_id, data_te, tipo_diagnostico, data_diagnostico,
      resultado, numero_gestacoes, veterinario_responsavel,
      tecnico_responsavel, observacoes, fazenda_id
    ) VALUES (
      v_rec_id,
      COALESCE(v_data_te, p_data_sexagem),
      'SEXAGEM',
      p_data_sexagem,
      v_resultado,
      COALESCE(
        (SELECT COUNT(*) FROM diagnosticos_gestacao WHERE receptora_id = v_rec_id AND tipo_diagnostico = 'DG'),
        1
      ),
      p_veterinario,
      p_tecnico,
      v_obs,
      p_fazenda_id
    );

    -- Atualizar status
    UPDATE protocolo_receptoras
    SET status = v_resultado
    WHERE id = v_pr_id;

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'count', v_count);
END;
$$;

-- ------------------------------------------------------------
-- 4.3 confirmar_p2_batch
-- Confirma presença ou marca perdas no 2º passo
-- Input: protocolo_id + array de receptora_ids que são perdas
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION confirmar_p2_batch(
  p_protocolo_id uuid,
  p_data_confirmacao date,
  p_veterinario text,
  p_tecnico text,
  p_perdas_ids uuid[]  -- IDs de protocolo_receptoras que são perdas
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int;
  v_perdas int;
  v_aptas int;
BEGIN
  IF NOT is_admin_or_operacional() THEN
    RAISE EXCEPTION 'Sem permissão para confirmar P2';
  END IF;

  -- Contar total de receptoras no protocolo
  SELECT COUNT(*) INTO v_total
  FROM protocolo_receptoras
  WHERE protocolo_id = p_protocolo_id;

  IF v_total = 0 THEN
    RAISE EXCEPTION 'Protocolo % não tem receptoras', p_protocolo_id;
  END IF;

  -- Marcar perdas (status = INAPTA, motivo = perda P2)
  UPDATE protocolo_receptoras
  SET status = 'INAPTA',
      motivo_inapta = 'Perda no P2',
      data_retirada = p_data_confirmacao::text
  WHERE id = ANY(p_perdas_ids)
    AND protocolo_id = p_protocolo_id;

  GET DIAGNOSTICS v_perdas = ROW_COUNT;

  -- Confirmar restantes como SINCRONIZADA (aptas para TE)
  UPDATE protocolo_receptoras
  SET status = 'SINCRONIZADA'
  WHERE protocolo_id = p_protocolo_id
    AND id != ALL(p_perdas_ids)
    AND status NOT IN ('INAPTA');

  GET DIAGNOSTICS v_aptas = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'total', v_total,
    'aptas', v_aptas,
    'perdas', v_perdas
  );
END;
$$;

-- ------------------------------------------------------------
-- 4.4 registrar_te_batch
-- Registra transferências de embriões em batch
-- Input: array de {protocolo_receptora_id, receptora_id, embriao_id}
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION registrar_te_batch(
  p_data_te date,
  p_veterinario text,
  p_tecnico text,
  p_fazenda_id uuid,
  p_transferencias jsonb  -- array de transferencias
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_pr_id uuid;
  v_rec_id uuid;
  v_emb_id uuid;
  v_obs text;
  v_count int := 0;
BEGIN
  IF NOT is_admin_or_operacional() THEN
    RAISE EXCEPTION 'Sem permissão para registrar TE';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_transferencias)
  LOOP
    v_pr_id := (v_item->>'protocolo_receptora_id')::uuid;
    v_rec_id := (v_item->>'receptora_id')::uuid;
    v_emb_id := (v_item->>'embriao_id')::uuid;
    v_obs := v_item->>'observacoes';

    -- Validar status da receptora
    IF NOT EXISTS (
      SELECT 1 FROM protocolo_receptoras
      WHERE id = v_pr_id AND status = 'SINCRONIZADA'
    ) THEN
      RAISE EXCEPTION 'Receptora % não está SINCRONIZADA', v_pr_id;
    END IF;

    -- Validar que o embrião não foi transferido antes
    IF EXISTS (
      SELECT 1 FROM transferencias_embrioes
      WHERE embriao_id = v_emb_id
    ) THEN
      RAISE EXCEPTION 'Embrião % já foi transferido', v_emb_id;
    END IF;

    -- Inserir transferência
    INSERT INTO transferencias_embrioes (
      embriao_id, receptora_id, protocolo_receptora_id,
      data_te, status_te, veterinario_responsavel,
      tecnico_responsavel, observacoes
    ) VALUES (
      v_emb_id, v_rec_id, v_pr_id,
      p_data_te::text, 'REALIZADA', p_veterinario,
      p_tecnico, v_obs
    );

    -- Atualizar status da receptora para SERVIDA
    UPDATE protocolo_receptoras
    SET status = 'SERVIDA'
    WHERE id = v_pr_id;

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'count', v_count);
END;
$$;

-- ------------------------------------------------------------
-- 4.5 registrar_aspiracao_batch
-- Registra pacote de aspiração + doadoras em batch
-- Input: dados do pacote + array de doadoras com oócitos
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION registrar_aspiracao_batch(
  p_fazenda_id uuid,
  p_fazenda_destino_id uuid,
  p_data_aspiracao date,
  p_horario_inicio text,
  p_veterinario text,
  p_tecnico text,
  p_observacoes text,
  p_doadoras jsonb  -- array de doadoras com oócitos
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pacote_id uuid;
  v_item jsonb;
  v_total_oocitos int := 0;
  v_count int := 0;
  v_viaveis int;
  v_atresicos int;
  v_degenerados int;
  v_expandidos int;
  v_desnudos int;
BEGIN
  IF NOT is_admin_or_operacional() THEN
    RAISE EXCEPTION 'Sem permissão para registrar aspiração';
  END IF;

  -- Criar pacote de aspiração
  INSERT INTO pacotes_aspiracao (
    fazenda_id, fazenda_destino_id, data_aspiracao,
    horario_inicio, status, veterinario_responsavel,
    tecnico_responsavel, observacoes
  ) VALUES (
    p_fazenda_id, COALESCE(p_fazenda_destino_id, p_fazenda_id),
    p_data_aspiracao::text, p_horario_inicio,
    'FINALIZADO', p_veterinario, p_tecnico, p_observacoes
  )
  RETURNING id INTO v_pacote_id;

  -- Inserir doadoras
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_doadoras)
  LOOP
    v_atresicos := COALESCE((v_item->>'atresicos')::int, 0);
    v_degenerados := COALESCE((v_item->>'degenerados')::int, 0);
    v_expandidos := COALESCE((v_item->>'expandidos')::int, 0);
    v_desnudos := COALESCE((v_item->>'desnudos')::int, 0);
    v_viaveis := COALESCE((v_item->>'viaveis')::int, 0);

    INSERT INTO aspiracoes_doadoras (
      doadora_id, pacote_aspiracao_id, fazenda_id,
      data_aspiracao, horario_aspiracao, hora_final,
      atresicos, degenerados, expandidos, desnudos, viaveis,
      total_oocitos, recomendacao_touro,
      veterinario_responsavel, tecnico_responsavel, observacoes
    ) VALUES (
      (v_item->>'doadora_id')::uuid,
      v_pacote_id,
      p_fazenda_id,
      p_data_aspiracao::text,
      COALESCE(v_item->>'horario_aspiracao', p_horario_inicio),
      v_item->>'hora_final',
      v_atresicos, v_degenerados, v_expandidos, v_desnudos, v_viaveis,
      v_atresicos + v_degenerados + v_expandidos + v_desnudos + v_viaveis,
      v_item->>'recomendacao_touro',
      p_veterinario, p_tecnico,
      v_item->>'observacoes'
    );

    v_total_oocitos := v_total_oocitos + v_atresicos + v_degenerados + v_expandidos + v_desnudos + v_viaveis;
    v_count := v_count + 1;
  END LOOP;

  -- Atualizar total no pacote
  UPDATE pacotes_aspiracao
  SET total_oocitos = v_total_oocitos
  WHERE id = v_pacote_id;

  RETURN jsonb_build_object(
    'success', true,
    'pacote_id', v_pacote_id,
    'count', v_count,
    'total_oocitos', v_total_oocitos
  );
END;
$$;

-- ------------------------------------------------------------
-- 4.6 reverter_import
-- Desfaz uma importação inteira (rollback)
-- Prazo: 48h após criação
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION reverter_import(
  p_import_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_import report_imports%ROWTYPE;
  v_item jsonb;
  v_count int := 0;
BEGIN
  IF NOT is_admin_or_operacional() THEN
    RAISE EXCEPTION 'Sem permissão para reverter importação';
  END IF;

  -- Buscar import
  SELECT * INTO v_import FROM report_imports WHERE id = p_import_id;

  IF v_import.id IS NULL THEN
    RAISE EXCEPTION 'Importação não encontrada: %', p_import_id;
  END IF;

  IF v_import.status = 'reverted' THEN
    RAISE EXCEPTION 'Importação já foi revertida';
  END IF;

  IF v_import.status != 'completed' THEN
    RAISE EXCEPTION 'Só importações completas podem ser revertidas (status atual: %)', v_import.status;
  END IF;

  -- Validar prazo de 48h
  IF v_import.completed_at < now() - interval '48 hours' THEN
    RAISE EXCEPTION 'Prazo de 48h para reversão expirou';
  END IF;

  -- Reverter baseado no tipo
  IF v_import.report_type = 'dg' THEN
    -- Reverter diagnósticos: deletar DGs e restaurar status das receptoras
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_import.final_data->'resultados')
    LOOP
      -- Restaurar status para SERVIDA
      UPDATE protocolo_receptoras
      SET status = 'SERVIDA'
      WHERE id = (v_item->>'protocolo_receptora_id')::uuid
        AND status IN ('PRENHE', 'VAZIA', 'PRENHE_RETOQUE');

      -- Deletar o diagnóstico mais recente dessa receptora
      DELETE FROM diagnosticos_gestacao
      WHERE id = (
        SELECT id FROM diagnosticos_gestacao
        WHERE receptora_id = (v_item->>'receptora_id')::uuid
          AND tipo_diagnostico = 'DG'
          AND data_diagnostico = (v_import.final_data->>'data_diagnostico')::date
        ORDER BY created_at DESC
        LIMIT 1
      );

      v_count := v_count + 1;
    END LOOP;

  ELSIF v_import.report_type = 'sexagem' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_import.final_data->'resultados')
    LOOP
      -- Restaurar status para PRENHE
      UPDATE protocolo_receptoras
      SET status = 'PRENHE'
      WHERE id = (v_item->>'protocolo_receptora_id')::uuid
        AND status IN ('PRENHE_FEMEA', 'PRENHE_MACHO', 'PRENHE_SEM_SEXO', 'PRENHE_2_SEXOS');

      DELETE FROM diagnosticos_gestacao
      WHERE id = (
        SELECT id FROM diagnosticos_gestacao
        WHERE receptora_id = (v_item->>'receptora_id')::uuid
          AND tipo_diagnostico = 'SEXAGEM'
        ORDER BY created_at DESC
        LIMIT 1
      );

      v_count := v_count + 1;
    END LOOP;

  ELSIF v_import.report_type = 'te' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_import.final_data->'transferencias')
    LOOP
      -- Restaurar status para SINCRONIZADA
      UPDATE protocolo_receptoras
      SET status = 'SINCRONIZADA'
      WHERE id = (v_item->>'protocolo_receptora_id')::uuid
        AND status = 'SERVIDA';

      -- Deletar transferência
      DELETE FROM transferencias_embrioes
      WHERE embriao_id = (v_item->>'embriao_id')::uuid
        AND receptora_id = (v_item->>'receptora_id')::uuid;

      v_count := v_count + 1;
    END LOOP;

  ELSIF v_import.report_type = 'p2' THEN
    -- Restaurar todas as receptoras do protocolo para status anterior
    UPDATE protocolo_receptoras
    SET status = 'EM_SINCRONIZACAO',
        motivo_inapta = NULL,
        data_retirada = NULL
    WHERE protocolo_id = v_import.protocolo_id
      AND status IN ('SINCRONIZADA', 'INAPTA');

    SELECT COUNT(*) INTO v_count
    FROM protocolo_receptoras
    WHERE protocolo_id = v_import.protocolo_id;

  ELSIF v_import.report_type = 'aspiracao' THEN
    -- Deletar aspirações_doadoras do pacote
    DELETE FROM aspiracoes_doadoras
    WHERE pacote_aspiracao_id = v_import.pacote_aspiracao_id;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- Deletar pacote
    DELETE FROM pacotes_aspiracao
    WHERE id = v_import.pacote_aspiracao_id;
  END IF;

  -- Marcar como revertido
  UPDATE report_imports
  SET status = 'reverted',
      reverted_at = now()
  WHERE id = p_import_id;

  RETURN jsonb_build_object('success', true, 'reverted_count', v_count);
END;
$$;

-- ============================================================
-- 5. GRANTS
-- ============================================================

GRANT EXECUTE ON FUNCTION registrar_dg_batch TO authenticated;
GRANT EXECUTE ON FUNCTION registrar_sexagem_batch TO authenticated;
GRANT EXECUTE ON FUNCTION confirmar_p2_batch TO authenticated;
GRANT EXECUTE ON FUNCTION registrar_te_batch TO authenticated;
GRANT EXECUTE ON FUNCTION registrar_aspiracao_batch TO authenticated;
GRANT EXECUTE ON FUNCTION reverter_import TO authenticated;

-- ============================================================
-- 6. INSERT HUB
-- ============================================================

INSERT INTO hubs (id, code, name, description, routes, display_order)
VALUES (
  gen_random_uuid(),
  'escritorio',
  'Escritório',
  'Cadastro de relatórios de campo',
  ARRAY[
    '/escritorio',
    '/escritorio/dg',
    '/escritorio/sexagem',
    '/escritorio/protocolo-p1',
    '/escritorio/protocolo-p2',
    '/escritorio/te',
    '/escritorio/aspiracao',
    '/escritorio/historico'
  ],
  3
)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    routes = EXCLUDED.routes,
    display_order = EXCLUDED.display_order;
