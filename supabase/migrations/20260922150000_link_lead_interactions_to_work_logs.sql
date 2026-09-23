-- Count client calls and meetings as project work when they have a duration.
-- The interaction remains the source of truth; the work log is a projection
-- used by project profitability and hourly billing.

alter table public.work_logs
  add column if not exists source_interaction_id uuid
    references public.lead_interactions(id) on delete set null;

create unique index if not exists work_logs_source_interaction_uniq
  on public.work_logs(source_interaction_id)
  where source_interaction_id is not null;

create or replace function public.resolve_interaction_project()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_project_id uuid;
begin
  -- If the caller did not choose a project, use the lead's only active
  -- project. With multiple projects we deliberately leave it unassigned.
  if new.project_id is null and new.lead_id is not null then
    select min(p.id) into v_project_id
    from public.projects p
    join public.clients c on c.id = p.client_id
    where c.lead_id = new.lead_id
      and c.deleted_at is null
      and p.deleted_at is null
      and p.status <> 'cancelled'
    having count(*) = 1;
    new.project_id := v_project_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_resolve_interaction_project on public.lead_interactions;
create trigger trg_resolve_interaction_project
before insert or update of project_id, lead_id on public.lead_interactions
for each row execute function public.resolve_interaction_project();

create or replace function public.sync_interaction_work_log()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_minutes numeric;
  v_date date;
begin
  if new.type not in ('call', 'meeting') or new.performed_by is null then
    return new;
  end if;

  if new.type = 'call' then
    v_minutes := nullif(new.payload ->> 'duration_minutes', '')::numeric;
    v_date := coalesce(nullif(new.payload ->> 'call_date', '')::date, (new.created_at at time zone 'Europe/Madrid')::date);
  else
    v_minutes := extract(epoch from ((new.payload ->> 'end')::timestamptz - (new.payload ->> 'start')::timestamptz)) / 60;
    v_date := coalesce(((new.payload ->> 'start')::timestamptz at time zone 'Europe/Madrid')::date, (new.created_at at time zone 'Europe/Madrid')::date);
  end if;

  if v_minutes is null or v_minutes <= 0 or new.project_id is null then
    update public.work_logs
       set deleted_at = now(), updated_at = now()
     where source_interaction_id = new.id and deleted_at is null;
    return new;
  end if;

  insert into public.work_logs (project_id, member_id, work_date, hours, note, source_interaction_id)
  values (
    new.project_id,
    new.performed_by,
    v_date,
    round(v_minutes / 60, 2),
    case when new.type = 'call' then 'Llamada: ' else 'Reunión: ' end || coalesce(new.subject, 'Interacción con lead'),
    new.id
  )
  on conflict (source_interaction_id) where source_interaction_id is not null
  do update set
    project_id = excluded.project_id,
    member_id = excluded.member_id,
    work_date = excluded.work_date,
    hours = excluded.hours,
    note = excluded.note,
    deleted_at = null,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists trg_sync_interaction_work_log on public.lead_interactions;
create trigger trg_sync_interaction_work_log
after insert or update of project_id, performed_by, payload, subject on public.lead_interactions
for each row execute function public.sync_interaction_work_log();
