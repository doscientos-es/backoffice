import { BackLink } from "@/components/layout/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { requireUser } from "@/lib/auth";
import { createLead } from "../actions";

export const metadata = { title: "Nuevo lead · doscientos" };

const SOURCES = ["Web", "Referencia", "LinkedIn", "Email", "Evento", "Otro"];

export default async function NewLeadPage() {
  await requireUser();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Nuevo lead"
        description="Registra una nueva oportunidad comercial."
        back={<BackLink href="/leads" label="Volver a leads" />}
      />

      <Card>
        <CardContent className="pt-6">
          <form action={createLead} className="flex flex-col gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Nombre" htmlFor="name" required>
                <Input id="name" name="name" required maxLength={160} autoFocus />
              </Field>
              <Field label="Empresa" htmlFor="company">
                <Input id="company" name="company" maxLength={160} />
              </Field>
              <Field label="Email" htmlFor="email">
                <Input id="email" name="email" type="email" maxLength={160} />
              </Field>
              <Field label="Teléfono" htmlFor="phone">
                <Input id="phone" name="phone" type="tel" maxLength={40} />
              </Field>
              <Field label="Origen" htmlFor="source">
                <Select id="source" name="source" defaultValue="">
                  <option value="">—</option>
                  {SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label="Notas" htmlFor="notes">
              <Textarea id="notes" name="notes" rows={4} maxLength={4000} />
            </Field>

            <div className="flex items-center justify-end gap-2 border-t border-border pt-5">
              <Button type="submit" size="sm">
                Crear lead
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  required,
  children,
}: { label: string; htmlFor: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-medium">
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </Label>
      {children}
    </div>
  );
}
