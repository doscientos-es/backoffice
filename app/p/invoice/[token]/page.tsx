import { LogoMark } from "@/components/branding";
import { PortalPasswordGate } from "@/components/portal/password-gate";
import { RedsysPaymentButton } from "@/components/portal/redsys-payment-button";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { getCurrentUser } from "@/lib/auth";
import { publicEnv, serverEnv } from "@/lib/env";
import { buildVatBreakdown } from "@/lib/finance";
import { isPortalUnlocked } from "@/lib/portal/access";
import { INVOICE_STATUS } from "@/lib/status";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, formatEUR } from "@/lib/utils";
import { buildQrDataUrl, buildQrUrl } from "@/lib/verifactu/qr";
import { CheckCircle2, Download, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { unlockInvoicePortal } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Factura · doscientos",
  robots: { index: false, follow: false },
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
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const { token } = await params;
  const { success, error: paymentError } = await searchParams;
  const admin = createAdminClient();

  const { data: invoice } = await admin
    .from("invoices")
    .select("*, clients(name)")
    .eq("portal_token", token)
    .is("deleted_at", null)
    .maybeSingle();

  if (!invoice || invoice.status === "draft") notFound();

  // Client-facing access gate: hidden invoices 404 and password-protected ones
  // show the unlock form until the visitor presents a valid cookie. Logged-in
  // team members always bypass so they can preview the link.
  const auth = await getCurrentUser();
  if (!auth.ok) {
    if ((invoice.is_client_visible as boolean | null) === false) notFound();
    const unlocked = await isPortalUnlocked(
      token,
      (invoice.portal_password_hash as string | null) ?? null,
    );
    if (!unlocked) {
      return <PortalPasswordGate token={token} action={unlockInvoicePortal} />;
    }
  }

  const { data: items } = await admin
    .from("invoice_items")
    .select("id, position, description, quantity, unit_price, vat_rate, subtotal")
    .eq("invoice_id", invoice.id as string)
    .order("position");

  const { data: settings } = await admin.from("settings").select("*").eq("id", 1).maybeSingle();

  const client = (invoice as unknown as { clients: { name: string } | null }).clients;
  const safeItems = (items ?? []) as unknown as InvoiceItem[];

  // Group line items by VAT rate so we can show a proper desglose por tipo.
  const vatBreakdown = buildVatBreakdown(safeItems);

  let qrDataUrl: string | null = null;
  const env = serverEnv();
  if (
    env.VERIFACTU_NIF_EMISOR &&
    invoice.full_number &&
    invoice.issue_date &&
    invoice.total != null
  ) {
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

  // Redsys: determine if payment is available and how much has been paid
  const canPay =
    (invoice.status === "issued" || invoice.status === "overdue") && (invoice.total as number) > 0;

  let amountPaid = 0;
  if (canPay) {
    const { data: confirmedPayments } = await admin
      .from("invoice_payments")
      .select("id, amount, ds_authorisation_code, confirmed_at")
      .eq("invoice_id", invoice.id as string)
      .eq("status", "confirmed")
      .order("confirmed_at", { ascending: false });
    amountPaid = confirmedPayments?.reduce((s, p) => s + Number(p.amount), 0) ?? 0;
  }
  const amountDue = Math.round(((invoice.total as number) - amountPaid) * 100) / 100;

  const payments = canPay
    ? (await admin
      .from("invoice_payments")
      .select("id, amount, ds_authorisation_code, confirmed_at")
      .eq("invoice_id", invoice.id as string)
      .eq("status", "confirmed")
      .order("confirmed_at", { ascending: false })).data ?? []
    : [];

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto py-10 px-4 sm:px-6">
      {success === "1" && (
        <div className="flex items-center gap-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-4 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">¡Pago realizado con éxito! La factura se marcará como pagada en breve.</p>
        </div>
      )}
      {paymentError === "1" && (
        <div className="flex items-center gap-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 p-4 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300">
          <XCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">El pago no se pudo completar. Por favor, inténtelo de nuevo o contacte con soporte.</p>
        </div>
      )}

      {payments.length > 0 && (
        <div className="rounded-xl bg-white dark:bg-zinc-900 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800 overflow-hidden">
          <div className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 bg-zinc-50 dark:bg-zinc-900/50">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Pagos recibidos
            </h3>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {payments.map((p) => (
              <div key={p.id} className="px-6 py-4 flex items-center justify-between gap-4">
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {formatEUR(Number(p.amount))}
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {p.confirmed_at ? formatDate(p.confirmed_at as string) : "Confirmado"} · Aut:{" "}
                    {p.ds_authorisation_code ?? "—"}
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a href={`/p/invoice/${token}/receipt/${p.id}`} target="_blank" rel="noreferrer">
                    <Download className="mr-2 h-4 w-4" />
                    Justificante
                  </a>
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {canPay && amountDue > 0 && (
        <div className="rounded-xl bg-zinc-900 dark:bg-zinc-800 p-6 shadow-sm ring-1 ring-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-col gap-1 text-center sm:text-left">
            <h2 className="text-lg font-bold text-white">Pago online disponible</h2>
            <p className="text-sm text-zinc-400">
              Puede abonar esta factura de forma segura con tarjeta de crédito/débito o Bizum.
            </p>
          </div>
          <RedsysPaymentButton
            invoiceId={invoice.id as string}
            token={token}
            total={invoice.total as number}
            amountPaid={amountPaid}
          />
        </div>
      )}

      <article className="rounded-xl bg-white dark:bg-zinc-900 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800 overflow-hidden">
        {/* Document header */}
        <div className="border-b border-zinc-200 dark:border-zinc-800 px-8 py-7 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 mb-1">
              <LogoMark size={20} className="text-[#2A4227] dark:text-[#9CC196]" />
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                doscientos
              </span>
            </div>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              {invoice.invoice_type as string}
            </p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-1.5">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                {invoice.full_number as string}
              </h1>
              <StatusBadge meta={INVOICE_STATUS} value={invoice.status as string} />
            </div>
            <div className="flex flex-col items-start sm:items-end gap-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {invoice.issue_date ? (
                <span>
                  Emitida:{" "}
                  <strong className="text-zinc-700 dark:text-zinc-300">
                    {formatDate(invoice.issue_date as string)}
                  </strong>
                </span>
              ) : null}
              {invoice.due_date ? (
                <span>
                  Vencimiento:{" "}
                  <strong className="text-zinc-700 dark:text-zinc-300">
                    {formatDate(invoice.due_date as string)}
                  </strong>
                </span>
              ) : null}
            </div>
            <Button variant="outline" size="sm" asChild className="mt-2">
              <a href={`/p/invoice/${token}/pdf`}>
                <Download className="mr-2 h-4 w-4" />
                Descargar PDF
              </a>
            </Button>
          </div>
        </div>

        {/* Issuer + Recipient */}
        <div className="grid border-b border-zinc-100 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-900/50 sm:grid-cols-2">
          {settings ? (
            <div className="px-8 py-5 border-b sm:border-b-0 sm:border-r border-zinc-100 dark:border-zinc-800/60">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-600 mb-1">
                Emitida por
              </p>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {(settings.company_name as string | null) ?? "—"}
              </p>
              {(settings.company_nif as string | null) ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  NIF: {settings.company_nif as string}
                </p>
              ) : null}
              {(settings.company_address as string | null) ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-pre-wrap">
                  {settings.company_address as string}
                </p>
              ) : null}
              {(settings.iban as string | null) ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  IBAN:{" "}
                  <span className="font-mono text-zinc-700 dark:text-zinc-300">
                    {settings.iban as string}
                  </span>
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="px-8 py-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-600 mb-1">
              Facturado a
            </p>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {client?.name ?? "—"}
            </p>
            {(invoice.client_nif as string | null) ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                NIF: {invoice.client_nif as string}
              </p>
            ) : null}
          </div>
        </div>

        {/* Line items */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-8 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
                  Descripción
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
                  Cant.
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
                  Precio
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
                  IVA
                </th>
                <th className="px-8 py-3 text-right text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
                  Subtotal
                </th>
              </tr>
            </thead>
            <tbody>
              {safeItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-6 text-sm text-zinc-400 dark:text-zinc-600">
                    Sin líneas.
                  </td>
                </tr>
              ) : (
                safeItems.map((item, i) => (
                  <tr
                    key={item.id}
                    className={i > 0 ? "border-t border-zinc-100 dark:border-zinc-800/60" : ""}
                  >
                    <td className="px-8 py-3.5 text-zinc-800 dark:text-zinc-200">
                      {item.description}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                      {item.quantity}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                      {formatEUR(item.unit_price)}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                      {item.vat_rate}%
                    </td>
                    <td className="px-8 py-3.5 text-right tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
                      {formatEUR(item.subtotal)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Totals (con desglose de IVA por tipo) */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 px-8 py-5 flex justify-end">
          <div className="flex flex-col gap-1.5 w-72">
            <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <span>Base imponible</span>
              <span className="tabular-nums">{formatEUR(invoice.subtotal as number)}</span>
            </div>
            {vatBreakdown.map((row) => (
              <div
                key={row.rate}
                className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400"
              >
                <span>
                  IVA {row.rate}% sobre {formatEUR(row.base)}
                </span>
                <span className="tabular-nums">{formatEUR(row.tax)}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-bold text-zinc-900 dark:text-zinc-100 border-t border-zinc-200 dark:border-zinc-700 pt-2 mt-1">
              <span>Total</span>
              <span className="tabular-nums">{formatEUR(invoice.total as number)}</span>
            </div>
          </div>
        </div>

        {/* Fiscal info + QR */}
        {(invoice.idfact as string | null) ||
          (invoice.verifactu_csv as string | null) ||
          qrDataUrl ? (
          <div className="border-t border-zinc-100 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-900/50 px-8 py-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-600 mb-0.5">
                Datos fiscales
              </p>
              {(invoice.idfact as string | null) ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  IDFACT:{" "}
                  <span className="font-mono text-zinc-700 dark:text-zinc-300 break-all">
                    {invoice.idfact as string}
                  </span>
                </p>
              ) : null}
              {(invoice.verifactu_csv as string | null) ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  CSV AEAT:{" "}
                  <span className="font-mono text-zinc-700 dark:text-zinc-300 break-all">
                    {invoice.verifactu_csv as string}
                  </span>
                </p>
              ) : null}
            </div>
            {qrDataUrl ? (
              <div className="flex flex-col items-center gap-1.5">
                <Image
                  src={qrDataUrl}
                  alt="QR Verifactu"
                  width={88}
                  height={88}
                  unoptimized
                  className="rounded"
                />
                <p className="text-[10px] text-zinc-400 dark:text-zinc-600">Verificar en AEAT</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Legal footer (RD 1007/2023 — Verifactu) */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 px-8 py-4">
          <p className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            Factura verificable en la sede electrónica de la AEAT mediante el código QR. Sistema de
            emisión conforme al Reglamento Verifactu (RD 1007/2023). Conserve esta factura conforme a
            la normativa fiscal aplicable.
          </p>
        </div>
      </article>
    </div>
  );
}
