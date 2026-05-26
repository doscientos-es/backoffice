"use server";

import { requireUser } from "@/lib/auth";
import { scopedLogger } from "@/lib/logger";
import { createServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const log = scopedLogger("proposals");

const LineItem = z.object({
  description: z.string().min(1, "Descripción obligatoria").max(500),
  quantity: z.coerce.number().positive("Cantidad > 0"),
  unit_price: z.coerce.number().nonnegative("Precio ≥ 0"),
  vat_rate: z.coerce.number().min(0).max(100).default(21),
});

const CreateInput = z.object({
  client_id: z.string().uuid("Cliente inválido"),
  project_id: z
    .string()
    .uuid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  title: z.string().min(1, "Título obligatorio").max(200),
  valid_until: z
    .string()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  notes: z.string().max(4000).optional(),
  items: z.array(LineItem).min(1, "Añade al menos una línea"),
});

function n2(x: number): number {
  return Math.round(x * 100) / 100;
}

async function nextProposalNumber(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
): Promise<string> {
  const year = new Date().getUTCFullYear();
  const prefix = `P-${year}-`;
  const { data } = await supabase
    .from("proposals")
    .select("number")
    .like("number", `${prefix}%`)
    .order("number", { ascending: false })
    .limit(1);
  const last = data?.[0]?.number as string | undefined;
  const lastSeq = last ? Number.parseInt(last.slice(prefix.length), 10) || 0 : 0;
  return `${prefix}${String(lastSeq + 1).padStart(4, "0")}`;
}

export async function createProposal(formData: FormData): Promise<void> {
  const user = await requireUser();

  const itemsRaw = formData.get("items")?.toString() ?? "[]";
  let items: unknown;
  try {
    items = JSON.parse(itemsRaw);
  } catch {
    throw new Error("Líneas no válidas");
  }

  const parsed = CreateInput.safeParse({
    client_id: formData.get("client_id")?.toString() ?? "",
    project_id: formData.get("project_id")?.toString() ?? "",
    title: formData.get("title")?.toString() ?? "",
    valid_until: formData.get("valid_until")?.toString() ?? "",
    notes: formData.get("notes")?.toString() ?? "",
    items,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? "Datos no válidos");
  }
  const data = parsed.data;

  let subtotal = 0;
  let taxAmount = 0;
  for (const item of data.items) {
    const lineSubtotal = item.quantity * item.unit_price;
    subtotal += lineSubtotal;
    taxAmount += lineSubtotal * (item.vat_rate / 100);
  }
  subtotal = n2(subtotal);
  taxAmount = n2(taxAmount);
  const total = n2(subtotal + taxAmount);

  const supabase = await createServerClient();
  const number = await nextProposalNumber(supabase);

  const { data: proposal, error } = await supabase
    .from("proposals")
    .insert({
      client_id: data.client_id,
      project_id: data.project_id ?? null,
      number,
      title: data.title,
      status: "draft",
      currency: "EUR",
      subtotal,
      tax_amount: taxAmount,
      total,
      valid_until: data.valid_until ?? null,
      notes: data.notes ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !proposal) {
    log.error({ err: error }, "create_proposal_failed");
    throw new Error(error?.message ?? "No se pudo crear la propuesta");
  }

  const { error: itemsError } = await supabase.from("proposal_items").insert(
    data.items.map((it, idx) => ({
      proposal_id: proposal.id,
      position: idx,
      description: it.description,
      quantity: it.quantity,
      unit_price: it.unit_price,
      vat_rate: it.vat_rate,
    })),
  );
  if (itemsError) {
    log.error({ err: itemsError, proposalId: proposal.id }, "create_proposal_items_failed");
    throw new Error(itemsError.message);
  }

  revalidatePath("/proposals");
  redirect(`/proposals/${proposal.id}`);
}
