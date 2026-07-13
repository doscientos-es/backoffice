import { ListControls } from "@/components/layout/list-controls";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "@/components/ui/empty-state";
import { isAIEnabled } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { listLeads } from "@/lib/leads/queries";
import { LEAD_BOARD_LIMIT, LEAD_LIST_PAGE_SIZE, LEAD_SORT_COLUMNS } from "@/lib/leads/types";
import { listActiveMembers } from "@/lib/members/queries";
import { LEAD_STATUS, type LeadStatus } from "@/lib/status";
import { parseSortParam } from "@/lib/utils/search-params";
import { TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { LeadCreateDialog } from "./lead-create-dialog";
import { LEAD_SOURCES } from "./lead-form-fields";
import { LeadsKanban } from "./leads-kanban";
import { LeadsList } from "./leads-list";
import { LeadsViewToggle } from "./view-toggle";

export const metadata: Metadata = { title: "Leads · doscientos" };
export const dynamic = "force-dynamic";

const STATUS_FILTER_OPTIONS = (Object.keys(LEAD_STATUS) as LeadStatus[]).map((value) => ({
  value,
  label: LEAD_STATUS[value].label,
}));

const SOURCE_FILTER_OPTIONS = LEAD_SOURCES.map((s) => ({ value: s, label: s }));

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    q?: string;
    status?: string;
    source?: string;
    assignee?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const view: "board" | "list" = sp.view === "list" ? "list" : "board";
  const q = (sp.q ?? "").trim();
  const status = (LEAD_STATUS as Record<string, unknown>)[sp.status ?? ""]
    ? (sp.status as LeadStatus)
    : null;
  const source = (LEAD_SOURCES as readonly string[]).includes(sp.source ?? "")
    ? (sp.source as string)
    : null;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const { sort, dir } = parseSortParam(sp, LEAD_SORT_COLUMNS, "created_at", "desc");

  const user = await requireUser();
  const aiEnabled = isAIEnabled();
  const canEdit = user.role !== "viewer";

  const members = await listActiveMembers();
  const memberIds = new Set(members.map((m) => m.id));
  const assignee = memberIds.has(sp.assignee ?? "") ? (sp.assignee as string) : null;

  const {
    leads: enrichedLeads,
    count,
    error,
  } = await listLeads({
    view,
    q,
    status,
    source,
    assignee,
    page,
    sort,
    dir,
  });

  const ASSIGNEE_FILTER_OPTIONS = members.map((m) => ({ value: m.id, label: m.name }));

  const boardCapped = view === "board" && enrichedLeads.length >= LEAD_BOARD_LIMIT;

  const actions = (
    <div className="flex items-center gap-2">
      <LeadsViewToggle view={view} />
      <LeadCreateDialog />
    </div>
  );

  if (view === "list") {
    const hasFilters = q.length > 0 || !!status || !!source || !!assignee;
    return (
      <LeadsList
        leads={enrichedLeads}
        aiEnabled={aiEnabled}
        canEdit={canEdit}
        members={members}
        title="Leads"
        description="Oportunidades comerciales sin contrato firmado."
        actions={actions}
        error={error ?? undefined}
        empty={hasFilters ? "Sin coincidencias." : "Aún no hay leads."}
        emptyAction={<LeadCreateDialog />}
        searchKey="q"
        searchPlaceholder="Buscar por nombre, empresa o email…"
        filters={[
          { key: "status", label: "Estado", options: STATUS_FILTER_OPTIONS },
          { key: "source", label: "Origen", options: SOURCE_FILTER_OPTIONS },
          { key: "assignee", label: "Responsable", options: ASSIGNEE_FILTER_OPTIONS },
        ]}
        pagination={{ page, pageSize: LEAD_LIST_PAGE_SIZE, total: count }}
        headers={[
          { label: "Nombre", sortKey: "name" },
          { label: "Empresa", sortKey: "company" },
          "Email",
          { label: "Estado", sortKey: "status" },
          { label: "Score", sortKey: "score" },
          "Responsable",
          { label: "Creado", sortKey: "created_at" },
          "Acciones",
        ]}
        align={["left", "left", "left", "left", "right", "left", "left", "right"]}
        exportFilename="leads"
        addHref="/leads/new"
        addLabel="Añadir lead"
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

      <ListControls
        searchKey="q"
        searchPlaceholder="Buscar por nombre, empresa, email o teléfono…"
        filters={[
          { key: "source", label: "Origen", options: SOURCE_FILTER_OPTIONS },
          { key: "assignee", label: "Responsable", options: ASSIGNEE_FILTER_OPTIONS },
        ]}
        className="rounded-xl border border-border bg-card px-4"
      />

      {error ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      ) : enrichedLeads.length === 0 ? (
        <Card>
          <CardContent className="px-0 pt-0">
            <Empty className="border-0 py-10">
              <EmptyHeader>
                <EmptyTitle>Aún no hay leads.</EmptyTitle>
              </EmptyHeader>
              <EmptyContent>
                <LeadCreateDialog />
              </EmptyContent>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <>
          {boardCapped ? (
            <div className="flex items-center gap-2 rounded-lg border border-amber-300/40 bg-amber-50/60 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300">
              <TriangleAlert className="size-4 shrink-0" />
              <span>
                Se muestran los primeros <strong>{LEAD_BOARD_LIMIT}</strong> leads. Usa los filtros
                para acotar los resultados.
              </span>
            </div>
          ) : null}
          <LeadsKanban leads={enrichedLeads} canEdit={canEdit} members={members} />
        </>
      )}
    </div>
  );
}
