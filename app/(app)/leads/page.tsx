import { ListPage } from "@/components/layout/list-page";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { isAIEnabled } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { LEAD_STATUS, type LeadStatus } from "@/lib/status";
import { createServerClient } from "@/lib/supabase/server";
import { relativeTime } from "@/lib/utils";
import { ArrowRight, Plus } from "lucide-react";
import Link from "next/link";
import { type FastInteraction, LeadFastActions } from "./lead-fast-actions";
import { LEAD_SOURCES } from "./lead-form-fields";
import { type KanbanLead, LeadsKanban } from "./leads-kanban";
import { LeadsViewToggle } from "./view-toggle";
import { Metadata } from "next";

const RECENT_INTERACTIONS_PER_LEAD = 3;
const LIST_PAGE_SIZE = 25;
const BOARD_LIMIT = 500;

export const metadata: Metadata = { title: "Leads · doscientos" };
export const dynamic = "force-dynamic";

const STATUS_FILTER_OPTIONS = (Object.keys(LEAD_STATUS) as LeadStatus[]).map((value) => ({
  value,
  label: LEAD_STATUS[value].label,
}));

const SOURCE_FILTER_OPTIONS = LEAD_SOURCES.map((s) => ({ value: s, label: s }));

function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, (m) => `\\${m}`);
}

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
}: {
  searchParams: Promise<{
    view?: string;
    q?: string;
    status?: string;
    source?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const view: "board" | "list" = sp.view === "list" ? "list" : "board";
  const q = (sp.q ?? "").trim();
  const status = (LEAD_STATUS as Record<string, unknown>)[sp.status ?? ""] ? (sp.status as LeadStatus) : null;
  const source = (LEAD_SOURCES as readonly string[]).includes(sp.source ?? "") ? (sp.source as string) : null;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const user = await requireUser();
  const supabase = await createServerClient();
  const aiEnabled = isAIEnabled();
  const canEdit = user.role !== "viewer";

  let leadsQuery = supabase
    .from("leads")
    .select(
      "id, name, company, email, phone, source, notes, status, created_at, updated_at, estimated_value, ai_summary, ai_updated_at",
      { count: "exact" },
    )
    .is("deleted_at", null);

  if (view === "list") {
    if (q.length > 0) {
      const pattern = `%${escapeIlike(q)}%`;
      leadsQuery = leadsQuery.or(
        `name.ilike.${pattern},company.ilike.${pattern},email.ilike.${pattern}`,
      );
    }
    if (status) leadsQuery = leadsQuery.eq("status", status);
    if (source) leadsQuery = leadsQuery.eq("source", source);
  }

  const from = (page - 1) * LIST_PAGE_SIZE;
  const to = from + LIST_PAGE_SIZE - 1;

  const { data: leads, error, count } = await (view === "list"
    ? leadsQuery.order("created_at", { ascending: false }).range(from, to)
    : leadsQuery.order("created_at", { ascending: false }).limit(BOARD_LIMIT));

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
    source: (l.source as string | null) ?? null,
    notes: (l.notes as string | null) ?? null,
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

  if (view === "list") {
    const hasFilters = q.length > 0 || !!status || !!source;
    return (
      <ListPage
        title="Leads"
        description="Oportunidades comerciales sin contrato firmado."
        actions={actions}
        error={error?.message}
        empty={hasFilters ? "Sin coincidencias." : "Aún no hay leads."}
        emptyAction={
          <Button asChild size="sm">
            <Link href="/leads/new">
              <Plus className="h-4 w-4" />
              Nuevo lead
            </Link>
          </Button>
        }
        searchKey="q"
        searchPlaceholder="Buscar por nombre, empresa o email…"
        filters={[
          { key: "status", label: "Estado", options: STATUS_FILTER_OPTIONS },
          { key: "source", label: "Origen", options: SOURCE_FILTER_OPTIONS },
        ]}
        pagination={{ page, pageSize: LIST_PAGE_SIZE, total: count ?? 0 }}
        headers={["Nombre", "Empresa", "Email", "Estado", "Creado", "Acciones"]}
        align={["left", "left", "left", "left", "left", "right"]}
        addHref="/leads/new"
        addLabel="Añadir lead"
        rows={enrichedLeads.map((l) => ({
          id: l.id,
          cells: [
            <Link
              key="name"
              href={`/leads/${l.id}`}
              className="group/leadname inline-flex items-center gap-2.5"
            >
              <Initials name={l.name} />
              <span className="font-medium truncate max-w-40 underline-offset-2 group-hover/leadname:underline group-hover/leadname:text-primary transition-colors">
                {l.name}
              </span>
              <ArrowRight className="size-3.5 shrink-0 opacity-0 -translate-x-1 transition-all group-hover/leadname:opacity-60 group-hover/leadname:translate-x-0" />
            </Link>,
            l.company,
            l.email ? (
              <a
                key="email"
                href={`mailto:${l.email}`}
                className="hover:text-foreground transition-colors"
              >
                {l.email}
              </a>
            ) : null,
            <StatusBadge key="status" meta={LEAD_STATUS} value={l.status} />,
            <span key="created" className="tabular-nums">
              {relativeTime(l.created_at)}
            </span>,
            <div key="actions" className="flex justify-end">
              <LeadFastActions lead={l} aiEnabled={aiEnabled} />
            </div>,
          ],
        }))}
      />
    );
  }

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
      ) : (
        <LeadsKanban leads={enrichedLeads} canEdit={canEdit} />
      )}
    </div>
  );
}
