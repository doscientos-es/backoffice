import { createServerClient } from "@/lib/supabase/server";
import { notDeleted } from "@/lib/supabase/filters";
import {
  type ExpenseCategory,
  buildMonthlySeries,
  profitMargin,
} from "./helpers";
import type { FinanceOverview } from "./types";

export async function getFinanceOverview(): Promise<FinanceOverview> {
  const supabase = await createServerClient();

  const today = new Date();
  const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthStartISO = monthStart.toISOString().slice(0, 10);
  const sixMonthsAgoISO = sixMonthsAgo.toISOString().slice(0, 10);

  const [
    { data: revenueRows },
    { data: expenseRows },
    { data: monthRevenue },
    { data: monthExpenses },
    { data: recentExpenses },
    { data: recentInvoices },
  ] = await Promise.all([
    notDeleted(
      supabase
        .from("invoices")
        .select("issue_date, total")
        .gte("issue_date", sixMonthsAgoISO)
        .neq("status", "draft"),
    ),
    notDeleted(
      supabase
        .from("expenses")
        .select("expense_date, total")
        .gte("expense_date", sixMonthsAgoISO)
        .neq("status", "cancelled"),
    ),
    notDeleted(
      supabase
        .from("invoices")
        .select("total")
        .gte("issue_date", monthStartISO)
        .neq("status", "draft"),
    ),
    notDeleted(
      supabase
        .from("expenses")
        .select("total, category")
        .gte("expense_date", monthStartISO)
        .neq("status", "cancelled"),
    ),
    notDeleted(
      supabase
        .from("expenses")
        .select("id, vendor, category, total, expense_date, status")
        .order("expense_date", { ascending: false })
        .limit(5),
    ),
    notDeleted(
      supabase
        .from("invoices")
        .select("id, full_number, total, issue_date, clients(name)")
        .neq("status", "draft")
        .order("issue_date", { ascending: false })
        .limit(5),
    ),
  ]);

  const series = buildMonthlySeries(
    (revenueRows ?? []).map((r) => ({
      date: r.issue_date as string,
      total: Number(r.total ?? 0),
    })),
    (expenseRows ?? []).map((r) => ({
      date: r.expense_date as string,
      total: Number(r.total ?? 0),
    })),
    today,
  );

  const revenueMonthTotal = (monthRevenue ?? []).reduce(
    (a, r) => a + Number(r.total ?? 0),
    0,
  );
  const expenseMonthTotal = (monthExpenses ?? []).reduce(
    (a, r) => a + Number(r.total ?? 0),
    0,
  );
  const netMonth = revenueMonthTotal - expenseMonthTotal;
  const margin = profitMargin(revenueMonthTotal, expenseMonthTotal);

  const byCategory = new Map<ExpenseCategory, number>();
  for (const row of monthExpenses ?? []) {
    const k = row.category as ExpenseCategory;
    byCategory.set(k, (byCategory.get(k) ?? 0) + Number(row.total ?? 0));
  }
  const topCategories = Array.from(byCategory.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return {
    series,
    revenueMonth: revenueMonthTotal,
    expenseMonth: expenseMonthTotal,
    netMonth,
    margin,
    topCategories,
    recentExpenses: (recentExpenses ?? []).map((e) => ({
      id: e.id,
      vendor: e.vendor,
      category: e.category as ExpenseCategory,
      total: Number(e.total ?? 0),
      expense_date: e.expense_date,
      status: e.status as any,
    })),
    recentInvoices: (recentInvoices ?? []).map((inv) => ({
      id: inv.id,
      full_number: inv.full_number,
      total: Number(inv.total ?? 0),
      issue_date: inv.issue_date,
      client_name: (inv.clients as any)?.name ?? null,
    })),
  };
}
