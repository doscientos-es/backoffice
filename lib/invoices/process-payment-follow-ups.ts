import { InvoiceEmail } from "@/components/email";
import { externalAppUrl } from "@/lib/email/app-url";
import { renderEmail } from "@/lib/email/render";
import { sendEmail } from "@/lib/email/resend";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, formatEUR } from "@/lib/utils";

type FollowUpRow = {
  id: string;
  invoice_id: string;
  recipient: string;
  subject: string;
  message: string;
  attempt_count: number;
  invoices: {
    status: string;
    full_number: string | null;
    total: number | null;
    due_date: string | null;
    portal_token: string | null;
    is_client_visible: boolean | null;
    clients: {
      name: string;
      email: string | null;
      leads: { language: "es" | "ca" | "en" | null } | null;
    } | null;
  } | null;
};

function portalUrl(token: string, language: "es" | "ca" | "en"): string {
  return `${externalAppUrl(publicEnv.NEXT_PUBLIC_APP_URL)}/p/invoice/${token}?lang=${language}`;
}

export async function processDueInvoicePaymentFollowUps(limit = 25) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("invoice_automations")
    .select(
      "id, invoice_id, recipient, subject, message, attempt_count, invoices(status, full_number, total, due_date, portal_token, is_client_visible, clients(name, email, lead_id, leads(language)))",
    )
    .eq("kind", "payment_follow_up")
    .eq("status", "pending")
    .lte("run_at", new Date().toISOString())
    .order("run_at")
    .limit(limit);
  if (error) throw new Error(error.message);

  const summary = { sent: 0, skipped: 0, failed: 0 };
  for (const row of (data ?? []) as unknown as FollowUpRow[]) {
    const { data: claimed, error: claimError } = await supabase
      .from("invoice_automations")
      .update({
        status: "processing",
        attempt_count: row.attempt_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (claimError) throw new Error(claimError.message);
    if (!claimed) continue;

    const invoice = row.invoices;
    if (
      !invoice ||
      invoice.status === "paid" ||
      invoice.status === "cancelled" ||
      !invoice.portal_token ||
      invoice.is_client_visible === false ||
      !row.recipient
    ) {
      await supabase
        .from("invoice_automations")
        .update({ status: "skipped", updated_at: new Date().toISOString() })
        .eq("id", row.id);
      summary.skipped += 1;
      continue;
    }

    try {
      const number = invoice.full_number ?? "—";
      const language = invoice.clients?.leads?.language ?? "es";
      const amount = Number(invoice.total ?? 0).toFixed(2);
      const message =
        language === "ca"
          ? `Et recordem que la factura ${number} per ${amount} € continua pendent de pagament. Si ja has fet el pagament, pots ignorar aquest missatge.`
          : language === "en"
            ? `This is a reminder that invoice ${number} for €${amount} is still awaiting payment. If you have already paid, please ignore this message.`
            : `Te recordamos que la factura ${number} por ${amount} € sigue pendiente de pago. Si ya has realizado el pago, puedes ignorar este mensaje.`;
      const html = await renderEmail(
        InvoiceEmail({
          clientName: invoice.clients?.name ?? "Hola",
          invoiceNumber: number,
          total: formatEUR(invoice.total ?? 0),
          dueDate: invoice.due_date ? formatDate(invoice.due_date) : "—",
          portalUrl: portalUrl(invoice.portal_token, language),
          appUrl: externalAppUrl(publicEnv.NEXT_PUBLIC_APP_URL),
          message,
          language,
        }),
      );
      const result = await sendEmail({
        fromName: "doscientos",
        fromAlias: "facturacion",
        to: row.recipient,
        replyTo: "hola@doscientos.es",
        subject:
          language === "ca"
            ? `Recordatori de pagament · Factura ${number}`
            : language === "en"
              ? `Payment reminder · Invoice ${number}`
              : row.subject,
        html,
        tags: { invoice_id: row.invoice_id, kind: "invoice_payment_follow_up" },
      });
      await supabase.from("invoice_deliveries").insert({
        invoice_id: row.invoice_id,
        channel: "email",
        recipient: row.recipient,
        provider_message_id: result.id,
        mocked: result.mocked,
        sent_by: null,
      });
      await supabase
        .from("invoice_automations")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          provider_message_id: result.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      summary.sent += 1;
    } catch (caught) {
      await supabase
        .from("invoice_automations")
        .update({
          status: "failed",
          last_error: caught instanceof Error ? caught.message : "Error enviando el seguimiento",
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      summary.failed += 1;
    }
  }
  return summary;
}
