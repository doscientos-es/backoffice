import { DetailGrid, DetailRow } from "@/components/layout/detail-grid";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatAddress } from "@/lib/address";
import { requireUser } from "@/lib/auth";
import { getClientDetail } from "@/lib/clients/queries";
import {
  INVOICE_STATUS,
  type InvoiceStatus,
  PROJECT_STATUS,
  PROPOSAL_STATUS,
  type ProjectStatus,
  type ProposalStatus,
} from "@/lib/status";
import { formatDate, formatEUR } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientEditDialog } from "./client-edit-dialog";
import { DeleteClientButton } from "./delete-client-button";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const result = await getClientDetail(id);
  if (!result) notFound();

  const { client, projects, proposals, invoices } = result;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={(client.label as string | null)?.trim() || (client.name as string)}
        description={(client.nif as string | null) ?? undefined}
        breadcrumbs={[
          { label: "Clientes", href: "/clients" },
          { label: (client.label as string | null)?.trim() || (client.name as string) },
        ]}
        actions={
          user.role !== "viewer" ? (
            <div className="flex items-center gap-2">
              <CopySummaryButton
                lines={[
                  [
                    `👤 ${(client.label as string | null)?.trim() || (client.name as string)}`,
                    (client.nif as string | null) ? `(${client.nif as string})` : null,
                  ]
                    .filter(Boolean)
                    .join(" "),
                  ...(
                    [
                      (client.email as string | null) ? `Email: ${client.email as string}` : null,
                      (client.phone as string | null) ? `Tel: ${client.phone as string}` : null,
                    ].filter(Boolean) as string[]
                  ).length > 0
                    ? [
                      [
                        (client.email as string | null) && `Email: ${client.email as string}`,
                        (client.phone as string | null) && `Tel: ${client.phone as string}`,
                      ]
                        .filter(Boolean)
                        .join(" · "),
                    ]
                    : [],
                  (client.contact_person as string | null)
                    ? `Contacto: ${client.contact_person as string}`
                    : null,
                  formatAddress({
                    street: client.billing_address_street as string | null,
                    zip: client.billing_address_zip as string | null,
                    city: client.billing_address_city as string | null,
                    province: client.billing_address_province as string | null,
                    country: client.billing_address_country as string | null,
                  })
                    ? `Dirección: ${formatAddress({
                      street: client.billing_address_street as string | null,
                      zip: client.billing_address_zip as string | null,
                      city: client.billing_address_city as string | null,
                      province: client.billing_address_province as string | null,
                      country: client.billing_address_country as string | null,
                    }).replace(/\n/g, ", ")}`
                    : null,
                ].filter((x): x is string => Boolean(x))}
                urlPath={`/clients/${client.id as string}`}
              />
              <ClientEditDialog
                client={{
                  id: client.id as string,
                  name: client.name as string,
                  label: (client.label as string | null) ?? null,
                  nif: (client.nif as string | null) ?? null,
                  email: (client.email as string | null) ?? null,
                  phone: (client.phone as string | null) ?? null,
                  contact_person: (client.contact_person as string | null) ?? null,
                  billing_address_street: (client.billing_address_street as string | null) ?? null,
                  billing_address_zip: (client.billing_address_zip as string | null) ?? null,
                  billing_address_city: (client.billing_address_city as string | null) ?? null,
                  billing_address_province:
                    (client.billing_address_province as string | null) ?? null,
                  billing_address_country:
                    (client.billing_address_country as string | null) ?? null,
                  notes: (client.notes as string | null) ?? null,
                  logo_url: (client.logo_url as string | null) ?? null,
                }}
              />
              <DeleteClientButton clientId={client.id as string} />
            </div>
          ) : undefined
        }
      />

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
          {formatAddress({
            street: client.billing_address_street as string | null,
            zip: client.billing_address_zip as string | null,
            city: client.billing_address_city as string | null,
            province: client.billing_address_province as string | null,
            country: client.billing_address_country as string | null,
          }) ? (
            <div className="mt-4 border-t border-border pt-3">
              <div className="mb-1 flex items-center gap-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Dirección
                </p>
                <CopyButton
                  text={formatAddress({
                    street: client.billing_address_street as string | null,
                    zip: client.billing_address_zip as string | null,
                    city: client.billing_address_city as string | null,
                    province: client.billing_address_province as string | null,
                    country: client.billing_address_country as string | null,
                  }).replace(/\n/g, ", ")}
                  successMessage="Dirección copiada"
                  label="Copiar dirección completa"
                />
              </div>
              <p className="whitespace-pre-wrap text-sm">
                {formatAddress({
                  street: client.billing_address_street as string | null,
                  zip: client.billing_address_zip as string | null,
                  city: client.billing_address_city as string | null,
                  province: client.billing_address_province as string | null,
                  country: client.billing_address_country as string | null,
                })}
              </p>
            </div>
          ) : null}
          {client.notes ? (
            <div className="mt-4 border-t border-border pt-3">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Notas
              </p>
              <p className="whitespace-pre-wrap text-sm">{client.notes as string}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

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
                    <StatusBadge meta={PROJECT_STATUS} value={p.status as ProjectStatus} />
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
                      <StatusBadge meta={PROPOSAL_STATUS} value={p.status as ProposalStatus} />
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
                      <StatusBadge meta={INVOICE_STATUS} value={inv.status as InvoiceStatus} />
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
