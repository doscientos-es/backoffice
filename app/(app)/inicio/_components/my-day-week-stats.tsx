import {
  CheckCircle as CheckCircle2,
  FlameIcon as Flame,
  Tray as Inbox,
} from "@phosphor-icons/react/ssr";
import type { ComponentType, SVGProps } from "react";
import type { WeekStats } from "@/lib/dashboard/types";
import { pluralize } from "@/lib/utils";

type WeekStatItem = {
  key: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  tone: string;
  label: string;
};

export function MyDayWeekStats({ weekStats }: { weekStats: WeekStats }) {
  const { tasksCompleted, leadsAttended, streakDays } = weekStats;
  if (tasksCompleted === 0 && leadsAttended === 0 && streakDays === 0) return null;

  const items: WeekStatItem[] = [];
  if (tasksCompleted > 0) {
    items.push({
      key: "tasks",
      icon: CheckCircle2,
      tone: "text-emerald-500",
      label: `${tasksCompleted} ${pluralize(tasksCompleted, "tarea completada", "tareas completadas")}`,
    });
  }
  if (leadsAttended > 0) {
    items.push({
      key: "leads",
      icon: Inbox,
      tone: "text-blue-500",
      label: `${leadsAttended} ${pluralize(leadsAttended, "lead atendido", "leads atendidos")}`,
    });
  }
  if (streakDays > 0) {
    items.push({
      key: "streak",
      icon: Flame,
      tone: "text-amber-500",
      label: `${streakDays} ${pluralize(streakDays, "día seguido", "días seguidos")}`,
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-1 rounded-lg border border-border bg-muted/40 px-3 py-2">
      <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Esta semana
      </span>
      {items.map((item, index) => {
        const Icon = item.icon;
        return (
          <span key={item.key} className="flex items-center gap-1 text-sm text-foreground">
            {index > 0 ? <span className="text-muted-foreground/40 select-none">·</span> : null}
            <Icon aria-hidden="true" className={`size-3.5 ${item.tone}`} />
            <span>{item.label}</span>
          </span>
        );
      })}
    </div>
  );
}
