create index if not exists lead_contact_suggestion_dismissals_dismissed_by_idx
  on public.lead_contact_suggestion_dismissals (dismissed_by)
  where dismissed_by is not null;
