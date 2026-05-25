import { BackLink } from "@/components/layout/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requireUser } from "@/lib/auth";
import { createClient } from "../actions";

export const metadata = { title: "Nuevo cliente · doscientos" };

export default async function NewClientPage() {
  await requireUser();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Nuevo cliente"
        description="Registra un nuevo cliente."
        back={<BackLink href="/clients" label="Volver a clientes" />}
      />
      <Card>
        <CardContent className="pt-6">
          <form action={createClient} className="flex flex-col gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <F label="Nombre" id="name" required>
                <Input id="name" name="name" required maxLength={160} autoFocus />
              </F>
              <F label="NIF / CIF" id="nif">
                <Input id="nif" name="nif" maxLength={20} />
              </F>
              <F label="Email" id="email">
                <Input id="email" name="email" type="email" maxLength={160} />
              </F>
              <F label="Teléfono" id="phone">
                <Input id="phone" name="phone" type="tel" maxLength={40} />
              </F>
              <F label="Persona de contacto" id="contact_person">
                <Input id="contact_person" name="contact_person" maxLength={160} />
              </F>
            </div>
            <F label="Dirección de facturación" id="billing_address">
              <Textarea id="billing_address" name="billing_address" rows={2} maxLength={400} />
            </F>
            <F label="Notas" id="notes">
              <Textarea id="notes" name="notes" rows={3} maxLength={4000} />
            </F>
            <div className="flex justify-end border-t border-border pt-4">
              <Button type="submit" size="sm">Crear cliente</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function F({ label, id, required, children }: {
  label: string; id: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs font-medium">
        {label}{required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </Label>
      {children}
    </div>
  );
}
