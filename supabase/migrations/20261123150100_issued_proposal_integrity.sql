-- Preserve the document version independently from the optimistic edit token.
alter table public.proposals
  add column document_revision integer not null default 1 check (document_revision > 0),
  add column provider_signature jsonb;
update public.proposals p
set document_revision = r.last_revision + 1
from (select proposal_id, max(revision_number) as last_revision
      from public.proposal_revisions group by proposal_id) r
where p.id = r.proposal_id;

alter table public.settings
  add column proposal_default_signer_id uuid references public.team_members(id) on delete set null;
-- The requested fallback is Pol, but never guess if the name is ambiguous.
update public.settings set proposal_default_signer_id = (
  select min(id::text)::uuid from public.team_members
  where role = 'owner' and deleted_at is null
    and (lower(name) = 'pol' or lower(name) like 'pol %')
  having count(*) = 1
) where id = 1;

create or replace function public.archive_reopened_proposal()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_revision_number integer;
  v_items jsonb;
  v_team jsonb;
  v_recipient jsonb;
  v_provider jsonb;
begin
  if old.status = 'draft' or new.status = old.status then return new; end if;
  -- Older deployments request sent when reopening an answered proposal.
  if old.status in ('accepted', 'rejected') and new.status = 'sent' then
    new.status := 'draft';
  end if;
  if new.status <> 'draft' then
    if old.status in ('accepted', 'rejected') then
      raise exception 'Reabre la propuesta antes de cambiar su respuesta';
    end if;
    return new;
  end if;
  if old.delivered_at is not null then raise exception 'La propuesta ya está terminada'; end if;

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
  ) into v_recipient from (select 1) seed
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
  new.document_revision := v_revision_number + 1;
  new.provider_signature := null;
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

-- Copy, do not reference, the signature that was selected at issuance.
create function public.capture_issued_proposal_signature()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_assignee uuid; v_fallback uuid; v_signature jsonb;
begin
  if old.status = 'draft' and new.status in ('sent', 'accepted') then
    select assigned_to into v_assignee from public.leads
      where id = coalesce(new.lead_id, (select lead_id from public.clients where id = new.client_id));
    select proposal_default_signer_id into v_fallback from public.settings where id = 1;
    select jsonb_build_object('member_id', m.id, 'name', m.name, 'job_title', m.job_title,
                              'drawing', s.signature)
      into v_signature
      from public.team_members m join public.team_member_signatures s on s.member_id = m.id
      where m.deleted_at is null and m.id in (v_assignee, v_fallback)
      order by case when m.id = v_assignee then 0 else 1 end limit 1;
    new.provider_signature := v_signature;
  end if;
  return new;
end;
$$;
create trigger capture_issued_proposal_signature before update of status on public.proposals
  for each row execute function public.capture_issued_proposal_signature();

-- Content and its issuance evidence are frozen until the row is reopened.
create function public.protect_issued_proposal_content()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare fields text[] := array[
  'title','currency','subtotal','tax_amount','total','valid_until','notes','demo_url',
  'context_markdown','problems','solutions','terms','legal_terms','scope_modules',
  'development_approach','deliverables','acceptance_criteria','payment_schedule',
  'payment_terms','change_management_terms','maintenance_options',
  'discount_type','discount_value','discount_reason'
];
begin
  if old.status <> 'draft' and exists (
    select 1 from unnest(fields) as f(name)
    where to_jsonb(new) -> f.name is distinct from to_jsonb(old) -> f.name
  ) then
    raise exception 'Reabre la propuesta para modificar su contenido';
  end if;
  if old.status not in ('draft', 'accepted') and new.payment_plan is distinct from old.payment_plan then
    raise exception 'Reabre la propuesta para modificar su calendario';
  end if;
  if not (old.status <> 'draft' and new.status = 'draft')
     and new.document_revision is distinct from old.document_revision then
    raise exception 'La versión de propuesta no se puede modificar';
  end if;
  if not ((old.status = 'draft' and new.status in ('sent', 'accepted'))
      or (old.status <> 'draft' and new.status = 'draft'))
     and new.provider_signature is distinct from old.provider_signature then
    raise exception 'La firma de proveedor no se puede modificar';
  end if;
  return new;
end;
$$;
create trigger protect_issued_proposal_content before update on public.proposals
  for each row execute function public.protect_issued_proposal_content();

create function public.protect_issued_proposal_children()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_status public.proposal_status;
begin
  if tg_op = 'UPDATE' and old.proposal_id is distinct from new.proposal_id then
    raise exception 'No se pueden mover elementos entre propuestas';
  end if;
  select status into v_status from public.proposals
    where id = case when tg_op = 'DELETE' then old.proposal_id else new.proposal_id end for update;
  if v_status is distinct from 'draft'::public.proposal_status then
    raise exception 'Reabre la propuesta para modificar su contenido';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
create trigger protect_issued_proposal_items before insert or update or delete on public.proposal_items
  for each row execute function public.protect_issued_proposal_children();
create trigger protect_issued_proposal_team before insert or update or delete on public.proposal_team_members
  for each row execute function public.protect_issued_proposal_children();

-- Keep the original RPC for old deployments; the new app calls this versioned
-- entry point, which checks under the same row lock as acceptance.
create function public.accept_proposal_with_evidence_versioned(
  p_proposal_id uuid, p_document_revision integer, p_accepted_at timestamptz,
  p_signer_name text, p_signer_role text, p_consent_text text, p_evidence_version text,
  p_document_snapshot jsonb, p_document_hash text, p_portal_token_hash text,
  p_ip text, p_user_agent text
) returns void language plpgsql security invoker set search_path = public as $$
declare v_proposal public.proposals%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'Not authorised' using errcode = '42501'; end if;
  select * into v_proposal from public.proposals where id = p_proposal_id and deleted_at is null for update;
  if not found or v_proposal.document_revision <> p_document_revision then
    raise exception 'La propuesta ha cambiado. Actualiza la página antes de firmar';
  end if;
  if coalesce(p_document_snapshot -> 'provider_signature', 'null'::jsonb)
     is distinct from coalesce(v_proposal.provider_signature, 'null'::jsonb) then
    raise exception 'La firma del proveedor no coincide con la versión emitida';
  end if;
  perform public.accept_proposal_with_evidence(p_proposal_id, p_accepted_at, p_signer_name,
    p_signer_role, p_consent_text, p_evidence_version, p_document_snapshot, p_document_hash,
    p_portal_token_hash, p_ip, p_user_agent);
end;
$$;
revoke all on function public.accept_proposal_with_evidence_versioned(uuid, integer, timestamptz, text, text, text, text, jsonb, text, text, text, text) from public, anon, authenticated;
grant execute on function public.accept_proposal_with_evidence_versioned(uuid, integer, timestamptz, text, text, text, text, jsonb, text, text, text, text) to service_role;
notify pgrst, 'reload schema';
