-- Classify a closed sale independently from how the lead originated.
alter table public.leads
  add column won_product text,
  add constraint leads_won_product_check check (
    won_product is null or (status = 'won' and won_product ~ '^[a-z][a-z0-9_-]{0,63}$')
  );

create index leads_won_product_idx on public.leads(won_product)
  where deleted_at is null and won_product is not null;

-- Cover all status writers, including bulk changes and existing integrations.
create function public.clear_lead_won_product() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.won_product := null;
  return new;
end;
$$;

create trigger clear_lead_won_product_on_exit
  before update of status on public.leads for each row
  when (old.status = 'won' and new.status is distinct from old.status and new.won_product is not null)
  execute function public.clear_lead_won_product();

-- Keep the unused legacy column so the previous Backoffice release can still run.
-- Interest is not a sale, so nothing is copied into won_product.
notify pgrst, 'reload schema';