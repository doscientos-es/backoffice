import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used in JSX below
import { NifInput } from "./nif-input";

export type ClientFormDefaults = {
  name?: string | null;
  nif?: string | null;
  email?: string | null;
  phone?: string | null;
  contact_person?: string | null;
  billing_address?: string | null;
  notes?: string | null;
};

/**
 * Shared field block for the client create and edit forms. Keeps both flows
 * in sync so adding a column only requires touching one component.
 */
export function ClientFormFields({
  defaults,
  idPrefix = "client",
  autoFocusName = false,
}: {
  defaults?: ClientFormDefaults;
  idPrefix?: string;
  autoFocusName?: boolean;
}) {
  const d = defaults ?? {};
  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormRow
          label="Nombre"
          htmlFor={`${idPrefix}-name`}
          required
          hint="Razón social o nombre comercial."
        >
          <Input
            id={`${idPrefix}-name`}
            name="name"
            required
            maxLength={160}
            autoFocus={autoFocusName}
            defaultValue={d.name ?? ""}
            placeholder="Acme S.L."
            autoComplete="organization"
          />
        </FormRow>
        <FormRow
          label="NIF / CIF"
          htmlFor={`${idPrefix}-nif`}
          hint="Identificador fiscal. Pulsa VIES para validar IVA intracomunitario UE."
        >
          <NifInput id={`${idPrefix}-nif`} defaultValue={d.nif} />
        </FormRow>
        <FormRow label="Email" htmlFor={`${idPrefix}-email`}>
          <Input
            id={`${idPrefix}-email`}
            name="email"
            type="email"
            inputMode="email"
            maxLength={160}
            defaultValue={d.email ?? ""}
            placeholder="facturacion@acme.com"
            autoComplete="email"
          />
        </FormRow>
        <FormRow label="Teléfono" htmlFor={`${idPrefix}-phone`}>
          <Input
            id={`${idPrefix}-phone`}
            name="phone"
            type="tel"
            inputMode="tel"
            maxLength={40}
            defaultValue={d.phone ?? ""}
            placeholder="+34 600 000 000"
            autoComplete="tel"
          />
        </FormRow>
        <FormRow label="Persona de contacto" htmlFor={`${idPrefix}-contact_person`}>
          <Input
            id={`${idPrefix}-contact_person`}
            name="contact_person"
            maxLength={160}
            defaultValue={d.contact_person ?? ""}
            placeholder="Nombre y apellidos"
            autoComplete="name"
          />
        </FormRow>
      </div>
      <FormRow
        label="Dirección de facturación"
        htmlFor={`${idPrefix}-billing_address`}
        hint="Se usará en las facturas emitidas a este cliente."
      >
        <Textarea
          id={`${idPrefix}-billing_address`}
          name="billing_address"
          rows={2}
          maxLength={400}
          defaultValue={d.billing_address ?? ""}
          placeholder={"Calle, número\nCP Ciudad, País"}
        />
      </FormRow>
      <FormRow
        label="Notas"
        htmlFor={`${idPrefix}-notes`}
        hint="Información interna, no visible para el cliente."
      >
        <Textarea
          id={`${idPrefix}-notes`}
          name="notes"
          rows={3}
          maxLength={4000}
          defaultValue={d.notes ?? ""}
          placeholder="Condiciones de pago, observaciones…"
        />
      </FormRow>
    </>
  );
}
