import {
  BellRinging as BellRing,
  ListChecks as ListTodo,
  PhoneIcon as Phone,
} from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { LeadCallLink } from "@/app/(app)/leads/[id]/phone-actions";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import type { ActionLeadRow, MyTaskRow } from "@/lib/dashboard/types";
import { leadDisplayName } from "@/lib/leads/utils";
import { LEAD_STATUS, TASK_STATUS } from "@/lib/status";
import { relativeTime } from "@/lib/utils";
import { ClaimLeadButton } from "./claim-lead-button";

export function MyDayTaskItem({ task, showAssignee }: { task: MyTaskRow; showAssignee: boolean }) {
  const overdue = task.action_at ? new Date(task.action_at) < new Date() : false;

  return (
    <li className="flex items-center justify-between gap-2">
      <Link href={`/tasks/${task.id}`} className="min-w-0 flex-1 hover:underline">
        <span className="flex items-center gap-1.5 truncate text-sm">
          {task.kind === "reminder" ? (
            <BellRing className="size-3 shrink-0 text-blue-500" />
          ) : (
            <ListTodo className="size-3 shrink-0 text-muted-foreground" />
          )}
          {task.title}
        </span>
        {task.contextLabel ? (
          <span className="block truncate text-xs text-muted-foreground">{task.contextLabel}</span>
        ) : null}
        {showAssignee && task.assigneeName ? (
          <span className="block truncate text-xs text-muted-foreground">{task.assigneeName}</span>
        ) : null}
      </Link>
      {task.action_at ? (
        <Badge variant={overdue ? "danger" : "info"}>{relativeTime(task.action_at)}</Badge>
      ) : (
        <StatusBadge meta={TASK_STATUS} value={task.status} />
      )}
    </li>
  );
}

export function MyDayLeadItem({
  lead,
  showAssignee,
  onClaimAction,
}: {
  lead: ActionLeadRow;
  showAssignee: boolean;
  onClaimAction?: (id: string) => void;
}) {
  const displayName = leadDisplayName(lead);

  return (
    <li className="flex items-center justify-between gap-2">
      <Link href={`/leads/${lead.id}`} className="min-w-0 flex-1 hover:underline">
        <span className="block truncate text-sm">{displayName}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {lead.company ?? "Sin empresa"}
          {showAssignee && lead.assigneeName ? ` · ${lead.assigneeName}` : ""} ·{" "}
          {relativeTime(lead.since)}
        </span>
      </Link>
      <div className="flex shrink-0 items-center gap-1.5">
        <StatusBadge meta={LEAD_STATUS} value={lead.status} />
        {onClaimAction ? (
          <ClaimLeadButton leadId={lead.id} onClaimAction={onClaimAction} />
        ) : lead.phone ? (
          <LeadCallLink
            leadId={lead.id}
            phone={lead.phone}
            title={`Llamar a ${displayName}`}
            aria-label={`Llamar a ${displayName}`}
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Phone className="size-3.5" />
          </LeadCallLink>
        ) : null}
      </div>
    </li>
  );
}
