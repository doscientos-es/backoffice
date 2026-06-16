"use server";

import { defineAction } from "@/lib/actions/define-action";
import { requireUser } from "@/lib/auth";
import { computeLineTotals } from "@/lib/finance";
import { scopedLogger } from "@/lib/logger";
import { createServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const log = scopedLogger("subscriptions");

const subscriptionSchema = z.object({
  client_id: z.string().uuid("Cliente requerido"),
  project_id: z.string().uuid().optional().or(z.literal("")),
  name: z.string().min(1, "Nombre requerido").max(200),
  description: z.string().max(1000).optional(),
  status: z.enum(["active", "paused", "cancelled"]).default("active"),
  billing_cycle: z.enum(["monthly", "quarterly", "yearly"]).default("monthly"),
  amount: z.coerce.number().min(0, "Importe requerido"),
  vat_rate: z.coerce.number().min(0).max(100).default(21),
  start_date: z.string().date(),
  next_invoice_date: z.string().date(),
  end_date: z.string().date().optional().or(z.literal("")),
  notes: z.string().max(2000).optional(),
});

export const createSubscription = defineAction({
  name: "subscriptions.create",
  schema: subscriptionSchema,
  roles: ["owner", "admin", "member"],
  revalidate: ["/subscriptions"],
  async handler(input) {
    const supabase = await createServerClient();
    const { error } = await supabase.from("subscriptions").insert({
      ...input,
      project_id: input.project_id || null,
      end_date: input.end_date || null,
    });
    if (error) throw new Error(error.message);
  },
});

export const updateSubscription = defineAction({
  name: "subscriptions.update",
  schema: subscriptionSchema.extend({ id: z.string().uuid() }),
  roles: ["owner", "admin", "member"],
  revalidate: (_, input) => ["/subscriptions", `/subscriptions/${input.id}`],
  async handler(input) {
    const supabase = await createServerClient();
    const { error } = await supabase
      .from("subscriptions")
      .update({
        ...input,
        project_id: input.project_id || null,
        end_date: input.end_date || null,
      })
      .eq("id", input.id);
    if (error) throw new Error(error.message);
  },
});

export const deleteSubscription = defineAction({
  name: "subscriptions.delete",
  schema: z.object({ id: z.string().uuid() }),
  roles: ["owner", "admin"],
  revalidate: ["/subscriptions"],
  async handler({ id }) {
    const supabase = await createServerClient();
    const { error } = await supabase
      .from("subscriptions")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error(error.message);
  },
});

export const restoreSubscription = defineAction({
  name: "subscriptions.restore",
  schema: z.object({ id: z.string().uuid() }),
  roles: ["owner", "admin"],
  revalidate: ["/subscriptions"],
  async handler({ id }) {
    const supabase = await createServerClient();
    const { error } = await supabase
      .from("subscriptions")
      .update({ deleted_at: null })
      .eq("id", id);
    if (error) throw new Error(error.message);
  },
});

// ---------------------------------------------------------------------------
// Generate a draft invoice from a subscription and advance next_invoice_date.
// ---------------------------------------------------------------------------
function advanceDate(date: string, cycle: string): string {
  const d = new Date(date);
  if (cycle === "monthly") d.setMonth(d.getMonth() + 1);
  else if (cycle === "quarterly") d.setMonth(d.getMonth() + 3);
  else if (cycle === "yearly") d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

export async function createInvoiceFromSubscription(
  subscriptionId: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = await requireUser();
  if (user.role === "viewer") return { ok: false, error: "Sin permisos" };

  const supabase = await createServerClient();

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id, name, amount, vat_rate, billing_cycle, next_invoice_date, client_id, project_id, status")
    .eq("id", subscriptionId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!sub) return { ok: false, error: "Suscripción no encontrada" };
  if (sub.status === "cancelled") return { ok: false, error: "La suscripción está cancelada" };

  const { data: client } = await supabase
    .from("clients")
    .select("name, nif, billing_address")
    .eq("id", sub.client_id as string)
    .maybeSingle();

  const { data: settings } = await supabase
    .from("settings")
    .select("invoice_series")
    .eq("id", 1)
    .maybeSingle();
  const series = ((settings?.invoice_series as string | null) ?? "A").trim() || "A";

  const { data: lastInSeries } = await supabase
    .from("invoices")
    .select("number")
    .eq("series", series)
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextNumber = ((lastInSeries?.number as number | null) ?? 0) + 1;

  const amount = Number(sub.amount);
  const vatRate = Number(sub.vat_rate);
  const { subtotal, taxAmount, total } = computeLineTotals([
    { quantity: 1, unit_price: amount, vat_rate: vatRate },
  ]);

  const { data: invoice, error: insertError } = await supabase
    .from("invoices")
    .insert({
      client_id: sub.client_id,
      project_id: (sub.project_id as string | null) ?? null,
      series,
      number: nextNumber,
      status: "draft",
      currency: "EUR",
      subtotal,
      tax_amount: taxAmount,
      total,
      client_nif: (client?.nif as string | null) ?? null,
      client_name: (client?.name as string | null) ?? null,
      client_address: (client?.billing_address as string | null) ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insertError || !invoice) {
    log.error({ err: insertError, subscriptionId }, "create_invoice_from_subscription_failed");
    return { ok: false, error: insertError?.message ?? "No se pudo crear la factura" };
  }

  const { error: itemError } = await supabase.from("invoice_items").insert({
    invoice_id: invoice.id,
    position: 0,
    description: sub.name as string,
    quantity: 1,
    unit_price: amount,
    vat_rate: vatRate,
  });

  if (itemError) {
    log.error({ err: itemError, invoiceId: invoice.id }, "create_invoice_from_subscription_items_failed");
    return { ok: false, error: itemError.message };
  }

  // Advance next_invoice_date
  const newNextDate = advanceDate(
    (sub.next_invoice_date as string) ?? new Date().toISOString().slice(0, 10),
    sub.billing_cycle as string,
  );
  await supabase
    .from("subscriptions")
    .update({ next_invoice_date: newNextDate })
    .eq("id", subscriptionId);

  revalidatePath("/invoices");
  revalidatePath(`/subscriptions/${subscriptionId}`);

  return { ok: true, id: invoice.id as string };
}
