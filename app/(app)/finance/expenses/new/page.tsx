import { BackLink } from "@/components/layout/back-link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { createExpense } from "../actions";
import { ExpenseFormFields } from "../expense-form-fields";

export const metadata = { title: "Nuevo gasto · doscientos" };
export const dynamic = "force-dynamic";

export default async function NewExpensePage() {
  await requireUser();
  const supabase = await createServerClient();
  const { data: projectsRaw } = await supabase
    .from("projects")
    .select("id, name, clients(name)")
    .is("deleted_at", null)
    .order("name");

  const projects = ((projectsRaw ?? []) as Array<{
    id: string;
    name: string;
    clients: { name: string } | null;
  }>).map((p) => ({ id: p.id, name: p.name, clientName: p.clients?.name ?? null }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Nuevo gasto"
        description="Registra un gasto operativo (Vercel, Supabase, dominios, software…)."
        back={<BackLink href="/finance/expenses" label="Volver a gastos" />}
      />
      <Card>
        <CardContent className="pt-6">
          <form action={createExpense} className="flex flex-col gap-5">
            <ExpenseFormFields autoFocusVendor projects={projects} />
            <div className="flex justify-end border-t border-border pt-4">
              <Button type="submit" size="sm">
                Crear gasto
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
