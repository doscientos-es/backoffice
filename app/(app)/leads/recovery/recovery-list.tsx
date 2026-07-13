"use client";

import { ListPage, type ListPageProps } from "@/components/layout/list-page";
import { MemberLabel } from "@/components/ui/member-avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import type { RecoveryLead } from "@/lib/recovery/types";
import { RECOVERY_STATE } from "@/lib/status";
import { formatEUR, relativeTime } from "@/lib/utils";
import { ArrowRight, Eye, MousePointerClick, Send } from "lucide-react";
import Link from "next/link";
import { RecoveryActions } from "./recovery-actions";

type RecoveryListProps = Omit<ListPageProps, "rows"> & {
  leads: RecoveryLead[];
  aiEnabled?: boolean;
};

function LeadInitials({ name }: { name: string }) {
  const parts = (name ?? "").trim().split(/\s+/);
  const letters =
    parts.length >= 2 ? (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "") : (parts[0]?.[0] ?? "?");
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold uppercase text-primary">
      {letters}
    </span>
  );
}

function EngagementCell({ lead }: { lead: RecoveryLead }) {
  const lastSignal = lead.lastClickedAt ?? lead.lastOpenedAt ?? lead.lastContactedAt;

  return (
    <div className="flex min-w-36 flex-col gap-1">
      <div className="flex items-center gap-2 text-xs tabular-nums">
        <span
          className="inline-flex items-center gap-1 text-foreground"
          title="Clics en enlaces trackeados"
        >
          <MousePointerClick className="size-3.5 text-primary" />
          {lead.clickCount}
        </span>
        <span
          className="inline-flex items-center gap-1 text-muted-foreground"
          title="Aperturas detectadas (aproximado)"
        >
          <Eye className="size-3.5" />
          {lead.openCount}
        </span>
        <span
          className="inline-flex items-center gap-1 text-muted-foreground"
          title="Emails, llamadas o reuniones de repesca"
        >
          <Send className="size-3.5" />
          {lead.outreachCount}
        </span>
      </div>
      <span className="text-[11px] text-muted-foreground">
        {lastSignal ? `Última señal ${relativeTime(lastSignal)}` : "Sin actividad"}
      </span>
    </div>
  );
}

export function RecoveryList({ leads, aiEnabled = false, ...props }: RecoveryListProps) {
  const rows = leads.map((l) => ({
    id: l.id,
    csvValues: [
      l.name,
      l.company ?? "",
      l.lost_reason ?? "",
      RECOVERY_STATE[l.recoveryState].label,
      `clics:${l.clickCount} aperturas:${l.openCount} contactos:${l.outreachCount}`,
      l.assignee?.name ?? "",
      l.lost_at ?? "",
      l.estimated_value?.toString() ?? "",
      "",
    ],
    cells: [
      <Link
        key="name"
        href={`/leads/${l.id}`}
        className="group/leadname inline-flex items-center gap-2.5"
      >
        <LeadInitials name={l.name} />
        <span className="font-medium truncate max-w-40 underline-offset-2 group-hover/leadname:underline group-hover/leadname:text-primary transition-colors">
          {l.name}
        </span>
        <ArrowRight className="size-3.5 shrink-0 opacity-0 -translate-x-1 transition-all group-hover/leadname:opacity-60 group-hover/leadname:translate-x-0" />
      </Link>,
      l.company ?? "—",
      <span key="reason" className="text-muted-foreground">
        {l.lost_reason ?? "—"}
      </span>,
      <StatusBadge key="state" meta={RECOVERY_STATE} value={l.recoveryState} />,
      <EngagementCell key="engagement" lead={l} />,
      <MemberLabel key="assignee" member={l.assignee} size="sm" />,
      <span key="lost" className="tabular-nums text-muted-foreground">
        {relativeTime(l.lost_at)}
      </span>,
      <span key="value" className="tabular-nums">
        {formatEUR(l.estimated_value)}
      </span>,
      <RecoveryActions key="actions" lead={l} aiEnabled={aiEnabled} />,
    ],
  }));

  return <ListPage {...props} rows={rows} />;
}
