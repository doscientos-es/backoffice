import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "@/components/ui/empty-state";
import { isAIEnabled } from "@/lib/ai";
import { createServerClient } from "@/lib/supabase/server";
import { relativeTime } from "@/lib/utils";
import { Plus } from "lucide-react";
import Link from "next/link";
import { type FastInteraction, LeadFastActions } from "./lead-fast-actions";
import { type KanbanLead, LeadsKanban } from "./leads-kanban";
import { LeadsViewToggle } from "./view-toggle";
import { Metadata } from "next";

const RECENT_INTERACTIONS_PER_LEAD = 3;

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
    ? (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")
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
  const aiEnabled = isAIEnabled();
  const { data: leads, error } = await supabase
    .from("leads")
    .select(
      "id, name, company, email, phone, status, created_at, updated_at, estimated_value, ai_summary, ai_updated_at",
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(500);

  // Última actividad por lead para alimentar el hover-card de memoria.
  // Hacemos una sola consulta y agrupamos en memoria para evitar N+1.
  const leadIds = (leads ?? []).map((l) => l.id as string);
  const interactionsByLead = new Map<string, FastInteraction[]>();
  if (leadIds.length > 0) {
    const { data: interactions } = await supabase
      .from("lead_interactions")
      .select("id, lead_id, type, subject, body, created_at")
      .in("lead_id", leadIds)
      .order("created_at", { ascending: false })
      .limit(leadIds.length * RECENT_INTERACTIONS_PER_LEAD);
    for (const i of interactions ?? []) {
      const leadId = i.lead_id as string;
      const list = interactionsByLead.get(leadId) ?? [];
      if (list.length < RECENT_INTERACTIONS_PER_LEAD) {
        list.push({
          id: i.id as string,
          type: i.type as string,
          subject: (i.subject as string | null) ?? null,
          body: (i.body as string | null) ?? null,
          created_at: i.created_at as string,
        });
        interactionsByLead.set(leadId, list);
      }
    }
  }

  const enrichedLeads: KanbanLead[] = (leads ?? []).map((l) => ({
    id: l.id as string,
    name: l.name as string,
    company: (l.company as string | null) ?? null,
    email: (l.email as string | null) ?? null,
    phone: (l.phone as string | null) ?? null,
    status: l.status as KanbanLead["status"],
    created_at: l.created_at as string,
    updated_at: (l.updated_at as string | null) ?? (l.created_at as string),
    estimated_value: l.estimated_value == null ? null : Number(l.estimated_value),
    ai_summary: (l.ai_summary as string | null) ?? null,
    ai_updated_at: (l.ai_updated_at as string | null) ?? null,
    recent_interactions: interactionsByLead.get(l.id as string) ?? [],
  }));

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
        <LeadsKanban leads={enrichedLeads} aiEnabled={aiEnabled} />
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
                    <th className="px-5 py-3 font-medium tracking-wide text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {enrichedLeads.map((l) => (
                    <tr
                      key={l.id}
                      className="group transition-colors hover:bg-muted/30"
                    >
                      <td className="px-5 py-3">
                        <Link
                          href={`/leads/${l.id}`}
                          className="flex items-center gap-2.5"
                        >
                          <Initials name={l.name} />
                          <span className="font-medium group-hover:text-primary transition-colors truncate max-w-40">
                            {l.name}
                          </span>
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {l.company ?? <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {l.email ? (
                          <a
                            href={`mailto:${l.email}`}
                            className="hover:text-foreground transition-colors"
                          >
                            {l.email}
                          </a>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={STATUS_VARIANT[l.status as keyof typeof STATUS_VARIANT]}>
                          {STATUS_LABEL[l.status] ?? l.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground tabular-nums">
                        {relativeTime(l.created_at)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end">
                          <LeadFastActions lead={l} aiEnabled={aiEnabled} />
                        </div>
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
