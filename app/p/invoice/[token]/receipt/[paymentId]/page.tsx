import { notFound } from "next/navigation";

import { PaymentReceipt } from "@/components/portal/payment-receipt";
import { resolvePortalLanguage } from "@/lib/portal/language";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string; paymentId: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { token, paymentId } = await params;
  const { lang } = await searchParams;
  const admin = createAdminClient();

  // Load invoice to verify token and get context
  const { data: invoice } = await admin
    .from("invoices")
    .select("*, clients(name, lead_id, leads(language))")
    .eq("portal_token", token)
    .maybeSingle();

  if (!invoice) notFound();
  const language = resolvePortalLanguage(
    (invoice.clients as { leads?: { language?: string | null } | null } | null)?.leads?.language,
    lang,
  );

  // Load specific payment
  const { data: payment } = await admin
    .from("invoice_payments")
    .select("*")
    .eq("id", paymentId)
    .eq("invoice_id", invoice.id as string)
    .eq("status", "confirmed")
    .maybeSingle();

  if (!payment) notFound();

  const { data: settings } = await admin.from("settings").select("*").eq("id", 1).maybeSingle();
  const client = (invoice as unknown as { clients: { name: string } | null }).clients;

  return (
    <PaymentReceipt
      orderRef={payment.redsys_order as string | null}
      company={{
        name: settings?.company_name as string | null,
        nif: settings?.company_nif as string | null,
        address: (settings?.company_address as string | null) || null,
      }}
      recipientName={client?.name ?? "—"}
      recipientNif={invoice.client_nif as string | null}
      conceptTitle={`${language === "en" ? "Invoice" : "Factura"} ${invoice.full_number as string}`}
      conceptSubtitle={`${language === "ca" ? "Emesa el" : language === "en" ? "Issued on" : "Emitida el"} ${invoice.issue_date ? new Intl.DateTimeFormat(language === "en" ? "en-GB" : `${language}-ES`, { dateStyle: "long" }).format(new Date(invoice.issue_date as string)) : "—"}`}
      confirmedAt={payment.confirmed_at as string | null}
      authorisationCode={payment.ds_authorisation_code as string | null}
      amount={Number(payment.amount)}
      language={language}
      footerNote={
        language === "ca"
          ? "Aquest document justifica la transacció feta a través de la nostra passarel·la de pagaments. Conserva aquest comprovant amb la factura per a qualsevol reclamació."
          : language === "en"
            ? "This document is proof of the transaction made through our payment gateway. Keep this receipt with your invoice for any claim."
            : "Este documento es un justificante de la transacción realizada a través de nuestra pasarela de pagos. Conserve este comprobante junto con su factura para cualquier reclamación."
      }
    />
  );
}
