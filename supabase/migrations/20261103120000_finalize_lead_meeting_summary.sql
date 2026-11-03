-- New imports keep summary + Google links only. Existing archived texts are untouched.
-- Lock the interaction to make automatic task creation atomic and safe on concurrent retries.
create or replace function public.finalize_lead_meeting_summary(
  p_interaction_id uuid,
  p_artifacts jsonb,
  p_steps text[] default array[]::text[]
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_meeting public.lead_interactions%rowtype;
  v_assignee uuid;
  v_creator uuid;
  v_step text;
  v_task_id uuid;
  v_task_ids uuid[] := array[]::uuid[];
begin
  if p_artifacts is null or jsonb_typeof(p_artifacts) <> 'object'
    or nullif(btrim(p_artifacts->>'summary'), '') is null
    or length(p_artifacts->>'summary') > 8000
    or nullif(p_artifacts->>'processed_at', '') is null
    or p_artifacts ?| array['notes_text', 'transcript_text'] then
    raise exception 'A summary and processing timestamp, without raw texts, are required';
  end if;
  if coalesce(cardinality(p_steps), 0) > 8 then
    raise exception 'At most 8 next steps are allowed';
  end if;

  select * into v_meeting from public.lead_interactions
    where id = p_interaction_id and type = 'meeting' for update;
  if not found then raise exception 'Meeting not found'; end if;
  if v_meeting.payload->'meet_artifacts'->>'processed_at' is not null then
    return jsonb_build_object('processed', false);
  end if;

  -- Keep the stated responsible person in the text. Internal tracking belongs to the lead owner.
  select tm.id into v_assignee from public.leads l
    join public.team_members tm on tm.id = l.assigned_to and tm.deleted_at is null
    where l.id = v_meeting.lead_id;
  select id into v_creator from public.team_members
    where id = v_meeting.performed_by and deleted_at is null;
  v_assignee := coalesce(v_assignee, v_creator);
  v_creator := coalesce(v_creator, v_assignee);

  for v_step in
    select min(btrim(step)) from unnest(coalesce(p_steps, array[]::text[])) as s(step)
    where nullif(btrim(step), '') is not null
    group by lower(btrim(step)) order by min(btrim(step))
  loop
    insert into public.tasks (
      kind, lead_id, title, description, status, priority, assignee_id, created_by, is_client_visible
    ) values (
      'task', v_meeting.lead_id, left(v_step, 200),
      'Creada automáticamente desde la reunión ' || p_interaction_id::text || E'.\n\n' || left(v_step, 7500),
      'todo', 'medium', v_assignee, v_creator, false
    ) returning id into v_task_id;
    if v_assignee is not null then
      insert into public.task_members(task_id, member_id) values (v_task_id, v_assignee);
    end if;
    v_task_ids := array_append(v_task_ids, v_task_id);
  end loop;

  update public.lead_interactions set payload = jsonb_set(
    coalesce(v_meeting.payload, '{}'::jsonb), '{meet_artifacts}',
    p_artifacts || jsonb_build_object(
      'storage_mode', 'summary_only', 'has_notes', false, 'has_transcript', false,
      'transcript_truncated', false, 'task_ids', to_jsonb(v_task_ids)
    )
  ) where id = p_interaction_id;
  return jsonb_build_object('processed', true, 'task_ids', to_jsonb(v_task_ids));
end;
$$;

revoke all on function public.finalize_lead_meeting_summary(uuid, jsonb, text[]) from public, anon, authenticated;
grant execute on function public.finalize_lead_meeting_summary(uuid, jsonb, text[]) to service_role;