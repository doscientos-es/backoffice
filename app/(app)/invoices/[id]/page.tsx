import { DetailGrid, DetailRow } from "@/components/layout/detail-grid";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { formatDate, formatEUR } from "@/lib/utils";
import { buildQrDataUrl, buildQrUrl } from "@/lib/verifactu/qr";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SendAeatButton } from "./send-aeat-button";

export const dynamic = "force-dynamic";

const STATUS_VARIANT = {
  draft: "neutral",
  issued: "info",
  paid: "success",
  overdue: "danger",
  cancelled: "danger",
} as const;

const VERIFACTU_VARIANT = {
  pending: "warning",
  submitted: "info",
  accepted: "success",
  rejected: "danger",
  excluded: "neutral",
} as const;

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser();
  const supabase = await createServerClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, clients(id, name), projects(id, name)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!invoice) notFound();

  const { data: items } = await supabase
    .from("invoice_items")
    .select("id, position, description, quantity, unit_price, vat_rate, subtotal")
    .eq("invoice_id", id)
    .order("position");

  const client = (invoice as unknown as { clients: { id: string; name: string } | null }).clients;
  const project = (invoice as unknown as { projects: { id: string; name: string } | null })
    .projects;

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
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
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
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_VARIANT[invoice.status as keyof typeof STATUS_VARIANT]}>
              {invoice.status as string}
            </Badge>
            <Badge
              variant={
                VERIFACTU_VARIANT[invoice.verifactu_status as keyof typeof VERIFACTU_VARIANT]
              }
            >
              Verifactu: {invoice.verifactu_status as string}
            </Badge>
            {invoice.status !== "draft" &&
            invoice.verifactu_status !== "accepted" &&
            invoice.verifactu_status !== "excluded" ? (
              <SendAeatButton
                invoiceId={invoice.id as string}
                label={
                  invoice.verifactu_status === "rejected" ? "Reintentar envío" : "Enviar a AEAT"
                }
              />
            ) : null}
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
                        Subtotal
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums">
                        {formatEUR(invoice.subtotal as number)}
                      </td>
                    </tr>
                    <tr>
                      <td
                        colSpan={4}
                        className="px-5 py-2.5 text-right text-xs text-muted-foreground"
                      >
                        IVA
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums">
                        {formatEUR(invoice.tax_amount as number)}
                      </td>
                    </tr>
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
    </div>
  );
}
