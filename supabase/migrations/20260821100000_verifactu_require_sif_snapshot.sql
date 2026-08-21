-- New durable fiscal rows must always freeze the SIF identity that generated
-- them. Keep this constraint NOT VALID so historical evidence remains intact.

alter table public.verifactu_ledger
  add constraint verifactu_ledger_sif_snapshot_required
  check (
    jsonb_typeof(record_payload->'software') = 'object'
    and coalesce(nullif(trim(record_payload #>> '{software,producerName}'), ''), '') <> ''
    and coalesce(nullif(trim(record_payload #>> '{software,producerNif}'), ''), '') <> ''
    and coalesce(nullif(trim(record_payload #>> '{software,name}'), ''), '') <> ''
    and coalesce(nullif(trim(record_payload #>> '{software,id}'), ''), '') <> ''
    and coalesce(nullif(trim(record_payload #>> '{software,version}'), ''), '') <> ''
    and coalesce(nullif(trim(record_payload #>> '{software,installationNumber}'), ''), '') <> ''
    and jsonb_typeof(record_payload #> '{software,onlyVerifactu}') = 'boolean'
    and jsonb_typeof(record_payload #> '{software,multipleTaxpayers}') = 'boolean'
  ) not valid;