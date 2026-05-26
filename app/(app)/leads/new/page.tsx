import { BackLink } from "@/components/layout/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { requireUser } from "@/lib/auth";
import type { Metadata } from "next";
import Link from "next/link";
import { createLead } from "../actions";

export const metadata: Metadata = { title: "Nuevo lead · doscientos" };

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
              <FormRow
                label="Nombre"
                htmlFor="name"
                required
                hint="Persona o contacto principal del lead."
              >
                <Input
                  id="name"
                  name="name"
                  required
                  maxLength={160}
                  autoFocus
                  placeholder="Nombre y apellidos"
                  autoComplete="name"
                />
              </FormRow>
              <FormRow label="Empresa" htmlFor="company">
                <Input
                  id="company"
                  name="company"
                  maxLength={160}
                  placeholder="Acme S.L."
                  autoComplete="organization"
                />
              </FormRow>
              <FormRow label="Email" htmlFor="email">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  inputMode="email"
                  maxLength={160}
                  placeholder="nombre@empresa.com"
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
              <FormRow label="Origen" htmlFor="source" hint="Cómo nos ha llegado este lead.">
                <Select id="source" name="source" defaultValue="">
                  <option value="">— Sin especificar —</option>
                  {SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </FormRow>
            </div>

            <FormRow
              label="Notas"
              htmlFor="notes"
              hint="Contexto inicial, necesidades, próximos pasos…"
            >
              <Textarea
                id="notes"
                name="notes"
                rows={4}
                maxLength={4000}
                placeholder="Reunión inicial el 14/03 — interesados en módulo de facturación…"
              />
            </FormRow>

            <div className="flex items-center justify-end gap-2 border-t border-border pt-5">
              <Button asChild variant="ghost" size="sm">
                <Link href="/leads">Cancelar</Link>
              </Button>
              <SubmitButton pendingLabel="Creando…">Crear lead</SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
