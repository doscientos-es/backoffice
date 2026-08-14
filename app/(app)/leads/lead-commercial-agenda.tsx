import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { groupLeadsForAgenda, type LeadAgendaBucket } from "@/lib/leads/kanban-policy";
import type { LeadListItem } from "@/lib/leads/types";
import { leadDisplayName } from "@/lib/leads/utils";
import { REMINDER_ACTION_TYPE_LABEL } from "@/lib/reminders/action-types";
import { cn, relativeTime } from "@/lib/utils";
import { CalendarClock, CalendarPlus, CircleAlert, Clock3 } from "lucide-react";
import Link from "next/link";

const COLUMNS: Array<{
  id: LeadAgendaBucket;
  label: string;
  empty: string;
  icon: typeof CircleAlert;
  tone: string;
}> = [
  { id: "overdue", label: "Vencidas", empty: "Nada vencido", icon: CircleAlert, tone: "text-red-600 dark:text-red-400" },
  { id: "today", label: "Hoy", empty: "Nada para hoy", icon: Clock3, tone: "text-amber-700 dark:text-amber-400" },
  { id: "upcoming", label: "Próximas", empty: "Nada programado", icon: CalendarClock, tone: "text-sky-700 dark:text-sky-400" },
  { id: "missing", label: "Sin siguiente paso", empty: "Todo cubierto", icon: CalendarPlus, tone: "text-muted-foreground" },
];

export function LeadCommercialAgenda({ leads }: { leads: LeadListItem[] }) {
  const grouped = groupLeadsForAgenda(leads);
  return (
    <section aria-labelledby="lead-commercial-agenda-title" className="space-y-3">
      <div>
        <h2 id="lead-commercial-agenda-title" className="text-sm font-semibold">Agenda comercial</h2>
        <p className="text-xs text-muted-foreground">Prioriza la siguiente acción sin alterar la fase comercial.</p>
      </div>
      <div className="grid gap-3 xl:grid-cols-4 md:grid-cols-2">
        {COLUMNS.map((column) => {
          const items = grouped.get(column.id) ?? [];
          const Icon = column.icon;
          return (
            <Card key={column.id} className="min-w-0">
              <CardContent className="space-y-2 p-3">
                <div className={cn("flex items-center justify-between gap-2 text-xs font-semibold", column.tone)}>
                  <span className="inline-flex items-center gap-1.5"><Icon className="size-3.5" />{column.label}</span>
                  <Badge variant="neutral" className="h-5 px-1.5 tabular-nums">{items.length}</Badge>
                </div>
                {items.length ? items.slice(0, 5).map((lead) => <AgendaLead key={lead.id} lead={lead} />) : <p className="py-2 text-xs text-muted-foreground">{column.empty}</p>}
                {items.length > 5 ? <p className="text-xs text-muted-foreground">+{items.length - 5} más</p> : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function AgendaLead({ lead }: { lead: LeadListItem }) {
  const next = lead.next_action;
  return (
    <Link href={`/leads/${lead.id}`} className="block rounded-md border border-border px-2.5 py-2 transition-colors hover:bg-muted/50">
      <p className="truncate text-xs font-medium">{leadDisplayName(lead)}</p>
      {next ? <p className="mt-1 truncate text-[11px] text-muted-foreground">{REMINDER_ACTION_TYPE_LABEL[next.action_type]} · {relativeTime(next.remind_at)} · {next.title}</p> : <p className="mt-1 truncate text-[11px] text-muted-foreground">{lead.company ?? "Sin acción programada"}</p>}
    </Link>
  );
}