-- =============================================================================
-- Fix: fn_invoice_immutable debe proteger SOLO las facturas aceptadas por AEAT.
--
-- El trigger original disparaba para cualquier factura no-borrador y no-excluida,
-- lo que bloqueaba:
--   · El primer envío a la AEAT (verifactu_status=pending → idfact/hash son null)
--   · Los reintentos tras rechazo (verifactu_status=rejected → hash cambia)
--
-- La obligación legal (RD 1007/2023 art. 8) es garantizar la inalterabilidad
-- de los campos fiscales UNA VEZ QUE LA AEAT HA ACEPTADO el registro.
-- Antes de la aceptación (pending/rejected) es correcto actualizar esos campos.
-- =============================================================================

create or replace function public.fn_invoice_immutable()
returns trigger as $$
begin
  -- Solo las facturas aceptadas son verdaderamente inmutables (RD 1007/2023).
  -- pending/rejected aún pueden actualizarse en el flujo de envío/reintento.
  if OLD.verifactu_status is distinct from 'accepted'::verifactu_status then
    return NEW;
  end if;

  if (
    NEW.series           is distinct from OLD.series           or
    NEW.number           is distinct from OLD.number           or
    NEW.invoice_type     is distinct from OLD.invoice_type     or
    NEW.idfact           is distinct from OLD.idfact           or
    NEW.issue_date       is distinct from OLD.issue_date       or
    NEW.issued_at        is distinct from OLD.issued_at        or
    NEW.client_nif       is distinct from OLD.client_nif       or
    NEW.client_name      is distinct from OLD.client_name      or
    NEW.client_address   is distinct from OLD.client_address   or
    NEW.subtotal         is distinct from OLD.subtotal         or
    NEW.tax_amount       is distinct from OLD.tax_amount       or
    NEW.total            is distinct from OLD.total            or
    NEW.previous_hash    is distinct from OLD.previous_hash    or
    NEW.current_hash     is distinct from OLD.current_hash     or
    NEW.chain_sequence   is distinct from OLD.chain_sequence
  ) then
    raise exception
      'Los campos fiscales de la factura % son inmutables tras la aceptación por la AEAT (Verifactu RD 1007/2023). Emite una factura rectificativa.',
      OLD.full_number;
  end if;

  return NEW;
end $$ language plpgsql;
