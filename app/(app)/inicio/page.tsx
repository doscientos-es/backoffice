import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import { formatEUR, relativeTime } from "@/lib/utils";

export const metadata = { title: "Inicio · doscientos" };

export default async function InicioPage() {
  const user = await requireUser();
  const supabase = await createServerClient();

  const [
    { count: leadsNew },
    { count: tasksOpen },
    { data: reminders },
    { count: invoicesOverdue },
  ] = await Promise.all([
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("status", "new")
      .is("deleted_at", null),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .neq("status", "done")
      .is("deleted_at", null),
    supabase
      .from("reminders")
      .select("id, title, remind_at")
      .is("completed_at", null)
      .lte("remind_at", new Date(Date.now() + 7 * 86400_000).toISOString())
      .order("remind_at", { ascending: true })
      .limit(5),
    supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("status", "overdue")
      .is("deleted_at", null),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Hola, {user.name.split(" ")[0]} 👋
        </h1>
        <p className="mt-1 text-sm text-[color:var(--text-muted)]">
          Aquí tienes lo que requiere tu atención.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Leads nuevos" value={leadsNew ?? 0} />
        <Stat label="Tareas abiertas" value={tasksOpen ?? 0} />
        <Stat label="Facturas vencidas" value={invoicesOverdue ?? 0} tone="danger" />
        <Stat label="Avisos próximos" value={reminders?.length ?? 0} tone="info" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Panel de avisos</CardTitle>
        </CardHeader>
        <CardContent>
          {!reminders || reminders.length === 0 ? (
            <p className="text-sm text-[color:var(--text-muted)]">
              No hay avisos en los próximos 7 días.
            </p>
          ) : (
            <ul className="divide-y divide-[color:var(--border)]">
              {reminders.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2.5">
                  <span className="text-sm">{r.title}</span>
                  <Badge variant="info">{relativeTime(r.remind_at as string)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: { label: string; value: number | string; tone?: "danger" | "info" }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="text-xs text-[color:var(--text-muted)]">{label}</div>
        <div
          className={
            tone === "danger"
              ? "text-2xl font-semibold tracking-tight text-[color:var(--danger)]"
              : tone === "info"
                ? "text-2xl font-semibold tracking-tight text-[color:var(--info)]"
                : "text-2xl font-semibold tracking-tight text-[color:var(--text-primary)]"
          }
          data-tabular
        >
          {typeof value === "number" ? formatNumber(value) : value}
        </div>
      </CardContent>
    </Card>
  );
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("es-ES").format(n);
}

// Suppress unused warning: formatEUR will be used in invoice pages
void formatEUR;
