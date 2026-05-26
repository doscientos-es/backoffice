"use server";

import { requireRole } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const ImportInput = z.object({
  projectId: z.string().uuid(),
  milestoneId: z.string().uuid(),
  entryIds: z.array(z.string().uuid()).min(1),
});

export async function importHoursToInvoice(
  input: unknown,
): Promise<{ ok: true; invoiceId: string } | { ok: false; error: string }> {
  await requireRole(["owner", "admin"]);
  const parsed = ImportInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };

  const { projectId, milestoneId, entryIds } = parsed.data;
  const supabase = await createServerClient();

  // Fetch project + client
  const { data: project } = await supabase
    .from("projects")
    .select("id, client_id, clients(id, name, nif, billing_address)")
    .eq("id", projectId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!project) return { ok: false, error: "Proyecto no encontrado" };
  const client = (project as unknown as { clients: { id: string; name: string; nif: string | null; billing_address: string | null } | null }).clients;
  if (!client) return { ok: false, error: "El proyecto no tiene cliente asociado" };

  // Fetch selected time entries
  const { data: entries } = await supabase
    .from("time_entries")
    .select("id, description, duration_minutes, started_at, hourly_rate, task:task_id(title)")
    .in("id", entryIds)
    .eq("project_id", projectId)
    .eq("is_billable", true)
    .is("invoiced_at", null);

  if (!entries || entries.length === 0) return { ok: false, error: "Sin entradas válidas" };

  // Generate next invoice number for series 'H' (horas)
  const { data: lastInv } = await supabase
    .from("invoices")
    .select("number")
    .eq("series", "H")
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextNumber = ((lastInv?.number as number | null) ?? 0) + 1;

  // Create draft invoice
  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .insert({
      client_id: client.id,
      project_id: projectId,
      series: "H",
      number: nextNumber,
      status: "draft",
      client_name: client.name,
      client_nif: client.nif ?? null,
      client_address: client.billing_address ?? null,
      notes: `Horas importadas del hito: ${milestoneId}`,
    })
    .select("id")
    .single();

  if (invErr || !invoice) return { ok: false, error: invErr?.message ?? "Error al crear factura" };
  const invoiceId = invoice.id as string;

  // Build invoice items from time entries
  const items = entries.map((e, i) => {
    const task = (e as unknown as { task: { title: string } | null }).task;
    const description = task?.title ?? (e.description as string | null) ?? "Horas de trabajo";
    const durationHours = ((e.duration_minutes as number | null) ?? 0) / 60;
    const rate = (e.hourly_rate as number | null) ?? 0;
    return {
      invoice_id: invoiceId,
      position: i + 1,
      description,
      quantity: parseFloat(durationHours.toFixed(4)),
      unit_price: rate,
      vat_rate: 21,
    };
  });

  const { error: itemsErr } = await supabase.from("invoice_items").insert(items);
  if (itemsErr) return { ok: false, error: itemsErr.message };

  // Mark time entries as invoiced + link to invoice
  const now = new Date().toISOString();
  await supabase
    .from("time_entries")
    .update({ invoiced_at: now, invoice_id: invoiceId })
    .in("id", entryIds);

  // Update milestone status → invoiced
  await supabase
    .from("milestones")
    .update({ status: "invoiced", invoice_id: invoiceId })
    .eq("id", milestoneId);

  // Recalculate invoice totals
  const subtotal = items.reduce((s, item) => s + item.quantity * item.unit_price, 0);
  const taxAmount = items.reduce((s, item) => s + item.quantity * item.unit_price * (item.vat_rate / 100), 0);
  await supabase
    .from("invoices")
    .update({ subtotal: parseFloat(subtotal.toFixed(2)), tax_amount: parseFloat(taxAmount.toFixed(2)), total: parseFloat((subtotal + taxAmount).toFixed(2)) })
    .eq("id", invoiceId);

  return { ok: true, invoiceId };
}
