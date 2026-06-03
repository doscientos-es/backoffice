import { ListPage } from "@/components/layout/list-page";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from "@/components/ui/empty-state";
import { MemberLabel } from "@/components/ui/member-avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { isAIEnabled } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { listLeads } from "@/lib/leads/queries";
import { LEAD_LIST_PAGE_SIZE } from "@/lib/leads/types";
import { LEAD_STATUS, type LeadStatus } from "@/lib/status";
import { relativeTime } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LeadCreateDialog } from "./lead-create-dialog";
import { LeadFastActions } from "./lead-fast-actions";
import { LEAD_SOURCES } from "./lead-form-fields";
import { LeadsKanban } from "./leads-kanban";
import { LeadsViewToggle } from "./view-toggle";

export const metadata: Metadata = { title: "Leads · doscientos" };
export const dynamic = "force-dynamic";

const STATUS_FILTER_OPTIONS = (Object.keys(LEAD_STATUS) as LeadStatus[]).map((value) => ({
  value,
  label: LEAD_STATUS[value].label,
}));

const SOURCE_FILTER_OPTIONS = LEAD_SOURCES.map((s) => ({ value: s, label: s }));

function Initials({ name }: { name: string }) {
  const parts = (name ?? "").trim().split(/\s+/);
  const letters =
    parts.length >= 2 ? (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "") : (parts[0]?.[0] ?? "?");
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
  const status = (LEAD_STATUS as Record<string, unknown>)[sp.status ?? ""]
    ? (sp.status as LeadStatus)
    : null;
  const source = (LEAD_SOURCES as readonly string[]).includes(sp.source ?? "")
    ? (sp.source as string)
    : null;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const user = await requireUser();
  const aiEnabled = isAIEnabled();
  const canEdit = user.role !== "viewer";

  const {
    leads: enrichedLeads,
    count,
    error,
  } = await listLeads({
    view,
    q,
    status,
    source,
    page,
  });

  const actions = (
    <div className="flex items-center gap-2">
      <LeadsViewToggle view={view} />
      <LeadCreateDialog />
    </div>
  );

  if (view === "list") {
    const hasFilters = q.length > 0 || !!status || !!source;
    return (
      <ListPage
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
        ]}
        pagination={{ page, pageSize: LEAD_LIST_PAGE_SIZE, total: count }}
        headers={["Nombre", "Empresa", "Email", "Estado", "Responsable", "Creado", "Acciones"]}
        align={["left", "left", "left", "left", "left", "left", "right"]}
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
            <MemberLabel key="assignee" member={l.assignee} size="sm" />,
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
        <LeadsKanban leads={enrichedLeads} canEdit={canEdit} />
      )}
    </div>
  );
}
