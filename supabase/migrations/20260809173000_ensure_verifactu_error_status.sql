-- Demo instances created before 20260731120000 may not have this enum value.
-- Keep the durable outbox retry state compatible across production and demo.
alter type public.verifactu_status add value if not exists 'error';