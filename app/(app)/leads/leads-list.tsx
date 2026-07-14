"use client";

import { ListPage, type ListPageProps } from "@/components/layout/list-page";
import { MemberLabel } from "@/components/ui/member-avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import type { LeadListItem } from "@/lib/leads/types";
import { getLeadInitials, leadDisplayName } from "@/lib/leads/utils";
import type { MemberOption } from "@/lib/members/queries";
import { LEAD_STATUS } from "@/lib/status";
import { relativeTime } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { LeadFastActions } from "./lead-fast-actions";
import { LeadQuickView } from "./lead-quick-view";
import type { KanbanLead } from "./leads-kanban";

type LeadsListProps = Omit<ListPageProps, "rows"> & {
  leads: LeadListItem[];
  aiEnabled?: boolean;
  canEdit?: boolean;
  members?: MemberOption[];
};

function LeadInitials({ lead }: { lead: KanbanLead }) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold uppercase text-primary">
      {getLeadInitials(lead)}
    </span>
  );
}

export function LeadsList({
  leads,
  aiEnabled = false,
  canEdit = false,
  members = [],
  ...props
}: LeadsListProps) {
  const [selectedLead, setSelectedLead] = useState<KanbanLead | null>(null);

  const rows = leads.map((l) => ({
    id: l.id,
    data: l as KanbanLead,
    csvValues: [
      leadDisplayName(l),
      l.company ?? "",
      l.email ?? "",
      l.status,
      l.assignee?.name ?? "",
      l.created_at,
      l.company_size ?? "",
      l.solution_type ?? "",
      l.urgency ?? "",
      l.source ?? "",
      l.score?.toString() ?? "",
    ],
    cells: [
      <Link
        key="name"
        href={`/leads/${l.id}`}
        className="group/leadname inline-flex items-center gap-2.5"
        onClick={(e) => e.stopPropagation()}
      >
        <LeadInitials lead={l} />
        <span className="font-medium truncate max-w-40 underline-offset-2 group-hover/leadname:underline group-hover/leadname:text-primary transition-colors">
          {leadDisplayName(l)}
        </span>
        <ArrowRight className="size-3.5 shrink-0 opacity-0 -translate-x-1 transition-all group-hover/leadname:opacity-60 group-hover/leadname:translate-x-0" />
      </Link>,
      l.company,
      l.email ? (
        <a
          key="email"
          href={`mailto:${l.email}`}
          className="hover:text-foreground transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {l.email}
        </a>
      ) : null,
      <div key="status" className="flex flex-col gap-0.5">
        <StatusBadge meta={LEAD_STATUS} value={l.status} />
        {(l.status === "lost" || l.status === "not_interested") && l.lost_reason && (
          <span className="text-[11px] text-destructive/80 truncate max-w-36">{l.lost_reason}</span>
        )}
      </div>,
      <span key="score" className="tabular-nums text-muted-foreground">
        {l.score ?? "—"}
      </span>,
      <MemberLabel key="assignee" member={l.assignee} size="sm" />,
      <span key="created" className="tabular-nums">
        {relativeTime(l.created_at)}
      </span>,
      <div key="actions" className="flex justify-end" onClick={(e) => e.stopPropagation()}>
        <LeadFastActions lead={l} aiEnabled={aiEnabled} />
      </div>,
    ],
  }));

  return (
    <>
      <ListPage
        {...props}
        rows={rows}
        onRowClick={(row) => setSelectedLead(row.data as KanbanLead)}
      />
      <LeadQuickView
        lead={selectedLead}
        canEdit={canEdit}
        members={members}
        onCloseAction={() => setSelectedLead(null)}
      />
    </>
  );
}
