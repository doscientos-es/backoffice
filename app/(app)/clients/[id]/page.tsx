import { DetailGrid, DetailRow } from "@/components/layout/detail-grid";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormRow } from "@/components/ui/form-row";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { requireUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { formatDate, formatEUR } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";
import { updateClient } from "../actions";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser();
  const supabase = await createServerClient();

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!client) notFound();

  const [{ data: projects }, { data: proposals }, { data: invoices }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, status")
      .eq("client_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("proposals")
      .select("id, number, title, status, total")
      .eq("client_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("invoices")
      .select("id, full_number, status, total, issue_date")
      .eq("client_id", id)
      .is("deleted_at", null)
      .order("issue_date", { ascending: false })
      .limit(10),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={client.name as string}
        description={(client.nif as string | null) ?? undefined}
        breadcrumbs={[
          { label: "Clientes", href: "/clients" },
          { label: client.name as string },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        {/* Detail card */}
        <Card>
          <CardHeader>
            <CardTitle>Datos</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailGrid>
              <DetailRow label="Email">{(client.email as string | null) ?? "—"}</DetailRow>
              <DetailRow label="Teléfono">{(client.phone as string | null) ?? "—"}</DetailRow>
              <DetailRow label="Contacto">
                {(client.contact_person as string | null) ?? "—"}
              </DetailRow>
              <DetailRow label="Creado">{formatDate(client.created_at as string)}</DetailRow>
            </DetailGrid>
            {client.billing_address ? (
              <div className="mt-4 border-t border-border pt-3">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Dirección
                </p>
                <p className="whitespace-pre-wrap text-sm">{client.billing_address as string}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Edit card */}
        <Card>
          <CardHeader>
            <CardTitle>Editar</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateClient} className="flex flex-col gap-4">
              <input type="hidden" name="id" value={id} />
              <FormRow label="Nombre" htmlFor="e_name" required>
                <Input
                  id="e_name"
                  name="name"
                  defaultValue={client.name as string}
                  required
                  maxLength={160}
                  placeholder="Acme S.L."
                  autoComplete="organization"
                />
              </FormRow>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormRow label="NIF" htmlFor="e_nif">
                  <Input
                    id="e_nif"
                    name="nif"
                    defaultValue={(client.nif as string | null) ?? ""}
                    maxLength={20}
                    placeholder="B12345678"
                  />
                </FormRow>
                <FormRow label="Email" htmlFor="e_email">
                  <Input
                    id="e_email"
                    name="email"
                    type="email"
                    inputMode="email"
                    defaultValue={(client.email as string | null) ?? ""}
                    maxLength={160}
                    placeholder="facturacion@acme.com"
                    autoComplete="email"
                  />
                </FormRow>
                <FormRow label="Teléfono" htmlFor="e_phone">
                  <Input
                    id="e_phone"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    defaultValue={(client.phone as string | null) ?? ""}
                    maxLength={40}
                    placeholder="+34 600 000 000"
                    autoComplete="tel"
                  />
                </FormRow>
                <FormRow label="Contacto" htmlFor="e_contact">
                  <Input
                    id="e_contact"
                    name="contact_person"
                    defaultValue={(client.contact_person as string | null) ?? ""}
                    maxLength={160}
                    placeholder="Nombre y apellidos"
                    autoComplete="name"
                  />
                </FormRow>
              </div>
              <FormRow
                label="Dirección"
                htmlFor="e_addr"
                hint="Se usará en las facturas emitidas a este cliente."
              >
                <Textarea
                  id="e_addr"
                  name="billing_address"
                  rows={2}
                  maxLength={400}
                  defaultValue={(client.billing_address as string | null) ?? ""}
                  placeholder={"Calle, número\nCP Ciudad, País"}
                />
              </FormRow>
              <FormRow
                label="Notas"
                htmlFor="e_notes"
                hint="Información interna, no visible para el cliente."
              >
                <Textarea
                  id="e_notes"
                  name="notes"
                  rows={2}
                  maxLength={4000}
                  defaultValue={(client.notes as string | null) ?? ""}
                  placeholder="Condiciones de pago, observaciones…"
                />
              </FormRow>
              <div className="flex justify-end border-t border-border pt-3">
                <SubmitButton pendingLabel="Guardando…">Guardar cambios</SubmitButton>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Projects */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Proyectos</CardTitle>
            <Button asChild size="sm">
              <Link href={`/projects/new?client_id=${id}`}>Nuevo</Link>
            </Button>
          </CardHeader>
          <CardContent className="px-0">
            {!projects || projects.length === 0 ? (
              <p className="px-6 py-2 text-sm text-muted-foreground">Sin proyectos.</p>
            ) : (
              <ul className="divide-y divide-border">
                {projects.map((p) => (
                  <li
                    key={p.id as string}
                    className="flex items-center justify-between gap-3 px-6 py-2.5 text-sm"
                  >
                    <Link
                      href={`/projects/${p.id}`}
                      className="truncate font-medium hover:underline"
                    >
                      {p.name as string}
                    </Link>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {p.status as string}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Proposals */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Propuestas</CardTitle>
            <Button asChild size="sm">
              <Link href={`/proposals/new?client_id=${id}`}>Nueva</Link>
            </Button>
          </CardHeader>
          <CardContent className="px-0">
            {!proposals || proposals.length === 0 ? (
              <p className="px-6 py-2 text-sm text-muted-foreground">Sin propuestas.</p>
            ) : (
              <ul className="divide-y divide-border">
                {proposals.map((p) => (
                  <li
                    key={p.id as string}
                    className="flex items-center justify-between gap-3 px-6 py-2.5 text-sm"
                  >
                    <Link
                      href={`/proposals/${p.id}`}
                      className="truncate font-medium hover:underline"
                    >
                      {p.number as string}
                    </Link>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="neutral">{p.status as string}</Badge>
                      <span className="tabular-nums text-xs text-muted-foreground">
                        {formatEUR(Number(p.total ?? 0))}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Invoices */}
        <Card>
          <CardHeader>
            <CardTitle>Facturas</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {!invoices || invoices.length === 0 ? (
              <p className="px-6 py-2 text-sm text-muted-foreground">Sin facturas.</p>
            ) : (
              <ul className="divide-y divide-border">
                {invoices.map((inv) => (
                  <li
                    key={inv.id as string}
                    className="flex items-center justify-between gap-3 px-6 py-2.5 text-sm"
                  >
                    <Link
                      href={`/invoices/${inv.id}`}
                      className="truncate font-medium hover:underline"
                    >
                      {inv.full_number as string}
                    </Link>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="neutral">{inv.status as string}</Badge>
                      <span className="tabular-nums text-xs text-muted-foreground">
                        {formatEUR(Number(inv.total ?? 0))}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
