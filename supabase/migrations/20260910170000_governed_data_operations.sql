-- Governed data operations: immutable business audit and privacy controls.
-- This migration is additive and deliberately avoids altering historical data.

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_id uuid references public.team_members(id) on delete set null,
  actor_role text,
  entity_type text not null,
  entity_id text,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  origin text not null default 'backoffice',
  request_id text,
  ip inet,
  outcome text not null default 'success' check (outcome in ('success', 'failure'))
);

create index if not exists audit_events_entity_idx
  on public.audit_events(entity_type, entity_id, occurred_at desc);
create index if not exists audit_events_actor_idx
  on public.audit_events(actor_id, occurred_at desc) where actor_id is not null;

alter table public.audit_events enable row level security;
revoke all on public.audit_events from anon, authenticated;
grant select on public.audit_events to authenticated;

drop policy if exists audit_events_select on public.audit_events;
create policy audit_events_select on public.audit_events
  for select using (public.current_member_role() in ('owner', 'admin'));

-- Redacts nested credentials and direct identifiers before they can be persisted
-- in the audit log. The original business rows remain the source of truth.
create or replace function public.audit_redact(value jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  result jsonb;
begin
  if jsonb_typeof(value) = 'object' then
    select coalesce(jsonb_object_agg(
      key,
      case
        when key ~* '(password|passphrase|secret|token|api[_-]?key|private[_-]?key|credential|email|phone|nif|address|notes|body|raw_payload)'
          then to_jsonb('[redacted]'::text)
        else public.audit_redact(item)
      end
    ), '{}'::jsonb)
    into result
    from jsonb_each(value) as fields(key, item);
    return result;
  end if;

  if jsonb_typeof(value) = 'array' then
    select coalesce(jsonb_agg(public.audit_redact(item)), '[]'::jsonb)
    into result
    from jsonb_array_elements(value) as elements(item);
    return result;
  end if;

  return value;
end;
$$;

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  changed_row jsonb;
begin
  changed_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;

  insert into public.audit_events (
    actor_id, actor_role, entity_type, entity_id, action,
    before_data, after_data, origin
  ) values (
    auth.uid(),
    public.current_member_role()::text,
    tg_table_name,
    changed_row->>'id',
    lower(tg_op),
    case when tg_op in ('UPDATE', 'DELETE') then public.audit_redact(to_jsonb(old)) end,
    case when tg_op in ('INSERT', 'UPDATE') then public.audit_redact(to_jsonb(new)) end,
    case when auth.uid() is null then 'system' else 'backoffice' end
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'team_members', 'settings', 'leads', 'clients', 'projects', 'proposals',
    'invoices', 'expenses', 'tasks', 'work_logs', 'internal_documents',
    'web_projects', 'social_posts'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('drop trigger if exists trg_audit_%1$I on public.%1$I', table_name);
      execute format(
        'create trigger trg_audit_%1$I after insert or update or delete on public.%1$I for each row execute function public.audit_row_change()',
        table_name
      );
    end if;
  end loop;
end;
$$;

create table if not exists public.privacy_data_inventory (
  entity_type text primary key,
  pii_fields text[] not null,
  retention_basis text not null,
  default_retention_days integer check (default_retention_days is null or default_retention_days > 0),
  erasure_strategy text not null check (erasure_strategy in ('anonymize', 'legal_review', 'retain')),
  updated_at timestamptz not null default now()
);

insert into public.privacy_data_inventory
  (entity_type, pii_fields, retention_basis, default_retention_days, erasure_strategy)
values
  ('lead', array['name', 'email', 'phone', 'company', 'notes', 'raw_payload'], 'legitimate_interest', 730, 'anonymize'),
  ('client', array['name', 'email', 'phone', 'billing_address', 'contact_person', 'notes'], 'contract_or_legal_obligation', null, 'legal_review'),
  ('team_member', array['name', 'email', 'phone', 'contact_email'], 'employment_or_service_relationship', null, 'legal_review')
on conflict (entity_type) do update set
  pii_fields = excluded.pii_fields,
  retention_basis = excluded.retention_basis,
  default_retention_days = excluded.default_retention_days,
  erasure_strategy = excluded.erasure_strategy,
  updated_at = now();

create table if not exists public.privacy_legal_holds (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid,
  reason text not null,
  created_by uuid references public.team_members(id) on delete set null,
  created_at timestamptz not null default now(),
  released_by uuid references public.team_members(id) on delete set null,
  released_at timestamptz
);
create index if not exists privacy_legal_holds_active_idx
  on public.privacy_legal_holds(entity_type, entity_id) where released_at is null;

create table if not exists public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('lead', 'client', 'team_member')),
  subject_id uuid not null,
  requester_email text,
  request_type text not null check (request_type in ('access', 'erasure')),
  status text not null default 'received' check (status in ('received', 'verified', 'processing', 'completed', 'blocked', 'rejected')),
  requested_at timestamptz not null default now(),
  identity_verified_at timestamptz,
  scheduled_for timestamptz,
  processed_at timestamptz,
  requested_by uuid references public.team_members(id) on delete set null,
  processed_by uuid references public.team_members(id) on delete set null,
  result_summary text,
  internal_notes text
);
create index if not exists privacy_requests_due_idx
  on public.privacy_requests(status, scheduled_for) where scheduled_for is not null;

create table if not exists public.data_processing_consents (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null,
  subject_id uuid not null,
  purpose text not null,
  granted boolean not null,
  captured_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  source text not null,
  recorded_by uuid references public.team_members(id) on delete set null,
  evidence jsonb not null default '{}'::jsonb
);
create index if not exists data_processing_consents_subject_idx
  on public.data_processing_consents(subject_type, subject_id, purpose, captured_at desc);

alter table public.leads
  add column if not exists marketing_consent boolean not null default false,
  add column if not exists marketing_consent_at timestamptz,
  add column if not exists marketing_consent_withdrawn_at timestamptz;

alter table public.privacy_data_inventory enable row level security;
alter table public.privacy_legal_holds enable row level security;
alter table public.privacy_requests enable row level security;
alter table public.data_processing_consents enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'privacy_data_inventory', 'privacy_legal_holds', 'privacy_requests', 'data_processing_consents'
  ] loop
    execute format('drop policy if exists %1$I_select on public.%1$I', table_name);
    execute format(
      'create policy %1$I_select on public.%1$I for select using (public.current_member_role() in (''owner'', ''admin''))',
      table_name
    );
    execute format('drop policy if exists %1$I_mutate on public.%1$I', table_name);
    execute format(
      'create policy %1$I_mutate on public.%1$I for all using (public.current_member_role() in (''owner'', ''admin'')) with check (public.current_member_role() in (''owner'', ''admin''))',
      table_name
    );
  end loop;
end;
$$;

comment on table public.audit_events is 'Central append-only, redacted record of material business events.';
comment on table public.privacy_requests is 'Auditable data-subject access and erasure workflow. Erasure is blocked by active legal holds.';