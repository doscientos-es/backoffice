"use server";

import { requireRole, requireUser } from "@/lib/auth";
import { computeExpenseTotals } from "@/lib/finance";
import {
  ExpenseInput,
  type UpdateExpenseInput as UpdateExpenseInputType,
} from "@/lib/schemas/expense";
import { createServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

export type UpdateExpenseInput = UpdateExpenseInputType;

function readRaw(formData: FormData) {
  return {
    vendor: formData.get("vendor")?.toString() ?? "",
    description: formData.get("description")?.toString() ?? "",
    category: formData.get("category")?.toString() ?? "other",
    status: formData.get("status")?.toString() ?? "paid",
    recurrence: formData.get("recurrence")?.toString() ?? "none",
    expense_date: formData.get("expense_date")?.toString() ?? "",
    due_date: formData.get("due_date")?.toString() ?? "",
    paid_at: formData.get("paid_at")?.toString() ?? "",
    currency: formData.get("currency")?.toString() ?? "EUR",
    subtotal: formData.get("subtotal")?.toString() ?? "0",
    tax_rate: formData.get("tax_rate")?.toString() ?? "21",
    vendor_nif: formData.get("vendor_nif")?.toString() ?? "",
    invoice_reference: formData.get("invoice_reference")?.toString() ?? "",
    project_id: formData.get("project_id")?.toString() ?? "",
    notes: formData.get("notes")?.toString() ?? "",
  };
}

export async function createExpense(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = ExpenseInput.safeParse(readRaw(formData));
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? "Datos no válidos");

  const { subtotal, taxAmount, total } = computeExpenseTotals(
    parsed.data.subtotal,
    parsed.data.tax_rate,
  );

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("expenses")
    .insert({
      vendor: parsed.data.vendor,
      description: parsed.data.description ?? null,
      category: parsed.data.category,
      status: parsed.data.status,
      recurrence: parsed.data.recurrence,
      expense_date: parsed.data.expense_date,
      due_date: parsed.data.due_date ?? null,
      paid_at: parsed.data.paid_at ?? null,
      currency: parsed.data.currency,
      subtotal,
      tax_rate: parsed.data.tax_rate,
      tax_amount: taxAmount,
      total,
      vendor_nif: parsed.data.vendor_nif ?? null,
      invoice_reference: parsed.data.invoice_reference ?? null,
      project_id: parsed.data.project_id ?? null,
      notes: parsed.data.notes ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "No se pudo crear el gasto");
  revalidatePath("/finance");
  revalidatePath("/finance/expenses");
  redirect(`/finance/expenses/${data.id}`);
}

export async function updateExpense(
  input: UpdateExpenseInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireUser();
  if (!z.string().uuid().safeParse(input.id).success) {
    return { ok: false, error: "ID inválido" };
  }

  const parsed = ExpenseInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Datos no válidos" };
  }

  const { subtotal, taxAmount, total } = computeExpenseTotals(
    parsed.data.subtotal,
    parsed.data.tax_rate,
  );

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("expenses")
    .update({
      vendor: parsed.data.vendor,
      description: parsed.data.description ?? null,
      category: parsed.data.category,
      status: parsed.data.status,
      recurrence: parsed.data.recurrence,
      expense_date: parsed.data.expense_date,
      due_date: parsed.data.due_date ?? null,
      paid_at: parsed.data.paid_at ?? null,
      currency: parsed.data.currency,
      subtotal,
      tax_rate: parsed.data.tax_rate,
      tax_amount: taxAmount,
      total,
      vendor_nif: parsed.data.vendor_nif ?? null,
      invoice_reference: parsed.data.invoice_reference ?? null,
      project_id: parsed.data.project_id ?? null,
      notes: parsed.data.notes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/finance/expenses/${input.id}`);
  revalidatePath("/finance/expenses");
  revalidatePath("/finance");
  return { ok: true };
}

export async function deleteExpense(formData: FormData): Promise<void> {
  await requireRole(["owner", "admin"]);
  const id = formData.get("id")?.toString() ?? "";
  if (!z.string().uuid().safeParse(id).success) throw new Error("ID inválido");

  const supabase = await createServerClient();
  const { error } = await supabase
    .from("expenses")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/finance/expenses");
  revalidatePath("/finance");
  redirect("/finance/expenses");
}
