"use client";

import { BellRing, ChevronRight, Inbox, ListTodo, Phone, UserRound } from "lucide-react";
import Link from "next/link";
import { claimLead } from "@/app/(app)/leads/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import type { ActionLeadRow, MyDayData, MyTaskRow, WeekStats } from "@/lib/dashboard/types";
import { useOptimisticRemoval } from "@/lib/hooks/use-optimistic-removal";
import { leadDisplayName } from "@/lib/leads/utils";
import { LEAD_STATUS, TASK_STATUS } from "@/lib/status";
import { relativeTime } from "@/lib/utils";
import { LeadCallLink } from "../leads/[id]/phone-actions";
import { ClaimLeadButton } from "./_components/claim-lead-button";

export type MyDayPanelProps = MyDayData;

function plural(n: number, singular: string, pluralForm: string): string {
  return n === 1 ? singular : pluralForm;
}

function WeekStatsStrip({ weekStats }: { weekStats: WeekStats }) {
  const { tasksCompleted, leadsAttended, streakDays } = weekStats;
  if (tasksCompleted === 0 && leadsAttended === 0 && streakDays === 0) return null;

  const items: { key: string; icon: string; label: string }[] = [];
  if (tasksCompleted > 0)
    items.push({
      key: "tasks",
      icon: "✅",
      label: `${tasksCompleted} ${plural(tasksCompleted, "tarea completada", "tareas completadas")}`,
    });
  if (leadsAttended > 0)
    items.push({
      key: "leads",
      icon: "📬",
      label: `${leadsAttended} ${plural(leadsAttended, "lead atendido", "leads atendidos")}`,
    });
  if (streakDays > 0)
    items.push({
      key: "streak",
      icon: "🔥",
      label: `${streakDays} ${plural(streakDays, "día seguido", "días seguidos")}`,
    });

  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-1 rounded-lg border border-border bg-muted/40 px-3 py-2">
      <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Esta semana
      </span>
      {items.map((item, i) => (
        <span key={item.key} className="flex items-center gap-1 text-sm text-foreground">
          {i > 0 && <span className="text-muted-foreground/40 select-none">·</span>}
          <span>{item.icon}</span>
          <span>{item.label}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * "Tu día": the personal action queue. Three columns the member works top to
 * bottom — open tasks, the leads they own, and unassigned leads to grab.
 */
export function MyDayPanel({ tasks, myLeads, unassignedLeads, weekStats }: MyDayPanelProps) {
  const { items: visibleUnassigned, remove: claimOptimistic } =
    useOptimisticRemoval(unassignedLeads);

  return (
    <div className="flex flex-col gap-3">
      <WeekStatsStrip weekStats={weekStats} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Column
          icon={<ListTodo className="size-4 text-blue-500" />}
          title="Qué hacer ahora"
          count={tasks.length}
          href="/tasks"
          empty="No tienes acciones pendientes. 🎉"
        >
          {tasks.map((t) => (
            <TaskItem key={t.id} task={t} />
          ))}
        </Column>

        <Column
          icon={<UserRound className="size-4 text-emerald-500" />}
          title="Tus leads"
          count={myLeads.length}
          href="/leads"
          empty="No tienes leads activos asignados."
        >
          {myLeads.map((l) => (
            <LeadItem key={l.id} lead={l} />
          ))}
        </Column>

        <Column
          icon={<Inbox className="size-4 text-amber-500" />}
          title="Leads sin asignar"
          count={visibleUnassigned.length}
          href="/leads"
          empty="Todos los leads tienen responsable."
        >
          {visibleUnassigned.map((l) => (
            <LeadItem
              key={l.id}
              lead={l}
              onClaimAction={(id) => claimOptimistic(id, () => claimLead({ leadId: id }))}
            />
          ))}
        </Column>
      </div>
    </div>
  );
}

function Column({
  icon,
  title,
  count,
  href,
  empty,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  href: string;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-sm">
          {icon} {title}
          {count > 0 ? <Badge variant="neutral">{count}</Badge> : null}
        </CardTitle>
        <Link
          href={href}
          className="inline-flex items-center text-xs text-muted-foreground hover:text-primary"
        >
          Ver todos <ChevronRight className="size-3" />
        </Link>
      </CardHeader>
      <CardContent className="flex-1">
        {count === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground text-balance">{empty}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border [&>li]:py-2.5 first:[&>li]:pt-0 last:[&>li]:pb-0">
            {children}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function TaskItem({ task }: { task: MyTaskRow }) {
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
      </Link>
      {task.action_at ? (
        <Badge variant={overdue ? "danger" : "info"}>{relativeTime(task.action_at)}</Badge>
      ) : (
        <StatusBadge meta={TASK_STATUS} value={task.status} />
      )}
    </li>
  );
}

function LeadItem({
  lead,
  onClaimAction,
}: {
  lead: ActionLeadRow;
  onClaimAction?: (id: string) => void;
}) {
  const displayName = leadDisplayName(lead);
  return (
    <li className="flex items-center justify-between gap-2">
      <Link href={`/leads/${lead.id}`} className="min-w-0 flex-1 hover:underline">
        <span className="block truncate text-sm">{displayName}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {lead.company ?? "Sin empresa"} · {relativeTime(lead.since)}
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
