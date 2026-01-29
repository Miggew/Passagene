-- Atualização da função encerrar_sessao_te para verificar e atualizar
-- o status do protocolo quando todas as receptoras foram processadas

create or replace function public.encerrar_sessao_te(
  p_receptora_ids uuid[],
  p_protocolo_receptora_ids uuid[]
) returns void
language plpgsql
as $$
declare
  v_protocolo_id uuid;
  v_pendentes integer;
  v_utilizadas integer;
  v_novo_status text;
begin
  -- Atualizar status das receptoras para SERVIDA
  if p_receptora_ids is not null and array_length(p_receptora_ids, 1) > 0 then
    update receptoras
      set status_reprodutivo = 'SERVIDA'
    where id = any(p_receptora_ids)
      and (status_reprodutivo is null or status_reprodutivo not like 'PRENHE%');
  end if;

  -- Atualizar protocolo_receptoras para UTILIZADA
  if p_protocolo_receptora_ids is not null and array_length(p_protocolo_receptora_ids, 1) > 0 then
    update protocolo_receptoras
      set status = 'UTILIZADA'
    where id = any(p_protocolo_receptora_ids);

    -- Para cada protocolo afetado, verificar se todas as receptoras foram processadas
    for v_protocolo_id in (
      select distinct protocolo_id
      from protocolo_receptoras
      where id = any(p_protocolo_receptora_ids)
    )
    loop
      -- Contar receptoras pendentes (APTA ou INICIADA)
      select count(*) into v_pendentes
      from protocolo_receptoras
      where protocolo_id = v_protocolo_id
        and status in ('APTA', 'INICIADA');

      -- Se não há pendentes, atualizar status do protocolo
      if v_pendentes = 0 then
        -- Contar receptoras utilizadas (TE realizada)
        select count(*) into v_utilizadas
        from protocolo_receptoras
        where protocolo_id = v_protocolo_id
          and status = 'UTILIZADA';

        -- Definir novo status: EM_TE se alguma foi utilizada, FECHADO se todas INAPTA
        v_novo_status := case when v_utilizadas > 0 then 'EM_TE' else 'FECHADO' end;

        update protocolos_sincronizacao
          set status = v_novo_status
        where id = v_protocolo_id
          and status = 'SINCRONIZADO';
      end if;
    end loop;
  end if;
end;
$$;
