import { BackLink } from "@/components/layout/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { getExpenseDetail } from "@/lib/finance/queries";
import { createServerClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import { NewExpenseForm } from "./new-expense-form";

export const metadata: Metadata = { title: "Nuevo gasto · doscientos" };
export const dynamic = "force-dynamic";

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  await requireUser();
  const { from } = await searchParams;

  const supabase = await createServerClient();

  const [{ data: projectsRaw }, { data: teamMembersRaw }, sourceExpense] = await Promise.all([
    supabase.from("projects").select("id, name, clients(name)").is("deleted_at", null).order("name"),
    supabase.from("team_members").select("id, name").is("deleted_at", null).order("name"),
    from ? getExpenseDetail(from) : Promise.resolve(null),
  ]);

  const projects = ((projectsRaw ?? []) as unknown as Array<{
    id: string;
    name: string;
    clients: { name: string } | { name: string }[] | null;
  }>).map((p) => {
    const client = Array.isArray(p.clients) ? p.clients[0] ?? null : p.clients;
    return { id: p.id, name: p.name, clientName: client?.name ?? null };
  });

  const teamMembers = (teamMembersRaw ?? []) as Array<{ id: string; name: string }>;

  const defaults = sourceExpense?.expense
    ? {
      vendor: sourceExpense.expense.vendor,
      description: sourceExpense.expense.description,
      category: sourceExpense.expense.category,
      status: sourceExpense.expense.status,
      recurrence: sourceExpense.expense.recurrence,
      currency: sourceExpense.expense.currency,
      subtotal: sourceExpense.expense.subtotal,
      tax_rate: sourceExpense.expense.tax_rate,
      vendor_nif: sourceExpense.expense.vendor_nif,
      invoice_reference: null, // don't copy invoice ref
      project_id: sourceExpense.expense.project_id,
      notes: sourceExpense.expense.notes,
      payment_source: sourceExpense.expense.payment_source,
      paid_by_member_id: sourceExpense.expense.paid_by_member_id,
    }
    : undefined;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={from ? "Duplicar gasto" : "Nuevo gasto"}
        description={
          from
            ? "Copia basada en un gasto existente. Cambia lo que necesites."
            : "Registra un gasto operativo (Vercel, Supabase, dominios, software…)."
        }
        back={<BackLink href="/finance/expenses" label="Volver a gastos" />}
      />
      <Card>
        <CardContent className="pt-6">
          <NewExpenseForm projects={projects} teamMembers={teamMembers} defaults={defaults} />
        </CardContent>
      </Card>
    </div>
  );
}
