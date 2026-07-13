-- Adds a human-readable error column populated when AEAT rejects an invoice.
-- The raw SOAP response is already in verifactu_response (jsonb); this column
-- holds the extracted errorMessage string so the UI can surface it without
-- parsing the full response.
alter table invoices
  add column if not exists verifactu_error text;
