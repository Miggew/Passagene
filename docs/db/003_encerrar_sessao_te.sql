create or replace function public.encerrar_sessao_te(
  p_receptora_ids uuid[],
  p_protocolo_receptora_ids uuid[]
) returns void
language plpgsql
as $$
begin
  if p_receptora_ids is not null and array_length(p_receptora_ids, 1) > 0 then
    update receptoras
      set status_reprodutivo = 'SERVIDA'
    where id = any(p_receptora_ids)
      and (status_reprodutivo is null or status_reprodutivo not like 'PRENHE%');
  end if;

  if p_protocolo_receptora_ids is not null and array_length(p_protocolo_receptora_ids, 1) > 0 then
    update protocolo_receptoras
      set status = 'UTILIZADA'
    where id = any(p_protocolo_receptora_ids);
  end if;
end;
$$;
