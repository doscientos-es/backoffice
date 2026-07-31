-- Keep only operational AEAT metadata in persisted Verifactu responses.
-- The full SOAP envelope can contain unnecessary fiscal/personal data and
-- must not be retained in the invoice row.

update public.invoices
set verifactu_response = jsonb_build_object(
  'kind', 'legacy_response_redacted',
  'redacted_at', now()
)
where jsonb_typeof(verifactu_response) = 'object'
  and verifactu_response ? 'rawResponse';
