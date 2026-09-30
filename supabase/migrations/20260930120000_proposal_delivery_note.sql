-- Albarán de entrega: el cliente firma la conformidad con lo acordado en la
-- propuesta y la propuesta queda terminada. El proyecto vinculado no se cierra.

alter table public.proposals
  add column if not exists delivered_at timestamptz;

comment on column public.proposals.delivered_at is
  'Firma del albarán de entrega por el cliente. La propuesta queda terminada; el proyecto sigue abierto.';

create unique index if not exists delivery_acceptances_one_signed_per_proposal
  on public.delivery_acceptances(proposal_id)
  where status = 'accepted';

create or replace function public.sign_delivery_acceptance(
  p_delivery_acceptance_id uuid,
  p_signer_name text,
  p_signer_role text,
  p_ip text,
  p_user_agent text
) returns timestamptz
language plpgsql
set search_path to 'public'
as $function$
declare
  v_delivery public.delivery_acceptances%rowtype;
  v_proposal public.proposals%rowtype;
  v_now timestamptz := now();
  v_ip inet;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  if nullif(btrim(p_signer_name), '') is null then
    raise exception 'Indica tu nombre completo';
  end if;

  select * into v_delivery from public.delivery_acceptances
    where id = p_delivery_acceptance_id for update;
  if not found then raise exception 'Albarán no encontrado'; end if;
  if v_delivery.status not in ('sent', 'viewed') then
    raise exception 'Este albarán ya no está disponible para su firma';
  end if;

  select * into v_proposal from public.proposals
    where id = v_delivery.proposal_id and deleted_at is null for update;
  if not found then raise exception 'Propuesta no encontrada'; end if;
  if v_proposal.status <> 'accepted' or v_proposal.delivered_at is not null then
    raise exception 'La propuesta no admite la firma del albarán';
  end if;

  begin
    v_ip := nullif(btrim(p_ip), '')::inet;
  exception when others then
    v_ip := null;
  end;

  update public.delivery_acceptances set
    status = 'accepted',
    accepted_at = v_now,
    accepted_by_name = btrim(p_signer_name),
    accepted_by_role = nullif(btrim(p_signer_role), ''),
    accepted_ip = v_ip,
    accepted_user_agent = nullif(btrim(p_user_agent), '')
  where id = v_delivery.id;

  insert into public.delivery_acceptance_events (
    delivery_acceptance_id, event_type, actor_type, actor_name, ip, user_agent, metadata
  ) values (
    v_delivery.id, 'accepted', 'client', btrim(p_signer_name), v_ip,
    nullif(btrim(p_user_agent), ''),
    jsonb_build_object('document_hash', v_delivery.document_hash)
  );

  update public.proposals set delivered_at = v_now where id = v_proposal.id;

  insert into public.activity_log(entity_type, entity_id, action, details)
  values ('proposal', v_proposal.id, 'delivery_accepted', jsonb_build_object(
    'delivery_acceptance_id', v_delivery.id,
    'accepted_at', v_now,
    'signer_name', btrim(p_signer_name),
    'document_hash', v_delivery.document_hash
  ));

  return v_now;
end;
$function$;

revoke all on function public.sign_delivery_acceptance(uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.sign_delivery_acceptance(uuid, text, text, text, text)
  to service_role;
