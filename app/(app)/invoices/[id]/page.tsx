import { DetailGrid, DetailRow } from "@/components/layout/detail-grid";
import { PageHeader } from "@/components/layout/page-header";
import { CopyPortalLink } from "@/components/portal/copy-portal-link";
import { PortalAccessControls } from "@/components/portal/portal-access-controls";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireUser } from "@/lib/auth";
import { buildVatBreakdown } from "@/lib/finance";
import { INVOICE_STATUS, VERIFACTU_STATUS } from "@/lib/status";
import { createServerClient } from "@/lib/supabase/server";
import { formatDate, formatEUR } from "@/lib/utils";
import { verifactuConfigFromEnv } from "@/lib/verifactu/config";
import { buildQrDataUrl, buildQrUrl } from "@/lib/verifactu/qr";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { updateInvoicePortalAccess } from "../actions";
import { InvoiceActions } from "./invoice-actions";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser();
  const supabase = await createServerClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, clients(id, name, email), projects(id, name)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!invoice) notFound();

  const { data: items } = await supabase
    .from("invoice_items")
    .select("id, position, description, quantity, unit_price, vat_rate, subtotal")
    .eq("invoice_id", id)
    .order("position");

  const { data: settings } = await supabase.from("settings").select("*").eq("id", 1).single();

  const { data: payments } = await supabase
    .from("invoice_payments")
    .select("id, amount, status, ds_authorisation_code, created_at, confirmed_at")
    .eq("invoice_id", id)
    .order("created_at", { ascending: false });

  const confirmedPayments = (payments ?? []).filter((p) => p.status === "confirmed");
  const amountPaid = confirmedPayments.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
  const amountDue = Math.max(0, Number(invoice.total ?? 0) - amountPaid);

  const client = (
    invoice as unknown as { clients: { id: string; name: string; email: string | null } | null }
  ).clients;
  const project = (invoice as unknown as { projects: { id: string; name: string } | null })
    .projects;

  // Group line items by VAT rate so we can show a proper desglose por tipo.
  const vatBreakdown = buildVatBreakdown(
    (items ?? []) as Array<{ vat_rate: number | string | null; subtotal: number | string | null }>,
  );

  // Build QR if issued and has required data
  let qrDataUrl: string | null = null;
  const nif = process.env.VERIFACTU_NIF_EMISOR ?? "";
  if (
    nif &&
    invoice.status !== "draft" &&
    invoice.full_number &&
    invoice.issue_date &&
    invoice.total != null
  ) {
    const qrUrl = buildQrUrl(
      {
        nif,
        invoiceNumber: invoice.full_number as string,
        issueDate: new Date(invoice.issue_date as string),
        total: invoice.total as number,
      },
      verifactuConfigFromEnv(),
    );
    qrDataUrl = await buildQrDataUrl(qrUrl);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Factura ${invoice.full_number as string}`}
        description={client?.name}
        breadcrumbs={[
          { label: "Facturas", href: "/invoices" },
          ...(client ? [{ label: client.name, href: `/clients/${client.id}` }] : []),
          ...(project ? [{ label: project.name, href: `/projects/${project.id}` }] : []),
          { label: invoice.full_number as string },
        ]}
        actions={
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end gap-1 mr-2">
              <StatusBadge meta={INVOICE_STATUS} value={invoice.status as string} />
              <StatusBadge
                meta={VERIFACTU_STATUS}
                value={invoice.verifactu_status as string}
                className="text-[10px] py-0 h-4"
                labelPrefix="Verifactu: "
              />
            </div>
            <InvoiceActions
              invoice={{
                id: invoice.id as string,
                status: invoice.status as string,
                verifactu_status: invoice.verifactu_status as string,
              }}
              clientEmail={client?.email ?? null}
            />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        {/* Line items */}
        <Card>
          <CardHeader>
            <CardTitle>Líneas</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {!items || items.length === 0 ? (
              <p className="px-6 py-4 text-sm text-muted-foreground">Sin líneas.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-5 py-2 font-medium">Descripción</th>
                      <th className="px-5 py-2 font-medium text-right">Cant.</th>
                      <th className="px-5 py-2 font-medium text-right">Precio</th>
                      <th className="px-5 py-2 font-medium text-right">IVA %</th>
                      <th className="px-5 py-2 font-medium text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id as string} className="border-t border-border">
                        <td className="px-5 py-2.5">{item.description as string}</td>
                        <td className="px-5 py-2.5 text-right tabular-nums">
                          {item.quantity as number}
                        </td>
                        <td className="px-5 py-2.5 text-right tabular-nums">
                          {formatEUR(item.unit_price as number)}
                        </td>
                        <td className="px-5 py-2.5 text-right tabular-nums">
                          {item.vat_rate as number}%
                        </td>
                        <td className="px-5 py-2.5 text-right tabular-nums font-medium">
                          {formatEUR(item.subtotal as number)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-border">
                    <tr>
                      <td
                        colSpan={4}
                        className="px-5 py-2.5 text-right text-xs text-muted-foreground"
                      >
                        Base imponible
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums">
                        {formatEUR(invoice.subtotal as number)}
                      </td>
                    </tr>
                    {vatBreakdown.map((row) => (
                      <tr key={row.rate}>
                        <td
                          colSpan={4}
                          className="px-5 py-2.5 text-right text-xs text-muted-foreground"
                        >
                          IVA {row.rate}% sobre {formatEUR(row.base)}
                        </td>
                        <td className="px-5 py-2.5 text-right tabular-nums">
                          {formatEUR(row.tax)}
                        </td>
                      </tr>
                    ))}
                    <tr className="font-semibold">
                      <td colSpan={4} className="px-5 py-2.5 text-right">
                        Total
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums">
                        {formatEUR(invoice.total as number)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="flex flex-col gap-6">
          {/* Issuer (datos del emisor) */}
          {settings ? (
            <Card>
              <CardHeader>
                <CardTitle>Emisor</CardTitle>
              </CardHeader>
              <CardContent>
                <DetailGrid>
                  <DetailRow label="Razón social">
                    {(settings.company_name as string | null) ?? "—"}
                  </DetailRow>
                  {(settings.company_nif as string | null) ? (
                    <DetailRow label="NIF">{settings.company_nif as string}</DetailRow>
                  ) : null}
                  {(settings.company_address as string | null) ? (
                    <DetailRow label="Domicilio">
                      <span className="whitespace-pre-wrap">
                        {settings.company_address as string}
                      </span>
                    </DetailRow>
                  ) : null}
                  {(settings.iban as string | null) ? (
                    <DetailRow label="IBAN">
                      <span className="font-mono text-xs">{settings.iban as string}</span>
                    </DetailRow>
                  ) : null}
                </DetailGrid>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Información fiscal</CardTitle>
            </CardHeader>
            <CardContent>
              <DetailGrid>
                <DetailRow label="Nº factura">{invoice.full_number as string}</DetailRow>
                {(invoice.idfact as string | null) ? (
                  <DetailRow label="IDFACT">
                    <span className="break-all font-mono text-xs">{invoice.idfact as string}</span>
                  </DetailRow>
                ) : null}
                <DetailRow label="Tipo">{invoice.invoice_type as string}</DetailRow>
                <DetailRow label="Cliente">
                  {client ? (
                    <Link href={`/clients/${client.id}`} className="hover:underline">
                      {client.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </DetailRow>
                {project ? (
                  <DetailRow label="Proyecto">
                    <Link href={`/projects/${project.id}`} className="hover:underline">
                      {project.name}
                    </Link>
                  </DetailRow>
                ) : null}
                <DetailRow label="Emisión">{formatDate(invoice.issue_date as string)}</DetailRow>
                <DetailRow label="Vencimiento">
                  {formatDate(invoice.due_date as string | null)}
                </DetailRow>
                {(invoice.client_nif as string | null) ? (
                  <DetailRow label="NIF cliente">{invoice.client_nif as string}</DetailRow>
                ) : null}
                {(invoice.verifactu_csv as string | null) ? (
                  <DetailRow label="CSV AEAT">
                    <span className="break-all font-mono text-xs">
                      {invoice.verifactu_csv as string}
                    </span>
                  </DetailRow>
                ) : null}
              </DetailGrid>
            </CardContent>
          </Card>

          {/* Payment history */}
          {payments && payments.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Cobros</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <DetailGrid>
                  <DetailRow label="Cobrado">
                    <span className="tabular-nums font-medium text-emerald-700 dark:text-emerald-400">
                      {formatEUR(amountPaid)}
                    </span>
                  </DetailRow>
                  <DetailRow label="Pendiente">
                    <span className="tabular-nums font-medium">{formatEUR(amountDue)}</span>
                  </DetailRow>
                </DetailGrid>
                <ul className="flex flex-col divide-y divide-border border-t border-border">
                  {payments.map((p) => {
                    const status = p.status as string;
                    const tone =
                      status === "confirmed"
                        ? "text-emerald-700 dark:text-emerald-400"
                        : status === "failed"
                          ? "text-red-600 dark:text-red-400"
                          : "text-muted-foreground";
                    const label =
                      status === "confirmed"
                        ? "Confirmado"
                        : status === "failed"
                          ? "Rechazado"
                          : "Pendiente";
                    return (
                      <li
                        key={p.id as string}
                        className="flex items-center justify-between gap-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <span className="tabular-nums font-medium">
                            {formatEUR(p.amount as number)}
                          </span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {formatDate((p.confirmed_at ?? p.created_at) as string)}
                          </span>
                          {(p.ds_authorisation_code as string | null) ? (
                            <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                              aut. {p.ds_authorisation_code as string}
                            </span>
                          ) : null}
                        </div>
                        <span className={`shrink-0 text-xs font-medium ${tone}`}>{label}</span>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {(invoice.portal_token as string | null) ? (
            <Card>
              <CardHeader>
                <CardTitle>Acceso del cliente</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <CopyPortalLink
                  path={`/p/invoice/${invoice.portal_token as string}`}
                  label="Enlace de pago"
                />
                <PortalAccessControls
                  id={invoice.id as string}
                  initialVisible={(invoice.is_client_visible as boolean | null) ?? true}
                  hasPassword={Boolean(invoice.portal_password_hash)}
                  action={updateInvoicePortalAccess}
                />
              </CardContent>
            </Card>
          ) : null}

          {/* QR Verifactu */}
          {qrDataUrl ? (
            <Card>
              <CardHeader>
                <CardTitle>QR Verifactu</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-3">
                <Image src={qrDataUrl} alt="QR Verifactu" width={200} height={200} unoptimized />
                <p className="text-center text-xs text-muted-foreground">
                  Escanea para verificar la factura en la AEAT.
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      {/* Legal footer (RD 1007/2023 — Verifactu) */}
      <p className="text-[11px] leading-relaxed text-muted-foreground border-t border-border pt-4">
        Factura verificable en la sede electrónica de la AEAT mediante el código QR. Sistema de
        emisión conforme al Reglamento Verifactu (RD 1007/2023). Conserve esta factura conforme a la
        normativa fiscal aplicable.
      </p>
    </div>
  );
}
