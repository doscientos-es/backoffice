-- Archive the actual document revision, including edits made while awaiting a response.
do $migration$
declare
  definition text := pg_get_functiondef('public.archive_reopened_proposal()'::regprocedure);
  previous text := $before$select coalesce(max(revision_number), 0) + 1 into v_revision_number
    from public.proposal_revisions where proposal_id = old.id;$before$;
begin
  if length(definition) - length(replace(definition, previous, '')) <> length(previous) then
    raise exception 'Unexpected archive_reopened_proposal definition';
  end if;
  execute replace(definition, previous, 'v_revision_number := old.document_revision;');
end;
$migration$;

create or replace function public.protect_issued_proposal_content()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare
  fields text[] := array[
    'title','currency','subtotal','tax_amount','total','valid_until','notes','demo_url',
    'context_markdown','problems','solutions','terms','legal_terms','scope_modules',
    'development_approach','deliverables','acceptance_criteria','payment_schedule','timeline',
    'payment_terms','change_management_terms','maintenance_options',
    'discount_type','discount_value','discount_reason','client_capacity','payment_plan'
  ];
  content_changed boolean;
begin
  select exists (
    select 1 from unnest(fields) as f(name)
    where to_jsonb(new) -> f.name is distinct from to_jsonb(old) -> f.name
  ) into content_changed;

  -- Accepted payment plans remain adjustable by the existing payment workflow.
  if old.status in ('accepted', 'rejected') and exists (
    select 1 from unnest(fields) as f(name)
    where (f.name <> 'payment_plan' or old.status = 'rejected')
      and to_jsonb(new) -> f.name is distinct from to_jsonb(old) -> f.name
  ) then
    raise exception 'La propuesta respondida no se puede modificar';
  end if;

  if new.document_revision is distinct from old.document_revision
     and not (old.status <> 'draft' and new.status = 'draft')
     and not (pg_trigger_depth() > 1 and old.status in ('sent', 'viewed', 'expired')
       and new.status = old.status and new.document_revision = old.document_revision + 1
       and to_jsonb(new) - 'document_revision' = to_jsonb(old) - 'document_revision') then
    raise exception 'La versión de propuesta no se puede modificar';
  end if;
  if not ((old.status = 'draft' and new.status in ('sent', 'accepted'))
      or (old.status <> 'draft' and new.status = 'draft'))
     and new.provider_signature is distinct from old.provider_signature then
    raise exception 'La firma de proveedor no se puede modificar';
  end if;

  if old.status in ('sent', 'viewed', 'expired') and content_changed then
    if new.status <> old.status then
      raise exception 'No se puede responder y modificar la propuesta a la vez';
    end if;
    new.document_revision := old.document_revision + 1;
  end if;
  return new;
end;
$$;

create or replace function public.protect_issued_proposal_capacity()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if old.status in ('accepted', 'rejected')
     and new.client_capacity is distinct from old.client_capacity then
    raise exception 'La propuesta respondida no se puede modificar';
  end if;
  return new;
end;
$$;

create or replace function public.protect_issued_proposal_children()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_status public.proposal_status;
  v_id uuid := case when tg_op = 'DELETE' then old.proposal_id else new.proposal_id end;
begin
  if tg_op = 'UPDATE' and old.proposal_id is distinct from new.proposal_id then
    raise exception 'No se pueden mover elementos entre propuestas';
  end if;
  select status into v_status from public.proposals where id = v_id for update;
  if v_status is null or v_status in ('accepted', 'rejected') then
    raise exception 'La propuesta respondida no se puede modificar';
  end if;
  if v_status in ('sent', 'viewed', 'expired') then
    update public.proposals set document_revision = document_revision + 1 where id = v_id;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- A child revision update must not invalidate the editor version returned by its RPC.
drop trigger trg_bump_proposals_version on public.proposals;
create trigger trg_bump_proposals_version before update on public.proposals
  for each row when (
    pg_trigger_depth() = 0
    or old.document_revision is not distinct from new.document_revision
    or to_jsonb(old) - 'document_revision' is distinct from to_jsonb(new) - 'document_revision'
  ) execute function public.fn_bump_record_version();

notify pgrst, 'reload schema';