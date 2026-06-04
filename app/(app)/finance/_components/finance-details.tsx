import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/finance";
import { getExpenseVendorSuggestions, getFinanceDetails } from "@/lib/finance/queries";
import { createServerClient } from "@/lib/supabase/server";
import { formatDate, formatEUR } from "@/lib/utils";
import Link from "next/link";
import { ExpenseListActions } from "../expenses/_components/expense-list-actions";

export async function FinanceDetails() {
  const user = await requireUser();
  const supabase = await createServerClient();
  const [
    { topCategories, recentExpenses, recentInvoices, memberContributions },
    { data: projectsRaw },
    { data: teamMembersRaw },
    vendorSuggestions,
  ] = await Promise.all([
    getFinanceDetails(),
    supabase
      .from("projects")
      .select("id, name, clients(name)")
      .is("deleted_at", null)
      .order("name"),
    supabase.from("team_members").select("id, name").is("deleted_at", null).order("name"),
    getExpenseVendorSuggestions(),
  ]);

  const projects = (projectsRaw ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    clientName: (p.clients as unknown as { name: string } | null)?.name ?? null,
  }));
  const teamMembers = (teamMembersRaw ?? []) as Array<{ id: string; name: string }>;
  const canEdit = user.role !== "viewer";
  const canDelete = user.role === "owner" || user.role === "admin";

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Top categorías · este mes</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {topCategories.length === 0 ? (
              <p className="px-6 py-2 text-sm text-muted-foreground">Sin gastos este mes.</p>
            ) : (
              <ul className="divide-y divide-border">
                {topCategories.map(([cat, total]) => (
                  <li key={cat} className="flex items-center justify-between px-6 py-2.5 text-sm">
                    <span>{EXPENSE_CATEGORY_LABELS[cat] ?? cat}</span>
                    <span className="font-medium tabular-nums">{formatEUR(total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Últimas facturas emitidas</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {recentInvoices.length === 0 ? (
              <p className="px-6 py-2 text-sm text-muted-foreground">Sin facturas recientes.</p>
            ) : (
              <ul className="divide-y divide-border">
                {recentInvoices.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex items-center justify-between px-6 py-2.5 text-sm"
                  >
                    <Link href={`/invoices/${inv.id}`} className="font-medium hover:underline">
                      {inv.full_number ?? "—"}
                      {inv.client_name ? (
                        <span className="ml-2 text-muted-foreground">· {inv.client_name}</span>
                      ) : null}
                    </Link>
                    <span className="tabular-nums">{formatEUR(inv.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Últimos gastos</CardTitle>
            <Link
              href="/finance/expenses"
              className="text-xs text-muted-foreground hover:underline"
            >
              Ver todos →
            </Link>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {recentExpenses.length === 0 ? (
            <p className="px-6 py-2 text-sm text-muted-foreground">Sin gastos aún.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recentExpenses.map((e) => (
                <li
                  key={e.id}
                  className="group flex items-center justify-between gap-3 px-6 py-2.5 text-sm"
                >
                  <Link href={`/finance/expenses/${e.id}`} className="font-medium hover:underline">
                    {e.vendor}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {EXPENSE_CATEGORY_LABELS[e.category] ?? e.category} ·{" "}
                      {formatDate(e.expense_date)}
                    </span>
                  </Link>
                  <div className="flex items-center gap-2">
                    {canEdit ? (
                      <ExpenseListActions
                        expense={e}
                        projects={projects}
                        teamMembers={teamMembers}
                        vendorSuggestions={vendorSuggestions}
                        canDelete={canDelete}
                      />
                    ) : null}
                    <span className="tabular-nums">{formatEUR(e.total)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {memberContributions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Aportaciones de socios</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <ul className="divide-y divide-border">
              {memberContributions
                .sort((a, b) => b.total - a.total)
                .map((c) => (
                  <li
                    key={c.memberId}
                    className="flex items-center justify-between px-6 py-2.5 text-sm"
                  >
                    <span className="font-medium">{c.memberName}</span>
                    <span className="tabular-nums">{formatEUR(c.total)}</span>
                  </li>
                ))}
            </ul>
            {memberContributions.length === 2 && (
              <div className="border-t border-border px-6 py-2 text-xs text-muted-foreground">
                Diferencia:{" "}
                <span className="font-medium tabular-nums text-foreground">
                  {formatEUR(
                    Math.abs(
                      (memberContributions[0]?.total ?? 0) - (memberContributions[1]?.total ?? 0),
                    ),
                  )}
                </span>{" "}
                a favor de{" "}
                {(memberContributions[0]?.total ?? 0) >= (memberContributions[1]?.total ?? 0)
                  ? memberContributions[0]?.memberName
                  : memberContributions[1]?.memberName}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
