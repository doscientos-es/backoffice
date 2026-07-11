"use client";

import { ClientLogoUpload } from "@/components/ui/client-logo-upload";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ZipInput } from "@/components/ui/zip-input";
import { COUNTRY_OPTIONS } from "@/lib/address";
import { User } from "lucide-react";
import { useCallback, useState } from "react";

import { type AutofillData, NifInput } from "./nif-input";

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
  logo_url?: string | null;
};

/**
 * Shared field block for the client create and edit forms. Keeps both flows
 * in sync so adding a column only requires touching one component.
 *
 * When the NIF/CIF is verified and the company is found in the Registro
 * Mercantil, autofill pre-populates the name, city, and province fields.
 * The user can still edit all values manually.
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

  // Controlled state so autofill can update these fields
  const [name, setName] = useState(d.name ?? "");
  const [contactPerson, setContactPerson] = useState(d.contact_person ?? "");
  const [autofillCity, setAutofillCity] = useState(d.billing_address_city ?? "");
  const [autofillProvince, setAutofillProvince] = useState(d.billing_address_province ?? "");
  const [suggestedOfficers, setSuggestedOfficers] = useState<AutofillData["officers"]>([]);
  // Incrementing key forces ZipInput to remount with new defaults when autofill fires
  const [zipKey, setZipKey] = useState(0);
  const handleAutofill = useCallback((data: AutofillData) => {
    if (data.name) setName(data.name);
    if (data.city || data.province) {
      setAutofillCity(data.city ?? "");
      setAutofillProvince(data.province ?? "");
      setZipKey((k) => k + 1); // remount ZipInput with new defaults
    }
    if (data.officers) setSuggestedOfficers(data.officers);
  }, []);

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
            value={name}
            onChange={(e) => setName(e.target.value)}
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
          hint="Introduce el CIF y pulsa 'Verificar' para buscar en el Registro Mercantil."
        >
          <NifInput id={`${idPrefix}-nif`} defaultValue={d.nif} onAutofillAction={handleAutofill} />
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
          <div className="flex flex-col gap-2">
            <Input
              id={`${idPrefix}-contact_person`}
              name="contact_person"
              maxLength={160}
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              placeholder="Nombre y apellidos"
              autoComplete="name"
            />
            {suggestedOfficers && suggestedOfficers.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <p className="w-full text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                  Sugerencias del Registro:
                </p>
                {suggestedOfficers.map((o) => (
                  <button
                    key={o.name}
                    type="button"
                    onClick={() => setContactPerson(o.name)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full border bg-muted/50 text-[11px] hover:bg-accent transition-colors"
                  >
                    <User className="size-3" />
                    {o.name}
                    <span className="opacity-50 italic">({o.role})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
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
          <ZipInput
            key={zipKey}
            namePrefix="billing_address"
            defaultZip={d.billing_address_zip}
            defaultCity={autofillCity || d.billing_address_city}
            defaultProvince={autofillProvince || d.billing_address_province}
          />
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
      <ClientLogoUpload defaultLogoUrl={d.logo_url} />
    </>
  );
}
