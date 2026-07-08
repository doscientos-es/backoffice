import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { COUNTRY_OPTIONS } from "@/lib/address";
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used in JSX below
import { NifInput } from "./nif-input";

export type ClientFormDefaults = {
  name?: string | null;
  label?: string | null;
  nif?: string | null;
  email?: string | null;
  phone?: string | null;
  contact_person?: string | null;
  billing_address_street?: string | null;
  billing_address_zip?: string | null;
  billing_address_city?: string | null;
  billing_address_province?: string | null;
  billing_address_country?: string | null;
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
          label="Alias / Label"
          htmlFor={`${idPrefix}-label`}
          hint="Nombre corto para listas. Si está vacío se usa la razón social."
        >
          <Input
            id={`${idPrefix}-label`}
            name="label"
            maxLength={100}
            defaultValue={d.label ?? ""}
            placeholder="Acme"
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
      <div className="col-span-full">
        <p className="mb-3 text-sm font-medium">Dirección de facturación</p>
        <p className="mb-3 text-xs text-muted-foreground">
          Se usará en las facturas. Cada campo se guarda por separado para garantizar validez
          fiscal.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormRow
            label="Calle y número"
            htmlFor={`${idPrefix}-billing_address_street`}
            className="sm:col-span-2"
          >
            <Input
              id={`${idPrefix}-billing_address_street`}
              name="billing_address_street"
              maxLength={200}
              defaultValue={d.billing_address_street ?? ""}
              placeholder="Calle Mayor, 1 - 3ª"
              autoComplete="street-address"
            />
          </FormRow>
          <FormRow label="Código postal" htmlFor={`${idPrefix}-billing_address_zip`}>
            <Input
              id={`${idPrefix}-billing_address_zip`}
              name="billing_address_zip"
              maxLength={20}
              defaultValue={d.billing_address_zip ?? ""}
              placeholder="08001"
              autoComplete="postal-code"
            />
          </FormRow>
          <FormRow label="Ciudad" htmlFor={`${idPrefix}-billing_address_city`}>
            <Input
              id={`${idPrefix}-billing_address_city`}
              name="billing_address_city"
              maxLength={100}
              defaultValue={d.billing_address_city ?? ""}
              placeholder="Barcelona"
              autoComplete="address-level2"
            />
          </FormRow>
          <FormRow label="Provincia" htmlFor={`${idPrefix}-billing_address_province`}>
            <Input
              id={`${idPrefix}-billing_address_province`}
              name="billing_address_province"
              maxLength={100}
              defaultValue={d.billing_address_province ?? ""}
              placeholder="Barcelona"
              autoComplete="address-level1"
            />
          </FormRow>
          <FormRow label="País" htmlFor={`${idPrefix}-billing_address_country`}>
            <Select
              id={`${idPrefix}-billing_address_country`}
              name="billing_address_country"
              defaultValue={d.billing_address_country ?? "ES"}
              autoComplete="country"
            >
              {COUNTRY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </Select>
          </FormRow>
        </div>
      </div>
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
