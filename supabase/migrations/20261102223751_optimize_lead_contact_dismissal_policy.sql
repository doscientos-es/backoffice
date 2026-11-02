drop policy if exists lead_contact_suggestion_dismissals_insert
  on public.lead_contact_suggestion_dismissals;

create policy lead_contact_suggestion_dismissals_insert
  on public.lead_contact_suggestion_dismissals
  for insert with check (
    public.can_access_lead(lead_id)
    and public.has_permission('leads.write')
    and (dismissed_by is null or dismissed_by = (select auth.uid()))
  );
