import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "@/components/ui/empty-state";
import { createServerClient } from "@/lib/supabase/server";
import { relativeTime } from "@/lib/utils";
import { Plus } from "lucide-react";
import Link from "next/link";
import { type KanbanLead, LeadsKanban } from "./leads-kanban";
import { LeadsViewToggle } from "./view-toggle";

export const metadata = { title: "Leads · doscientos" };
export const dynamic = "force-dynamic";

const STATUS_VARIANT = {
  new: "info",
  qualifying: "warning",
  quoted: "warning",
  won: "success",
  lost: "danger",
  archived: "neutral",
} as const;

export default async function LeadsPage({
  searchParams,
}: { searchParams: Promise<{ view?: string }> }) {
  const { view: viewParam } = await searchParams;
  const view: "board" | "list" = viewParam === "list" ? "list" : "board";

  const supabase = await createServerClient();
  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, name, company, email, status, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(500);

  const actions = (
    <div className="flex items-center gap-2">
      <LeadsViewToggle view={view} />
      <Button asChild size="sm">
        <Link href="/leads/new">
          <Plus className="h-4 w-4" />
          Nuevo lead
        </Link>
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Leads"
        description="Oportunidades comerciales sin contrato firmado."
        actions={actions}
      />

      {error ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-destructive">{error.message}</p>
          </CardContent>
        </Card>
      ) : !leads || leads.length === 0 ? (
        <Card>
          <CardContent className="px-0 pt-0">
            <Empty className="border-0 py-10">
              <EmptyHeader>
                <EmptyTitle>Aún no hay leads.</EmptyTitle>
              </EmptyHeader>
              <EmptyContent>
                <Button asChild size="sm">
                  <Link href="/leads/new">
                    <Plus className="h-4 w-4" />
                    Nuevo lead
                  </Link>
                </Button>
              </EmptyContent>
            </Empty>
          </CardContent>
        </Card>
      ) : view === "board" ? (
        <LeadsKanban leads={leads as KanbanLead[]} />
      ) : (
        <Card>
          <CardContent className="px-0 pt-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-2 font-medium">Nombre</th>
                    <th className="px-5 py-2 font-medium">Empresa</th>
                    <th className="px-5 py-2 font-medium">Email</th>
                    <th className="px-5 py-2 font-medium">Estado</th>
                    <th className="px-5 py-2 font-medium">Creado</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l) => (
                    <tr
                      key={l.id as string}
                      className="border-t border-border hover:bg-muted/40"
                    >
                      <td className="px-5 py-2.5 font-medium">
                        <Link href={`/leads/${l.id}`} className="hover:underline">
                          {l.name as string}
                        </Link>
                      </td>
                      <td className="px-5 py-2.5 text-muted-foreground">
                        {(l.company as string | null) ?? "—"}
                      </td>
                      <td className="px-5 py-2.5 text-muted-foreground">
                        {(l.email as string | null) ?? "—"}
                      </td>
                      <td className="px-5 py-2.5">
                        <Badge variant={STATUS_VARIANT[l.status as keyof typeof STATUS_VARIANT]}>
                          {l.status as string}
                        </Badge>
                      </td>
                      <td className="px-5 py-2.5 text-muted-foreground">
                        {relativeTime(l.created_at as string)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
