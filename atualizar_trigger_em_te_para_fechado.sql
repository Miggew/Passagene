-- ============================================================================
-- Atualizar trigger trg_te_realizada_after_insert para mudar status para FECHADO
-- em vez de EM_TE quando uma TE é realizada
-- ============================================================================

-- Atualizar a função do trigger
CREATE OR REPLACE FUNCTION public.trg_te_realizada_after_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
declare
  v_protocolo_id uuid;
begin
  -- só age quando é TE realizada
  if new.status_te is distinct from 'REALIZADA' then
    return new;
  end if;

  -- marca a receptora do protocolo como UTILIZADA e limpa motivo
  update public.protocolo_receptoras
  set status = 'UTILIZADA',
      motivo_inapta = null
  where id = new.protocolo_receptora_id;

  -- atualiza status do embrião
  update public.embrioes
  set status_atual = 'TRANSFERIDO'
  where id = new.embriao_id;

  -- pega o protocolo_id e marca protocolo como FECHADO (mudança de EM_TE para FECHADO)
  select pr.protocolo_id into v_protocolo_id
  from public.protocolo_receptoras pr
  where pr.id = new.protocolo_receptora_id;

  update public.protocolos_sincronizacao
  set status = 'FECHADO'
  where id = v_protocolo_id
    and status <> 'FECHADO';

  return new;
end $function$;

-- Verificar se o trigger já existe e está associado corretamente
SELECT 
    tgname AS trigger_name,
    tgrelid::regclass AS table_name,
    pg_get_triggerdef(oid) AS trigger_definition
FROM pg_trigger
WHERE tgname = 'trg_te_realizada_after_insert';

-- Verificar a função atualizada
SELECT 
    p.proname AS function_name,
    pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'trg_te_realizada_after_insert';
