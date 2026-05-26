import { BackLink } from "@/components/layout/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { requireUser } from "@/lib/auth";
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "../actions";

export const metadata: Metadata = { title: "Nuevo cliente · doscientos" };

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
              <FormRow
                label="Nombre"
                htmlFor="name"
                required
                hint="Razón social o nombre comercial."
              >
                <Input
                  id="name"
                  name="name"
                  required
                  maxLength={160}
                  autoFocus
                  placeholder="Acme S.L."
                  autoComplete="organization"
                />
              </FormRow>
              <FormRow label="NIF / CIF" htmlFor="nif" hint="Identificador fiscal (España).">
                <Input
                  id="nif"
                  name="nif"
                  maxLength={20}
                  placeholder="B12345678"
                  autoComplete="off"
                />
              </FormRow>
              <FormRow label="Email" htmlFor="email">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  inputMode="email"
                  maxLength={160}
                  placeholder="facturacion@acme.com"
                  autoComplete="email"
                />
              </FormRow>
              <FormRow label="Teléfono" htmlFor="phone">
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  maxLength={40}
                  placeholder="+34 600 000 000"
                  autoComplete="tel"
                />
              </FormRow>
              <FormRow label="Persona de contacto" htmlFor="contact_person">
                <Input
                  id="contact_person"
                  name="contact_person"
                  maxLength={160}
                  placeholder="Nombre y apellidos"
                  autoComplete="name"
                />
              </FormRow>
            </div>
            <FormRow
              label="Dirección de facturación"
              htmlFor="billing_address"
              hint="Se usará en las facturas emitidas a este cliente."
            >
              <Textarea
                id="billing_address"
                name="billing_address"
                rows={2}
                maxLength={400}
                placeholder={"Calle, número\nCP Ciudad, País"}
              />
            </FormRow>
            <FormRow
              label="Notas"
              htmlFor="notes"
              hint="Información interna, no visible para el cliente."
            >
              <Textarea
                id="notes"
                name="notes"
                rows={3}
                maxLength={4000}
                placeholder="Condiciones de pago, observaciones…"
              />
            </FormRow>
            <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
              <Button asChild variant="ghost" size="sm">
                <Link href="/clients">Cancelar</Link>
              </Button>
              <SubmitButton pendingLabel="Creando…">Crear cliente</SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
