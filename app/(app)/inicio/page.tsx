import { StatCard } from "@/components/layout/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { serverEnv } from "@/lib/env";
import { createServerClient } from "@/lib/supabase/server";
import { formatEUR } from "@/lib/utils";
import { AlertTriangle, FileSignature, Inbox, Wallet } from "lucide-react";
import {
  AvisosPanel,
  type OverdueInvoiceRow,
  type ReminderRow,
  type VerifactuPendingRow,
} from "./avisos-panel";
import { RevenueChart, type RevenuePoint } from "./revenue-chart";

export const metadata = { title: "Inicio · doscientos" };
export const dynamic = "force-dynamic";

const MONTHS_ES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

export default async function InicioPage() {
  const user = await requireUser();
  const supabase = await createServerClient();
  const env = serverEnv();

  const today = new Date();
  const in7Days = new Date(today.getTime() + 7 * 86400_000);
  const in30Days = new Date(today.getTime() + 30 * 86400_000);
  const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [
    { count: leadsNew },
    { count: proposalsOpen },
    { data: remindersData },
    { data: verifactuPendingData },
    { data: overdueData },
    { data: revenueData },
    { data: monthRevenueData },
  ] = await Promise.all([
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("status", "new")
      .is("deleted_at", null),
    supabase
      .from("proposals")
      .select("id", { count: "exact", head: true })
      .in("status", ["sent", "viewed"])
      .is("deleted_at", null),
    supabase
      .from("reminders")
      .select("id, title, remind_at")
      .is("completed_at", null)
      .lte("remind_at", in7Days.toISOString())
      .order("remind_at", { ascending: true })
      .limit(5),
    supabase
      .from("invoices")
      .select("id, full_number, verifactu_status, verifactu_error, clients(name)")
      .in("verifactu_status", ["pending", "error", "rejected"])
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("invoices")
      .select("id, full_number, due_date, total, clients(name)")
      .eq("status", "sent")
      .lt("due_date", today.toISOString().slice(0, 10))
      .is("deleted_at", null)
      .order("due_date", { ascending: true })
      .limit(5),
    supabase
      .from("invoices")
      .select("issue_date, total")
      .gte("issue_date", sixMonthsAgo.toISOString().slice(0, 10))
      .neq("status", "draft")
      .is("deleted_at", null),
    supabase
      .from("invoices")
      .select("total")
      .gte("issue_date", monthStart.toISOString().slice(0, 10))
      .neq("status", "draft")
      .is("deleted_at", null),
  ]);

  const reminders: ReminderRow[] = (remindersData ?? []).map((r) => ({
    id: r.id as string,
    title: r.title as string,
    remind_at: r.remind_at as string,
  }));

  const verifactuPending: VerifactuPendingRow[] = (verifactuPendingData ?? []).map((v) => ({
    id: v.id as string,
    full_number: (v.full_number as string | null) ?? null,
    verifactu_status: v.verifactu_status as "pending" | "error" | "rejected",
    verifactu_error: (v.verifactu_error as string | null) ?? null,
    client_name:
      ((v as unknown as { clients: { name: string } | null }).clients?.name as string | null) ??
      null,
  }));

  const overdueInvoices: OverdueInvoiceRow[] = (overdueData ?? []).map((inv) => ({
    id: inv.id as string,
    full_number: (inv.full_number as string | null) ?? null,
    due_date: (inv.due_date as string | null) ?? null,
    total: Number(inv.total ?? 0),
    client_name:
      ((inv as unknown as { clients: { name: string } | null }).clients?.name as string | null) ??
      null,
  }));

  const revenueByMonth = new Map<string, number>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    revenueByMonth.set(`${d.getFullYear()}-${d.getMonth()}`, 0);
  }
  for (const row of revenueData ?? []) {
    const d = new Date(row.issue_date as string);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (revenueByMonth.has(key)) {
      revenueByMonth.set(key, (revenueByMonth.get(key) ?? 0) + Number(row.total ?? 0));
    }
  }
  const revenueSeries: RevenuePoint[] = Array.from(revenueByMonth.entries()).map(([k, revenue]) => {
    const [, m] = k.split("-").map(Number);
    return { month: MONTHS_ES[m ?? 0] ?? "", revenue: Math.round(revenue * 100) / 100 };
  });

  const monthRevenue = (monthRevenueData ?? []).reduce((acc, r) => acc + Number(r.total ?? 0), 0);

  const certExpiresAt =
    env.VERIFACTU_CERT_EXPIRES_AT && new Date(env.VERIFACTU_CERT_EXPIRES_AT) <= in30Days
      ? env.VERIFACTU_CERT_EXPIRES_AT
      : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Hola, {user.name.split(" ")[0]} 👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Aquí tienes lo que requiere tu atención.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Leads nuevos" value={leadsNew ?? 0} tone="info" icon={Inbox} href="/leads" />
        <StatCard
          label="Propuestas abiertas"
          value={proposalsOpen ?? 0}
          tone="info"
          icon={FileSignature}
          href="/proposals"
        />
        <StatCard
          label="Facturas vencidas"
          value={overdueInvoices.length}
          tone={overdueInvoices.length > 0 ? "danger" : "default"}
          icon={AlertTriangle}
          href="/invoices"
        />
        <StatCard
          label="Ingresos este mes"
          value={formatEUR(monthRevenue)}
          tone="success"
          icon={Wallet}
          href="/finance"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <AvisosPanel
          reminders={reminders}
          verifactuPending={verifactuPending}
          overdueInvoices={overdueInvoices}
          certExpiresAt={certExpiresAt}
        />
        <Card>
          <CardHeader>
            <CardTitle>Ingresos · últimos 6 meses</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueChart data={revenueSeries} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


