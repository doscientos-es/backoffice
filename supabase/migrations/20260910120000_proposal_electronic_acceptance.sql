-- Durable evidence for each electronic acceptance. Reopened proposals retain
-- their past acceptance records, so the commercial history is never overwritten.
create table if not exists public.proposal_acceptances (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete restrict,
  accepted_at timestamptz not null,
  signer_name text not null check (char_length(btrim(signer_name)) between 2 and 160),
  signer_role text check (signer_role is null or char_length(btrim(signer_role)) between 1 and 160),
  authority_declared boolean not null default true check (authority_declared),
  consent_text text not null,
  evidence_version text not null,
  document_snapshot jsonb not null,
  document_hash text not null check (document_hash ~ '^[a-f0-9]{64}$'),
  portal_token_hash text not null check (portal_token_hash ~ '^[a-f0-9]{64}$'),
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists proposal_acceptances_proposal_accepted_idx
  on public.proposal_acceptances(proposal_id, accepted_at desc);

alter table public.proposal_acceptances enable row level security;
drop policy if exists proposal_acceptances_team_select on public.proposal_acceptances;
create policy proposal_acceptances_team_select on public.proposal_acceptances
  for select using (public.is_team_member());

-- Acceptance evidence is append-only. Retention/deletion requests must follow
-- the organisation's documented legal-retention process, not an app mutation.
create or replace function public.prevent_proposal_acceptance_mutation()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'Proposal acceptance evidence is append-only';
end;
$$;

drop trigger if exists trg_prevent_proposal_acceptance_mutation on public.proposal_acceptances;
create trigger trg_prevent_proposal_acceptance_mutation
  before update or delete on public.proposal_acceptances
  for each row execute function public.prevent_proposal_acceptance_mutation();

create or replace function public.accept_proposal_with_evidence(
  p_proposal_id uuid,
  p_accepted_at timestamptz,
  p_signer_name text,
  p_signer_role text,
  p_consent_text text,
  p_evidence_version text,
  p_document_snapshot jsonb,
  p_document_hash text,
  p_portal_token_hash text,
  p_ip text,
  p_user_agent text
)
returns void language plpgsql security invoker set search_path = public as $$
declare v_proposal public.proposals%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  select * into v_proposal from public.proposals
    where id = p_proposal_id and deleted_at is null for update;
  if not found then raise exception 'Propuesta no encontrada'; end if;
  if v_proposal.status not in ('sent', 'viewed') then
    raise exception 'Esta propuesta ya no está disponible para su aceptación';
  end if;

  insert into public.proposal_acceptances (
    proposal_id, accepted_at, signer_name, signer_role, consent_text,
    evidence_version, document_snapshot, document_hash, portal_token_hash, ip, user_agent
  ) values (
    p_proposal_id, p_accepted_at, btrim(p_signer_name), nullif(btrim(p_signer_role), ''),
    p_consent_text, p_evidence_version, p_document_snapshot, p_document_hash,
    p_portal_token_hash, nullif(btrim(p_ip), ''), nullif(btrim(p_user_agent), '')
  );

  update public.proposals set status = 'accepted', responded_at = p_accepted_at
    where id = p_proposal_id;
  insert into public.activity_log(entity_type, entity_id, action, details)
  values ('proposal', p_proposal_id, 'accepted_electronically', jsonb_build_object(
    'accepted_at', p_accepted_at, 'signer_name', btrim(p_signer_name),
    'document_hash', p_document_hash, 'evidence_version', p_evidence_version
  ));
end;
$$;

revoke all on function public.accept_proposal_with_evidence(uuid, timestamptz, text, text, text, text, jsonb, text, text, text, text) from public, anon, authenticated;
grant execute on function public.accept_proposal_with_evidence(uuid, timestamptz, text, text, text, text, jsonb, text, text, text, text) to service_role;