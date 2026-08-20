"use client";

import type { IconProps } from "@phosphor-icons/react";
import { BellRinging as BellRing, CheckCircle as CheckCircle2, CaretRight as ChevronRight, FlameIcon as Flame, Tray as Inbox, ListChecks as ListTodo, Confetti as PartyPopper, PhoneIcon as Phone, UserCircle as UserRound } from "@phosphor-icons/react";
import Link from "next/link";
import type { ComponentType } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { claimLead } from "@/app/(app)/leads/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import type { ActionLeadRow, MyDayData, MyTaskRow, WeekStats } from "@/lib/dashboard/types";
import { useOptimisticRemoval } from "@/lib/hooks/use-optimistic-removal";
import { leadDisplayName } from "@/lib/leads/utils";
import { LEAD_STATUS, TASK_STATUS } from "@/lib/status";
import { relativeTime } from "@/lib/utils";
import { LeadCallLink } from "../leads/[id]/phone-actions";
import { ClaimLeadButton } from "./_components/claim-lead-button";

type MyDayScopeProps = {
  canViewTeam: boolean;
  value: string;
  label: string;
  members: Array<{ id: string; name: string }>;
};

export type MyDayPanelProps = MyDayData & { scope: MyDayScopeProps };

function plural(n: number, singular: string, pluralForm: string): string {
  return n === 1 ? singular : pluralForm;
}

function WeekStatsStrip({ weekStats }: { weekStats: WeekStats }) {
  const { tasksCompleted, leadsAttended, streakDays } = weekStats;
  if (tasksCompleted === 0 && leadsAttended === 0 && streakDays === 0) return null;

  const items: { key: string; icon: ComponentType<IconProps>; tone: string; label: string }[] = [];
  if (tasksCompleted > 0)
    items.push({
      key: "tasks",
      icon: CheckCircle2,
      tone: "text-emerald-500",
      label: `${tasksCompleted} ${plural(tasksCompleted, "tarea completada", "tareas completadas")}`,
    });
  if (leadsAttended > 0)
    items.push({
      key: "leads",
      icon: Inbox,
      tone: "text-blue-500",
      label: `${leadsAttended} ${plural(leadsAttended, "lead atendido", "leads atendidos")}`,
    });
  if (streakDays > 0)
    items.push({
      key: "streak",
      icon: Flame,
      tone: "text-amber-500",
      label: `${streakDays} ${plural(streakDays, "día seguido", "días seguidos")}`,
    });

  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-1 rounded-lg border border-border bg-muted/40 px-3 py-2">
      <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Esta semana
      </span>
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <span key={item.key} className="flex items-center gap-1 text-sm text-foreground">
            {i > 0 && <span className="text-muted-foreground/40 select-none">·</span>}
            <Icon aria-hidden="true" className={`size-3.5 ${item.tone}`} />
            <span>{item.label}</span>
          </span>
        );
      })}
    </div>
  );
}

/**
 * "Tu día": a personal action queue, with an admin/owner scope selector.
 */
export function MyDayPanel({ tasks, myLeads, unassignedLeads, weekStats, scope }: MyDayPanelProps) {
  const { items: visibleUnassigned, remove: claimOptimistic } =
    useOptimisticRemoval(unassignedLeads);
  const isTeamScope = scope.value === "team";
  const leadsTitle = isTeamScope
    ? "Leads del equipo"
    : scope.value
      ? `Leads de ${scope.label}`
      : "Tus leads";
  const leadsEmpty = isTeamScope
    ? "El equipo no tiene leads activos asignados."
    : scope.value
      ? `${scope.label} no tiene leads activos asignados.`
      : "No tienes leads activos asignados.";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <WeekStatsStrip weekStats={weekStats} />
        {scope.canViewTeam ? <MyDayScopeSelector scope={scope} /> : null}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Column
          icon={<ListTodo className="size-4 text-blue-500" />}
          title="Qué hacer ahora"
          count={tasks.length}
          href="/tasks"
          empty={
            <>
              No tienes acciones pendientes.{" "}
              <PartyPopper aria-hidden="true" className="inline size-4" />
            </>
          }
        >
          {tasks.map((t) => (
            <TaskItem key={t.id} task={t} showAssignee={isTeamScope} />
          ))}
        </Column>

        <Column
          icon={<UserRound className="size-4 text-emerald-500" />}
          title={leadsTitle}
          count={myLeads.length}
          href="/leads"
          empty={leadsEmpty}
        >
          {myLeads.map((l) => (
            <LeadItem key={l.id} lead={l} showAssignee={isTeamScope} />
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
              showAssignee={false}
              onClaimAction={(id) => claimOptimistic(id, () => claimLead({ leadId: id }))}
            />
          ))}
        </Column>
      </div>
    </div>
  );
}

function MyDayScopeSelector({ scope }: { scope: MyDayScopeProps }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateScope(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("member", value);
    else params.delete("member");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <Select
      value={scope.value}
      onChange={(event) => updateScope(event.target.value)}
      aria-label="Mostrar acciones de"
      className="h-8 min-w-40 text-xs"
    >
      <option value="">Mis tareas</option>
      <option value="team">Equipo completo</option>
      {scope.members.map((member) => (
        <option key={member.id} value={member.id}>
          {member.name}
        </option>
      ))}
    </Select>
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
  empty: React.ReactNode;
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

function TaskItem({ task, showAssignee }: { task: MyTaskRow; showAssignee: boolean }) {
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

function LeadItem({
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
