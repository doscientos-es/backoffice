-- Heavy Meet texts (transcript, Gemini notes) live outside lead_interactions.payload so the lead
-- page, which reads every interaction payload, no longer downloads them on each visit.
create table if not exists public.lead_interaction_artifacts (
  interaction_id uuid primary key references public.lead_interactions(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  transcript_text text,
  notes_text text,
  transcript_truncated boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists lead_interaction_artifacts_lead_idx
  on public.lead_interaction_artifacts (lead_id);

alter table public.lead_interaction_artifacts enable row level security;
revoke all on public.lead_interaction_artifacts from anon, authenticated;
grant select on public.lead_interaction_artifacts to authenticated;

-- Writes come from the importer with the service role, which bypasses RLS.
create policy lead_interaction_artifacts_select
  on public.lead_interaction_artifacts
  for select using (public.can_access_lead(lead_id));

-- Copy the existing texts, then strip them from the payload and leave light flags behind.
insert into public.lead_interaction_artifacts
  (interaction_id, lead_id, transcript_text, notes_text, transcript_truncated)
select
  li.id,
  li.lead_id,
  nullif(li.payload->'meet_artifacts'->>'transcript_text', ''),
  nullif(li.payload->'meet_artifacts'->>'notes_text', ''),
  coalesce(length(li.payload->'meet_artifacts'->>'transcript_text'), 0) >= 100000
from public.lead_interactions li
where li.type = 'meeting'
  and (li.payload->'meet_artifacts' ? 'transcript_text' or li.payload->'meet_artifacts' ? 'notes_text')
on conflict (interaction_id) do nothing;

update public.lead_interactions li
set payload = jsonb_set(
  li.payload,
  '{meet_artifacts}',
  ((li.payload->'meet_artifacts') - array['transcript_text', 'notes_text']) || jsonb_build_object(
    'has_transcript', coalesce(length(li.payload->'meet_artifacts'->>'transcript_text'), 0) > 0,
    'has_notes', coalesce(length(li.payload->'meet_artifacts'->>'notes_text'), 0) > 0,
    'transcript_truncated',
      coalesce(length(li.payload->'meet_artifacts'->>'transcript_text'), 0) >= 100000
  )
)
where li.type = 'meeting'
  and (li.payload->'meet_artifacts' ? 'transcript_text' or li.payload->'meet_artifacts' ? 'notes_text')
  and exists (
    select 1 from public.lead_interaction_artifacts a where a.interaction_id = li.id
  );
