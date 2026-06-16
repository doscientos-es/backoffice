import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export const LEAD_SOURCES = [
  "Landing",
  "Anuncios Meta",
  "Referencia",
  "Conocido",
  "LinkedIn",
  "Email",
  "Evento",
  "Otro",
] as const;

export type LeadFormDefaults = {
  name?: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  notes?: string | null;
  estimated_value?: number | null;
};

/**
 * Shared lead form fields used by the create page and the edit dialog.
 * `idPrefix` avoids `id` collisions when multiple forms coexist on the page.
 * `includeEstimatedValue` toggles the estimated value field (edit only for now).
 */
export function LeadFormFields({
  defaults,
  idPrefix = "lead",
  includeEstimatedValue = false,
  autoFocusName = false,
}: {
  defaults?: LeadFormDefaults;
  idPrefix?: string;
  includeEstimatedValue?: boolean;
  autoFocusName?: boolean;
}) {
  const d = defaults ?? {};
  const sourceValue = d.source ?? "";
  const isCustomSource = sourceValue !== "" && !LEAD_SOURCES.includes(sourceValue as never);
  return (
    <>
      <FormRow
        label="Nombre"
        htmlFor={`${idPrefix}-name`}
        required
        hint="Persona o contacto principal del lead."
      >
        <Input
          id={`${idPrefix}-name`}
          name="name"
          required
          maxLength={160}
          autoFocus={autoFocusName}
          defaultValue={d.name ?? ""}
          placeholder="Nombre y apellidos"
          autoComplete="name"
        />
      </FormRow>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormRow label="Empresa" htmlFor={`${idPrefix}-company`}>
          <Input
            id={`${idPrefix}-company`}
            name="company"
            maxLength={160}
            defaultValue={d.company ?? ""}
            placeholder="Acme S.L."
            autoComplete="organization"
          />
        </FormRow>
        <FormRow label="Email" htmlFor={`${idPrefix}-email`}>
          <Input
            id={`${idPrefix}-email`}
            name="email"
            type="email"
            inputMode="email"
            maxLength={160}
            defaultValue={d.email ?? ""}
            placeholder="nombre@doscientos.es"
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
        <FormRow
          label="Origen"
          htmlFor={`${idPrefix}-source`}
          hint="Cómo nos ha llegado este lead."
        >
          <Select
            id={`${idPrefix}-source`}
            name="source"
            defaultValue={isCustomSource ? "Otro" : sourceValue}
          >
            <option value="">— Sin especificar —</option>
            {LEAD_SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </FormRow>
        {includeEstimatedValue ? (
          <FormRow label="Valor estimado (€)" htmlFor={`${idPrefix}-estimated_value`}>
            <Input
              id={`${idPrefix}-estimated_value`}
              name="estimated_value"
              type="number"
              inputMode="decimal"
              min={0}
              max={99999999.99}
              step="0.01"
              defaultValue={d.estimated_value != null ? String(d.estimated_value) : ""}
              placeholder="0.00"
            />
          </FormRow>
        ) : null}
      </div>
      <FormRow
        label="Notas"
        htmlFor={`${idPrefix}-notes`}
        hint="Contexto inicial, necesidades, próximos pasos…"
      >
        <Textarea
          id={`${idPrefix}-notes`}
          name="notes"
          rows={4}
          maxLength={4000}
          defaultValue={d.notes ?? ""}
          placeholder="Reunión inicial el 14/03 — interesados en módulo de facturación…"
        />
      </FormRow>
    </>
  );
}
