-- Archive the current response before reopening, in the same transaction as
-- the status change. The live row and its public token remain stable.
create table public.proposal_revisions (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete restrict,
  revision_number integer not null check (revision_number > 0),
  archived_at timestamptz not null default now(),
  archived_by uuid,
  snapshot jsonb not null,
  unique (proposal_id, revision_number)
);

alter table public.proposal_revisions enable row level security;
revoke all on public.proposal_revisions from public, anon, authenticated;
grant select on public.proposal_revisions to authenticated;
create policy proposal_revisions_admin_select on public.proposal_revisions
  for select to authenticated
  using (public.current_member_role()::text in ('owner', 'admin')
    and public.can_access_proposal(proposal_id));

create function public.prevent_proposal_revision_mutation()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  raise exception 'Proposal revisions are immutable';
end;
$$;

create trigger proposal_revisions_immutable
  before update or delete on public.proposal_revisions
  for each row execute function public.prevent_proposal_revision_mutation();

create function public.archive_reopened_proposal()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_revision_number integer;
  v_items jsonb;
  v_team jsonb;
  v_recipient jsonb;
  v_provider jsonb;
begin
  if old.status not in ('accepted', 'rejected') or new.status = old.status then
    return new;
  end if;
  if new.status not in ('draft', 'sent') then
    raise exception 'Reabre la propuesta antes de cambiar su respuesta';
  end if;
  if old.delivered_at is not null then
    raise exception 'La propuesta ya está terminada';
  end if;

  select coalesce(max(revision_number), 0) + 1 into v_revision_number
    from public.proposal_revisions where proposal_id = old.id;
  select coalesce(jsonb_agg(to_jsonb(i) order by i.position), '[]'::jsonb) into v_items
    from public.proposal_items i where i.proposal_id = old.id;
  select coalesce(jsonb_agg(to_jsonb(t) order by t.position), '[]'::jsonb) into v_team
    from public.proposal_team_members t where t.proposal_id = old.id;
  select jsonb_build_object(
    'name', coalesce(c.name, l.company, l.name), 'nif', c.nif,
    'street', c.billing_address_street, 'zip', c.billing_address_zip,
    'city', c.billing_address_city, 'province', c.billing_address_province,
    'country', c.billing_address_country
  ) into v_recipient
  from (select 1) seed
    left join public.clients c on c.id = old.client_id
    left join public.leads l on l.id = old.lead_id;
  select jsonb_build_object(
    'name', company_name, 'nif', company_nif, 'iban', iban,
    'street', company_address_street, 'zip', company_address_zip,
    'city', company_address_city, 'province', company_address_province,
    'country', company_address_country
  ) into v_provider from public.settings where id = 1;

  insert into public.proposal_revisions (proposal_id, revision_number, archived_by, snapshot)
  values (old.id, v_revision_number, auth.uid(), jsonb_build_object(
    'proposal', to_jsonb(old) - array['portal_token', 'portal_password_hash', 'mcp_idempotency_key'],
    'items', v_items, 'team', v_team, 'recipient', v_recipient, 'provider', v_provider
  ));

  -- Also protects deployments running an older application which requests sent.
  new.status := 'draft';
  new.sent_at := null;
  new.viewed_at := null;
  new.responded_at := null;
  new.signature_data := null;
  new.accepted_fiscal_data := null;
  new.acceptance_email_sent_at := null;
  new.acceptance_email_recipient := null;
  new.acceptance_email_resend_id := null;
  return new;
end;
$$;

create trigger archive_reopened_proposal
  before update of status on public.proposals
  for each row execute function public.archive_reopened_proposal();