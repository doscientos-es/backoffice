import { DetailGrid, DetailRow } from "@/components/layout/detail-grid";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { publicEnv, serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, formatEUR } from "@/lib/utils";
import { buildQrDataUrl, buildQrUrl } from "@/lib/verifactu/qr";
import Image from "next/image";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Factura · doscientos", robots: { index: false, follow: false } };

const STATUS_VARIANT = {
  draft: "neutral",
  issued: "info",
  paid: "success",
  overdue: "danger",
  cancelled: "danger",
} as const;

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  issued: "Emitida",
  paid: "Pagada",
  overdue: "Vencida",
  cancelled: "Anulada",
};

type InvoiceItem = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  subtotal: number;
};

export default async function PortalInvoicePage({
  params,
}: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: invoice } = await admin
    .from("invoices")
    .select("*, clients(name)")
    .eq("portal_token", token)
    .is("deleted_at", null)
    .maybeSingle();

  if (!invoice || invoice.status === "draft") notFound();

  const { data: items } = await admin
    .from("invoice_items")
    .select("id, position, description, quantity, unit_price, vat_rate, subtotal")
    .eq("invoice_id", invoice.id as string)
    .order("position");

  const client = (invoice as unknown as { clients: { name: string } | null }).clients;
  const status = invoice.status as keyof typeof STATUS_VARIANT;
  const safeItems = (items ?? []) as unknown as InvoiceItem[];

  let qrDataUrl: string | null = null;
  const env = serverEnv();
  if (env.VERIFACTU_NIF_EMISOR && invoice.full_number && invoice.issue_date && invoice.total != null) {
    const qrUrl = buildQrUrl(
      {
        nif: env.VERIFACTU_NIF_EMISOR,
        invoiceNumber: invoice.full_number as string,
        issueDate: new Date(invoice.issue_date as string),
        total: invoice.total as number,
      },
      publicEnv.NEXT_PUBLIC_APP_URL,
    );
    qrDataUrl = await buildQrDataUrl(qrUrl);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--text-primary)]">
            Factura {invoice.full_number as string}
          </h1>
          <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status] ?? status}</Badge>
        </div>
        <p className="text-sm text-[color:var(--text-muted)]">
          {client?.name ?? "—"} · Emitida {formatDate(invoice.issue_date as string)}
          {invoice.due_date ? ` · Vence ${formatDate(invoice.due_date as string)}` : ""}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Líneas</CardTitle></CardHeader>
          <CardContent className="px-0">
            {safeItems.length === 0 ? (
              <p className="px-6 py-4 text-sm text-muted-foreground">Sin líneas.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-5 py-2 font-medium">Descripción</th>
                      <th className="px-5 py-2 font-medium text-right">Cant.</th>
                      <th className="px-5 py-2 font-medium text-right">Precio</th>
                      <th className="px-5 py-2 font-medium text-right">IVA</th>
                      <th className="px-5 py-2 font-medium text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {safeItems.map((item) => (
                      <tr key={item.id} className="border-t border-border">
                        <td className="px-5 py-2.5">{item.description}</td>
                        <td className="px-5 py-2.5 text-right tabular-nums">{item.quantity}</td>
                        <td className="px-5 py-2.5 text-right tabular-nums">{formatEUR(item.unit_price)}</td>
                        <td className="px-5 py-2.5 text-right tabular-nums">{item.vat_rate}%</td>
                        <td className="px-5 py-2.5 text-right tabular-nums font-medium">
                          {formatEUR(item.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-border">
                    <tr>
                      <td colSpan={4} className="px-5 py-2.5 text-right text-xs text-muted-foreground">Subtotal</td>
                      <td className="px-5 py-2.5 text-right tabular-nums">{formatEUR(invoice.subtotal as number)}</td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="px-5 py-2.5 text-right text-xs text-muted-foreground">IVA</td>
                      <td className="px-5 py-2.5 text-right tabular-nums">{formatEUR(invoice.tax_amount as number)}</td>
                    </tr>
                    <tr className="font-semibold">
                      <td colSpan={4} className="px-5 py-2.5 text-right">Total</td>
                      <td className="px-5 py-2.5 text-right tabular-nums">{formatEUR(invoice.total as number)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader><CardTitle>Información fiscal</CardTitle></CardHeader>
            <CardContent>
              <DetailGrid>
                <DetailRow label="Nº factura">{invoice.full_number as string}</DetailRow>
                {(invoice.idfact as string | null) ? (
                  <DetailRow label="IDFACT">
                    <span className="break-all font-mono text-xs">{invoice.idfact as string}</span>
                  </DetailRow>
                ) : null}
                <DetailRow label="Tipo">{invoice.invoice_type as string}</DetailRow>
                {(invoice.client_nif as string | null) ? (
                  <DetailRow label="NIF cliente">{invoice.client_nif as string}</DetailRow>
                ) : null}
                {(invoice.verifactu_csv as string | null) ? (
                  <DetailRow label="CSV AEAT">
                    <span className="break-all font-mono text-xs">{invoice.verifactu_csv as string}</span>
                  </DetailRow>
                ) : null}
              </DetailGrid>
            </CardContent>
          </Card>

          {qrDataUrl ? (
            <Card>
              <CardHeader><CardTitle>QR Verifactu</CardTitle></CardHeader>
              <CardContent className="flex flex-col items-center gap-3">
                <Image src={qrDataUrl} alt="QR Verifactu" width={200} height={200} unoptimized />
                <p className="text-center text-xs text-muted-foreground">
                  Escanea para verificar la factura.
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
