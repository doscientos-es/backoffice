-- Preserve existing invoice validation and idempotency; identify prorated upgrades on the invoice.
do $migration$
declare
  definition text := pg_get_functiondef('public.issue_abaco_subscription_invoice(jsonb,jsonb)'::regprocedure);
  old_concept constant text := $old$concept := concat('Suscripción Ábaco · ', p_event->>'plan', ' · ',$old$;
  new_concept constant text := $new$concept := concat(case p_event->>'chargeType'
    when 'ai_upgrade' then 'Ampliación de IA Ábaco'
    when 'plan_upgrade' then 'Ampliación de plan Ábaco'
    when 'workers_upgrade' then 'Ampliación de módulo Equipo Ábaco'
    when 'procurement_upgrade' then 'Ampliación de módulo Compras Ábaco'
    when 'mcp_upgrade' then 'Ampliación de módulo MCP Ábaco'
    else 'Suscripción Ábaco' end, ' · ', p_event->>'plan', ' · ',$new$;
  old_guard constant text := $old$  if payment is null or tenant is null or v_paid_at is null or v_paid_at > now()$old$;
  new_guard constant text := $new$  if p_event ? 'chargeType' and coalesce(p_event->>'chargeType','') not in
    ('ai_upgrade','plan_upgrade','workers_upgrade','procurement_upgrade','mcp_upgrade') then
    raise exception 'Tipo de ampliación no válido' using errcode = '22023';
  end if;
  if payment is null or tenant is null or v_paid_at is null or v_paid_at > now()$new$;
begin
  if position(old_concept in definition) = 0 or position(old_guard in definition) = 0 then
    raise exception 'No coincide la función fiscal esperada';
  end if;
  execute replace(replace(definition, old_concept, new_concept), old_guard, new_guard);
end;
$migration$;