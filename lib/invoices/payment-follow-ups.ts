import type { createServerClient } from "@/lib/supabase/server";

type DbClient = Awaited<ReturnType<typeof createServerClient>>;

export type InvoicePaymentFollowUp = {
  id: string;
  invoice_id: string;
  kind: "payment_follow_up";
  status: "pending" | "processing" | "sent" | "cancelled" | "skipped" | "failed";
  run_at: string;
  recipient: string;
  subject: string;
  message: string;
  attempt_count: number;
  sent_at: string | null;
  cancelled_at: string | null;
  last_error: string | null;
};

const DELAY_DAYS = 4;

function followUpDate(sentAt: string | null): string | null {
  if (!sentAt) return null;
  const date = new Date(sentAt);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + DELAY_DAYS);
  return date.toISOString();
}

export async function scheduleInvoicePaymentFollowUp(
  supabase: DbClient,
  invoiceId: string,
  createdBy: string,
  sentAt?: string,
): Promise<InvoicePaymentFollowUp | null> {
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("id, status, full_number, total, clients(email)")
    .eq("id", invoiceId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!invoice || !["issued", "overdue"].includes(invoice.status as string)) return null;

  const client = (invoice as unknown as { clients: { email: string | null } | null }).clients;
  const recipient = client?.email?.trim() ?? "";
  let deliveryAt = sentAt ?? null;
  if (!deliveryAt) {
    const { data: latestDelivery, error: deliveryError } = await supabase
      .from("invoice_deliveries")
      .select("created_at")
      .eq("invoice_id", invoiceId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (deliveryError) throw new Error(deliveryError.message);
    deliveryAt = (latestDelivery?.created_at as string | null) ?? null;
  }
  const runAt = followUpDate(deliveryAt);
  if (!recipient || !runAt) return null;

  const number = (invoice.full_number as string | null) ?? "sin número";
  const message = `Te recordamos que la factura ${number} por ${Number(invoice.total ?? 0).toFixed(2)} € sigue pendiente de pago. Si ya has realizado el pago, puedes ignorar este mensaje.`;
  const { error: insertError } = await supabase.from("invoice_automations").upsert(
    {
      invoice_id: invoiceId,
      kind: "payment_follow_up",
      status: "pending",
      run_at: runAt,
      recipient,
      subject: `Recordatorio de pago · Factura ${number}`,
      message,
      created_by: createdBy,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "invoice_id,kind", ignoreDuplicates: true },
  );
  if (insertError) throw new Error(insertError.message);
  return findInvoicePaymentFollowUp(supabase, invoiceId);
}

export async function findInvoicePaymentFollowUp(
  supabase: DbClient,
  invoiceId: string,
): Promise<InvoicePaymentFollowUp | null> {
  const { data, error } = await supabase
    .from("invoice_automations")
    .select(
      "id, invoice_id, kind, status, run_at, recipient, subject, message, attempt_count, sent_at, cancelled_at, last_error",
    )
    .eq("invoice_id", invoiceId)
    .eq("kind", "payment_follow_up")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as InvoicePaymentFollowUp | null) ?? null;
}

export async function cancelInvoicePaymentFollowUp(
  supabase: DbClient,
  invoiceId: string,
): Promise<void> {
  const { error } = await supabase
    .from("invoice_automations")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("invoice_id", invoiceId)
    .eq("kind", "payment_follow_up")
    .in("status", ["pending", "failed"]);
  if (error) throw new Error(error.message);
}

export async function rescheduleInvoicePaymentFollowUp(
  supabase: DbClient,
  invoiceId: string,
  runAt: string,
): Promise<void> {
  if (new Date(runAt).getTime() <= Date.now()) throw new Error("La fecha debe estar en el futuro");
  const { error } = await supabase
    .from("invoice_automations")
    .update({
      status: "pending",
      run_at: new Date(runAt).toISOString(),
      cancelled_at: null,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("invoice_id", invoiceId)
    .eq("kind", "payment_follow_up")
    .in("status", ["pending", "failed", "cancelled"]);
  if (error) throw new Error(error.message);
}
