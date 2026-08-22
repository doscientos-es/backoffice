import { TriangleAlert as AlertTriangle, ExternalLink } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  type InvoiceDisplayItem,
  InvoiceItemsSummary,
} from "@/components/finance/invoice-items-summary";
import { DetailGrid, DetailRow } from "@/components/layout/detail-grid";
import { PageHeader } from "@/components/layout/page-header";
import { CopyPortalLink } from "@/components/portal/copy-portal-link";
import { PortalAccessControls } from "@/components/portal/portal-access-controls";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { requireUser } from "@/lib/auth";
import { buildVatBreakdown } from "@/lib/finance";
import { PAYMENT_METHOD_LABELS, type PaymentMethodType } from "@/lib/schemas/invoice";
import { createServerClient } from "@/lib/supabase/server";
import { cn, formatDate, formatEUR } from "@/lib/utils";
import {
  AEAT_VERIFACTU_ERROR_CATALOG_URL,
  getAeatErrorMetadata,
} from "@/lib/verifactu/aeat-errors";
import { verifactuInvoiceConfigFromEnv } from "@/lib/verifactu/config";
import { updateInvoicePortalAccess } from "../actions";
import { InvoiceActions } from "./invoice-actions";
import { InvoiceStatus } from "./invoice-status";
import { RefreshClientSnapshotButton } from "./refresh-client-snapshot-button";

export const dynamic = "force-dynamic";

function InvoiceInfoField({
  label,
  children,
  className,
  valueClassName,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={cn("mt-1 min-w-0 text-sm leading-5 text-foreground", valueClassName)}>
        {children ?? "—"}
      </dd>
    </div>
  );
}

function verifactuWarnings(value: unknown): Array<{ code: string | null; message: string }> {
  if (
    !value ||
    typeof value !== "object" ||
    !Array.isArray((value as { warnings?: unknown }).warnings)
  ) {
    return [];
  }
  return (value as { warnings: unknown[] }).warnings.flatMap((warning) => {
    if (!warning || typeof warning !== "object") return [];
    const message = (warning as { message?: unknown }).message;
    if (typeof message !== "string" || message.trim().length === 0) return [];
    const code = (warning as { code?: unknown }).code;
    return [{ code: typeof code === "string" ? code : null, message }];
  });
}

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

  const { data: settings } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();

  const { data: payments } = await supabase
    .from("invoice_payments")
    .select("id, amount, status, payment_method, ds_authorisation_code, created_at, confirmed_at")
    .eq("invoice_id", id)
    .order("created_at", { ascending: false });

  const { data: workLogs } = await supabase
    .from("work_logs")
    .select("id, work_date, hours, start_time, end_time, note")
    .eq("invoice_id", id)
    .is("deleted_at", null)
    .order("work_date", { ascending: true });

  const { data: latestFiscalRecord } = await supabase
    .from("verifactu_ledger")
    .select("id, record_payload")
    .eq("invoice_id", id)
    .order("chain_sequence", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: latestFiscalOutbox } = latestFiscalRecord?.id
    ? await supabase
        .from("verifactu_outbox")
        .select("state, next_attempt_at, last_error")
        .eq("ledger_id", latestFiscalRecord.id)
        .maybeSingle()
    : { data: null };

  const confirmedPayments = (payments ?? []).filter((p) => p.status === "confirmed");
  const amountPaid = confirmedPayments.reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
  const amountDue = Math.max(0, Number(invoice.total ?? 0) - amountPaid);
  const aeatWarnings = verifactuWarnings(invoice.verifactu_response);
  const responseAeatCode = (invoice.verifactu_response as { aeatCode?: unknown } | null)?.aeatCode;
  const verifactuAeatCode = typeof responseAeatCode === "string" ? responseAeatCode : null;
  const hasOfficialAeatWarnings = aeatWarnings.some((warning) =>
    getAeatErrorMetadata(warning.code, warning.message),
  );
  const fiscalPayload = latestFiscalRecord?.record_payload as
    | { subsanacion?: unknown; rechazoPrevio?: unknown }
    | undefined;
  const isRegularizationPending =
    invoice.verifactu_status === "submitted" &&
    fiscalPayload?.subsanacion === "S" &&
    (fiscalPayload.rechazoPrevio === "S" || fiscalPayload.rechazoPrevio === "X");

  const client = (
    invoice as unknown as { clients: { id: string; name: string; email: string | null } | null }
  ).clients;
  const project = (invoice as unknown as { projects: { id: string; name: string } | null })
    .projects;
  const issuerCopyText = [
    `Razón social: ${(settings?.company_name as string | null) ?? "—"}`,
    settings?.company_nif ? `NIF: ${settings.company_nif as string}` : null,
    settings?.company_address ? `Domicilio: ${settings.company_address as string}` : null,
    settings?.iban ? `IBAN: ${settings.iban as string}` : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
  const fiscalCopyText = [
    `Nº factura: ${(invoice.full_number as string | null) ?? "—"}`,
    invoice.idfact ? `IDFACT: ${invoice.idfact as string}` : null,
    `Tipo: ${invoice.invoice_type as string}`,
    `Cliente: ${client?.name ?? "—"}`,
    project ? `Proyecto: ${project.name}` : null,
    `Emisión: ${formatDate(invoice.issue_date as string)}`,
    `Vencimiento: ${formatDate(invoice.due_date as string | null)}`,
    invoice.client_nif ? `NIF cliente: ${invoice.client_nif as string}` : null,
    invoice.verifactu_csv ? `CSV AEAT: ${invoice.verifactu_csv as string}` : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");

  // Group line items by VAT rate so we can show a proper desglose por tipo.
  const vatBreakdown = buildVatBreakdown(
    (items ?? []) as Array<{ vat_rate: number | string | null; subtotal: number | string | null }>,
  );

  // New issued invoices persist the QR URL from their immutable RegistroAlta.
  // Rebuilding it is a legacy fallback only, because company settings may later change.
  let qrDataUrl: string | null = null;
  try {
    const persistedQrUrl = typeof invoice.qr_url === "string" ? invoice.qr_url.trim() : "";
    if (persistedQrUrl) {
      const { buildQrDataUrl } = await import("@doscientos/verifactu");
      qrDataUrl = await buildQrDataUrl(persistedQrUrl);
    } else {
      const emisorNif = (settings?.company_nif as string | null) ?? "";
      if (
        !emisorNif ||
        invoice.status === "draft" ||
        !invoice.full_number ||
        !invoice.issue_date ||
        invoice.total == null
      ) {
        throw new Error("No hay datos para reconstruir el QR histórico");
      }
      const { buildQrDataUrl, buildQrUrl } = await import("@doscientos/verifactu");
      const qrUrl = buildQrUrl(
        {
          nif: emisorNif,
          invoiceNumber: invoice.full_number as string,
          issueDate: new Date(`${invoice.issue_date as string}T00:00:00`),
          total: invoice.total as number,
        },
        verifactuInvoiceConfigFromEnv(),
      );
      qrDataUrl = await buildQrDataUrl(qrUrl);
    }
  } catch {
    // QR rendering is non-critical; a historic QR without its persisted URL
    // may be unavailable until its legacy fiscal configuration is restored.
  }

  return (
    <div className="flex flex-col gap-6">
      {invoice.verifactu_status === "accepted" && aeatWarnings.length > 0 ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold">AEAT aceptó la factura con avisos</p>
            <ul className="mt-1 list-disc pl-4">
              {aeatWarnings.map((warning) => {
                const metadata = getAeatErrorMetadata(warning.code, warning.message);
                return (
                  <li
                    key={`${warning.code ?? "warning"}-${warning.message}`}
                    className="wrap-break-word"
                  >
                    {warning.code ? `${warning.code}: ` : ""}
                    {warning.message}
                    {metadata ? (
                      <span className="block text-xs">{metadata.effectLabel}</span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-300/80">
              El registro está aceptado y conserva su CSV, pero estos avisos deben revisarse y
              subsanarse.
            </p>
            {hasOfficialAeatWarnings ? (
              <a
                href={AEAT_VERIFACTU_ERROR_CATALOG_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium underline-offset-4 hover:underline"
              >
                Consultar catálogo oficial de errores AEAT
                <ExternalLink className="size-3" aria-hidden />
              </a>
            ) : null}
          </div>
        </div>
      ) : null}

      <PageHeader
        title={`Factura ${(invoice.full_number as string | null) ?? "Borrador"}`}
        description={client?.name}
        meta={
          <InvoiceStatus
            status={invoice.status as string}
            verifactuStatus={invoice.verifactu_status as string}
            verifactuError={(invoice.verifactu_error as string | null) ?? null}
            verifactuAeatCode={verifactuAeatCode}
          />
        }
        breadcrumbs={[
          { label: "Facturas", href: "/invoices" },
          ...(client ? [{ label: client.name, href: `/clients/${client.id}` }] : []),
          ...(project ? [{ label: project.name, href: `/projects/${project.id}` }] : []),
          { label: (invoice.full_number as string | null) ?? "Borrador" },
        ]}
        actions={
          <InvoiceActions
            invoice={{
              id: invoice.id as string,
              status: invoice.status as string,
              verifactu_status: invoice.verifactu_status as string,
              verifactu_error: (invoice.verifactu_error as string | null) ?? null,
              fiscal_delivery_state: (latestFiscalOutbox?.state as string | null) ?? null,
              is_regularization_pending: isRegularizationPending,
              is_rectification: Boolean(invoice.is_rectification),
              is_uncollectible: Boolean(invoice.is_uncollectible),
              total: Number(invoice.total ?? 0),
              amountPaid,
            }}
            clientEmail={client?.email ?? null}
          />
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* Line items */}
        <Card className="min-w-0">
          <CardHeader className="border-b">
            <CardTitle>Conceptos</CardTitle>
            <CardDescription>
              {items?.length ?? 0} {(items?.length ?? 0) === 1 ? "concepto" : "conceptos"}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <InvoiceItemsSummary
              items={(items ?? []) as unknown as InvoiceDisplayItem[]}
              subtotal={Number(invoice.subtotal ?? 0)}
              total={Number(invoice.total ?? 0)}
              vatBreakdown={vatBreakdown}
            />
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="flex min-w-0 flex-col gap-6">
          {/* Issuer (datos del emisor) */}
          {settings ? (
            <Card>
              <CardHeader>
                <CardTitle>Emisor</CardTitle>
                <CardAction>
                  <CopyButton
                    text={issuerCopyText}
                    label="Copiar datos del emisor"
                    successMessage="Datos del emisor copiados"
                    showLabel
                  />
                </CardAction>
              </CardHeader>
              <CardContent>
                <dl className="grid min-w-0 gap-4">
                  <InvoiceInfoField label="Razón social">
                    {(settings.company_name as string | null) ?? "—"}
                  </InvoiceInfoField>
                  {(settings.company_nif as string | null) ? (
                    <InvoiceInfoField label="NIF">
                      {settings.company_nif as string}
                    </InvoiceInfoField>
                  ) : null}
                  {(settings.company_address as string | null) ? (
                    <InvoiceInfoField label="Domicilio" valueClassName="whitespace-pre-line">
                      {settings.company_address as string}
                    </InvoiceInfoField>
                  ) : null}
                  {(settings.iban as string | null) ? (
                    <InvoiceInfoField
                      label="IBAN"
                      valueClassName="overflow-x-auto whitespace-nowrap pb-1 font-mono text-xs"
                    >
                      {settings.iban as string}
                    </InvoiceInfoField>
                  ) : null}
                </dl>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Información fiscal</CardTitle>
              <CardAction className="flex items-center gap-1">
                <CopyButton
                  text={fiscalCopyText}
                  label="Copiar información fiscal"
                  successMessage="Información fiscal copiada"
                  showLabel
                />
                {invoice.status === "draft" && client?.id ? (
                  <RefreshClientSnapshotButton invoiceId={invoice.id as string} />
                ) : null}
              </CardAction>
            </CardHeader>
            <CardContent>
              <dl className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-4">
                <InvoiceInfoField label="Nº factura">
                  {(invoice.full_number as string | null) ?? "—"}
                </InvoiceInfoField>
                <InvoiceInfoField label="Tipo">{invoice.invoice_type as string}</InvoiceInfoField>
                {(invoice.idfact as string | null) ? (
                  <InvoiceInfoField
                    label="IDFACT"
                    className="col-span-2"
                    valueClassName="overflow-x-auto whitespace-nowrap pb-1 font-mono text-xs"
                  >
                    {invoice.idfact as string}
                  </InvoiceInfoField>
                ) : null}
                <InvoiceInfoField label="Cliente" className="col-span-2">
                  {client ? (
                    <Link href={`/clients/${client.id}`} className="hover:underline">
                      {client.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </InvoiceInfoField>
                {project ? (
                  <InvoiceInfoField label="Proyecto" className="col-span-2">
                    <Link href={`/projects/${project.id}`} className="hover:underline">
                      {project.name}
                    </Link>
                  </InvoiceInfoField>
                ) : null}
                <InvoiceInfoField label="Emisión">
                  {formatDate(invoice.issue_date as string)}
                </InvoiceInfoField>
                <InvoiceInfoField label="Vencimiento">
                  {formatDate(invoice.due_date as string | null)}
                </InvoiceInfoField>
                {(invoice.client_nif as string | null) ? (
                  <InvoiceInfoField label="NIF cliente" className="col-span-2">
                    {invoice.client_nif as string}
                  </InvoiceInfoField>
                ) : null}
                {(invoice.verifactu_csv as string | null) ? (
                  <InvoiceInfoField
                    label="CSV AEAT"
                    className="col-span-2"
                    valueClassName="overflow-x-auto whitespace-nowrap pb-1 font-mono text-xs"
                  >
                    {invoice.verifactu_csv as string}
                  </InvoiceInfoField>
                ) : null}
              </dl>
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
                          {(p.payment_method as PaymentMethodType | null) ? (
                            <span className="ml-2 text-xs text-muted-foreground">
                              {PAYMENT_METHOD_LABELS[p.payment_method as PaymentMethodType]}
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

      {/* Work log breakdown */}
      {workLogs && workLogs.length > 0 ? (
        <div className="rounded-xl bg-card ring-1 ring-foreground/10 overflow-hidden">
          <Accordion type="single" collapsible>
            <AccordionItem value="work-logs" className="border-b-0">
              <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/50 active:bg-muted/80 transition-colors rounded-none border-0 cursor-pointer select-none">
                <div className="flex flex-col gap-0.5">
                  <span className="text-base font-semibold">Desglose de actividad</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {workLogs.length} {workLogs.length === 1 ? "registro" : "registros"} ·{" "}
                    {workLogs.reduce((s, l) => s + Number(l.hours), 0).toFixed(2)} h
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-0 pb-0">
                <div className="border-t border-border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-5 py-2 font-medium">Fecha</th>
                        <th className="px-5 py-2 font-medium">Horario</th>
                        <th className="px-5 py-2 font-medium text-right">Horas</th>
                        <th className="px-5 py-2 font-medium">Descripción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workLogs.map((log) => (
                        <tr key={log.id as string} className="border-t border-border">
                          <td className="px-5 py-2.5 tabular-nums whitespace-nowrap">
                            {formatDate(log.work_date as string)}
                          </td>
                          <td className="px-5 py-2.5 tabular-nums text-muted-foreground whitespace-nowrap">
                            {log.start_time && log.end_time
                              ? `${(log.start_time as string).slice(0, 5)} – ${(log.end_time as string).slice(0, 5)}`
                              : "—"}
                          </td>
                          <td className="px-5 py-2.5 text-right tabular-nums">
                            {Number(log.hours).toFixed(2)} h
                          </td>
                          <td className="px-5 py-2.5 text-muted-foreground">
                            {(log.note as string | null) ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-border">
                      <tr className="font-semibold">
                        <td
                          colSpan={2}
                          className="px-5 py-2.5 text-right text-xs text-muted-foreground"
                        >
                          Total horas
                        </td>
                        <td className="px-5 py-2.5 text-right tabular-nums">
                          {workLogs.reduce((s, l) => s + Number(l.hours), 0).toFixed(2)} h
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      ) : null}

      {/* Legal footer (RD 1007/2023 — Verifactu) */}
      <p className="text-[11px] leading-relaxed text-muted-foreground border-t border-border pt-4">
        Factura verificable en la sede electrónica de la AEAT mediante el código QR. Sistema de
        emisión conforme al Reglamento Verifactu (RD 1007/2023). Conserve esta factura conforme a la
        normativa fiscal aplicable.
      </p>
    </div>
  );
}
