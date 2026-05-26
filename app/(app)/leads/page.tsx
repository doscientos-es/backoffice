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
import { Metadata } from "next";

export const metadata: Metadata = { title: "Leads · doscientos" };
export const dynamic = "force-dynamic";

const STATUS_VARIANT = {
  new: "info",
  qualifying: "warning",
  quoted: "warning",
  won: "success",
  lost: "danger",
  archived: "neutral",
} as const;

const STATUS_LABEL: Record<string, string> = {
  new: "Nuevo",
  qualifying: "Cualificando",
  quoted: "Presupuestado",
  won: "Ganado",
  lost: "Perdido",
  archived: "Archivado",
};

function Initials({ name }: { name: string }) {
  const parts = (name ?? "").trim().split(/\s+/);
  const letters = parts.length >= 2
    ? parts[0][0] + parts[1][0]
    : (parts[0]?.[0] ?? "?");
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold uppercase text-primary">
      {letters}
    </span>
  );
}

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
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
                    <th className="px-5 py-3 font-medium tracking-wide">Nombre</th>
                    <th className="px-5 py-3 font-medium tracking-wide">Empresa</th>
                    <th className="px-5 py-3 font-medium tracking-wide">Email</th>
                    <th className="px-5 py-3 font-medium tracking-wide">Estado</th>
                    <th className="px-5 py-3 font-medium tracking-wide">Creado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {leads.map((l) => (
                    <tr
                      key={l.id as string}
                      className="group transition-colors hover:bg-muted/30"
                    >
                      <td className="px-5 py-3">
                        <Link
                          href={`/leads/${l.id}`}
                          className="flex items-center gap-2.5"
                        >
                          <Initials name={l.name as string} />
                          <span className="font-medium group-hover:text-primary transition-colors truncate max-w-40">
                            {l.name as string}
                          </span>
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {(l.company as string | null) ?? (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {(l.email as string | null) ? (
                          <a
                            href={`mailto:${l.email}`}
                            className="hover:text-foreground transition-colors"
                          >
                            {l.email as string}
                          </a>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={STATUS_VARIANT[l.status as keyof typeof STATUS_VARIANT]}>
                          {STATUS_LABEL[l.status as string] ?? (l.status as string)}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground tabular-nums">
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
