-- Keep the acceptance deadline authoritative inside the transaction that
-- records the legal evidence; app-level checks alone cannot close a race.
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
  if v_proposal.valid_until is not null and v_proposal.valid_until < current_date then
    raise exception 'Propuesta expirada';
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

-- Ensure a public rejection cannot overwrite an acceptance completed by a
-- concurrent request after the portal action initially read the proposal.
create or replace function public.reject_proposal_from_portal(
  p_proposal_id uuid,
  p_rejected_at timestamptz,
  p_rejection_reason text
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
    raise exception 'Esta propuesta ya no está disponible para su rechazo';
  end if;
  if v_proposal.valid_until is not null and v_proposal.valid_until < current_date then
    raise exception 'Propuesta expirada';
  end if;

  update public.proposals
    set status = 'rejected', responded_at = p_rejected_at,
        signature_data = case when p_rejection_reason is null then signature_data
          else jsonb_build_object('rejection_reason', p_rejection_reason) end
    where id = p_proposal_id;
  insert into public.activity_log(entity_type, entity_id, action, details)
  values ('proposal', p_proposal_id, 'rejected_from_portal', jsonb_build_object(
    'rejected_at', p_rejected_at,
    'has_rejection_reason', p_rejection_reason is not null
  ));
end;
$$;

-- Serialise deposits per proposal without rewriting historical payments. A
-- failed transaction may be retried; pending and confirmed ones are exclusive.
create or replace function public.create_proposal_deposit_payment(
  p_proposal_id uuid,
  p_amount numeric
)
returns table (redsys_order text)
language plpgsql security invoker set search_path = public as $$
declare v_proposal public.proposals%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Importe de señal no válido';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_proposal_id::text, 0));
  select * into v_proposal from public.proposals
    where id = p_proposal_id and deleted_at is null for update;
  if not found or v_proposal.status <> 'accepted' then
    raise exception 'Propuesta no disponible para pago';
  end if;
  if exists (
    select 1 from public.invoice_payments
    where proposal_id = p_proposal_id and status in ('pending', 'confirmed')
  ) then
    raise exception 'Ya existe un pago de señal pendiente o confirmado';
  end if;

  insert into public.invoice_payments (proposal_id, amount)
  values (p_proposal_id, p_amount)
  returning invoice_payments.redsys_order into redsys_order;
  return next;
end;
$$;

revoke all on function public.create_proposal_deposit_payment(uuid, numeric) from public, anon, authenticated;
grant execute on function public.create_proposal_deposit_payment(uuid, numeric) to service_role;
revoke all on function public.reject_proposal_from_portal(uuid, timestamptz, text) from public, anon, authenticated;
grant execute on function public.reject_proposal_from_portal(uuid, timestamptz, text) to service_role;