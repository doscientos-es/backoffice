import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createServerClient } from "@/lib/supabase/server";
import { relativeTime } from "@/lib/utils";
import Link from "next/link";

export const metadata = { title: "Leads · doscientos" };

const STATUS_VARIANT = {
  new: "info",
  qualifying: "warning",
  quoted: "warning",
  won: "success",
  lost: "danger",
  archived: "neutral",
} as const;

export default async function LeadsPage() {
  const supabase = await createServerClient();
  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, name, company, email, status, temperature, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Últimos 50</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {error ? (
            <p className="px-5 text-sm text-[color:var(--danger)]">{error.message}</p>
          ) : !leads || leads.length === 0 ? (
            <p className="px-5 text-sm text-[color:var(--text-muted)]">Aún no hay leads.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[color:var(--surface)] text-left text-xs uppercase tracking-wide text-[color:var(--text-muted)]">
                  <tr>
                    <th className="px-5 py-2 font-medium">Nombre</th>
                    <th className="px-5 py-2 font-medium">Empresa</th>
                    <th className="px-5 py-2 font-medium">Email</th>
                    <th className="px-5 py-2 font-medium">Estado</th>
                    <th className="px-5 py-2 font-medium text-right">Creado</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l) => (
                    <tr
                      key={l.id as string}
                      className="border-t border-[color:var(--border)] hover:bg-[color:var(--surface-hover)]"
                    >
                      <td className="px-5 py-2.5">
                        <Link href={`/leads/${l.id}`} className="font-medium hover:underline">
                          {l.name as string}
                        </Link>
                      </td>
                      <td className="px-5 py-2.5 text-[color:var(--text-secondary)]">
                        {(l.company as string | null) ?? "—"}
                      </td>
                      <td className="px-5 py-2.5 text-[color:var(--text-secondary)]">
                        {(l.email as string | null) ?? "—"}
                      </td>
                      <td className="px-5 py-2.5">
                        <Badge variant={STATUS_VARIANT[l.status as keyof typeof STATUS_VARIANT]}>
                          {l.status as string}
                        </Badge>
                      </td>
                      <td className="px-5 py-2.5 text-right text-xs text-[color:var(--text-muted)]">
                        {relativeTime(l.created_at as string)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
