import { DateField } from "@/components/ui/date-field";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { HOSTING_PROVIDER_LABELS, HOSTING_PROVIDERS } from "@/lib/schemas/web-project";
import type { WebProjectDetail } from "@/lib/webs/types";

type Defaults = Partial<WebProjectDetail>;

interface Props {
  clients: Array<{ id: string; name: string }>;
  defaults?: Defaults;
  idPrefix?: string;
  autoFocusName?: boolean;
}

/**
 * Shared field block for web project create and edit forms.
 */
export function WebFormFields({ clients, defaults: d = {}, idPrefix = "web", autoFocusName = false }: Props) {
  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormRow label="Nombre" htmlFor={`${idPrefix}-name`} required>
          <Input
            id={`${idPrefix}-name`}
            name="name"
            required
            maxLength={200}
            autoFocus={autoFocusName}
            defaultValue={d.name ?? ""}
            placeholder="Landing doscientos"
          />
        </FormRow>

        <FormRow label="URL" htmlFor={`${idPrefix}-url`} required hint="URL principal del sitio.">
          <Input
            id={`${idPrefix}-url`}
            name="url"
            type="url"
            required
            maxLength={2000}
            defaultValue={d.url ?? ""}
            placeholder="https://doscientos.es"
          />
        </FormRow>

        <FormRow label="Cliente" htmlFor={`${idPrefix}-client_id`}>
          <Select id={`${idPrefix}-client_id`} name="client_id" defaultValue={d.client_id ?? ""}>
            <option value="">— Sin cliente (web propia) —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FormRow>

        <FormRow label="Hosting" htmlFor={`${idPrefix}-hosting_provider`}>
          <Select
            id={`${idPrefix}-hosting_provider`}
            name="hosting_provider"
            defaultValue={d.hosting_provider ?? ""}
          >
            <option value="">— Sin especificar —</option>
            {HOSTING_PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {HOSTING_PROVIDER_LABELS[p]}
              </option>
            ))}
          </Select>
        </FormRow>

        <FormRow label="URL del hosting" htmlFor={`${idPrefix}-hosting_url`} hint="Link al dashboard.">
          <Input
            id={`${idPrefix}-hosting_url`}
            name="hosting_url"
            type="url"
            maxLength={2000}
            defaultValue={d.hosting_url ?? ""}
            placeholder="https://vercel.com/doscientos/landing"
          />
        </FormRow>

        <FormRow label="Registrador de dominio" htmlFor={`${idPrefix}-domain_registrar`}>
          <Input
            id={`${idPrefix}-domain_registrar`}
            name="domain_registrar"
            maxLength={200}
            defaultValue={d.domain_registrar ?? ""}
            placeholder="Namecheap, GoDaddy…"
          />
        </FormRow>

        <FormRow label="Vence el dominio" htmlFor={`${idPrefix}-domain_expires_at`}>
          <DateField
            id={`${idPrefix}-domain_expires_at`}
            name="domain_expires_at"
            defaultValue={d.domain_expires_at ?? ""}
          />
        </FormRow>

        <FormRow
          label="Tech stack"
          htmlFor={`${idPrefix}-tech_stack`}
          hint="Separado por comas."
        >
          <Input
            id={`${idPrefix}-tech_stack`}
            name="tech_stack"
            maxLength={500}
            defaultValue={(d.tech_stack ?? []).join(", ")}
            placeholder="Next.js, Tailwind, Supabase"
          />
        </FormRow>
      </div>

      <FormRow label="¿Web propia?" htmlFor={`${idPrefix}-is_own`}>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            id={`${idPrefix}-is_own`}
            type="checkbox"
            name="is_own"
            defaultChecked={d.is_own ?? false}
            className="accent-primary h-4 w-4"
          />
          Marcar como web de doscientos
        </label>
      </FormRow>

      <FormRow label="Notas" htmlFor={`${idPrefix}-notes`}>
        <Textarea
          id={`${idPrefix}-notes`}
          name="notes"
          rows={3}
          maxLength={4000}
          defaultValue={d.notes ?? ""}
          placeholder="Notas internas, accesos, consideraciones…"
        />
      </FormRow>
    </>
  );
}
