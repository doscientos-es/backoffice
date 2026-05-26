import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export type StatTone = "default" | "success" | "danger" | "info" | "warning";

export type StatCardProps = {
  label: string;
  value: number | string;
  tone?: StatTone;
  icon?: LucideIcon;
  hint?: string;
};

const TONE_VALUE: Record<StatTone, string> = {
  default: "text-foreground",
  success: "text-emerald-700 dark:text-emerald-400",
  danger: "text-red-600 dark:text-red-400",
  info: "text-sky-700 dark:text-sky-400",
  warning: "text-amber-700 dark:text-amber-400",
};

const TONE_ICON: Record<StatTone, string> = {
  default: "bg-muted text-muted-foreground",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  danger: "bg-red-500/10 text-red-600 dark:text-red-400",
  info: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

export function StatCard({ label, value, tone = "default", icon: Icon, hint }: StatCardProps) {
  const displayValue =
    typeof value === "number" ? new Intl.NumberFormat("es-ES").format(value) : value;

  return (
    <Card className="transition-colors hover:bg-muted/30">
      <CardContent className="flex items-start justify-between gap-3 pt-5">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
            {label}
          </div>
          <div
            className={cn(
              "mt-1.5 truncate text-2xl font-semibold tracking-tight tabular-nums",
              TONE_VALUE[tone],
            )}
          >
            {displayValue}
          </div>
          {hint ? (
            <div className="mt-1 text-xs text-muted-foreground/60">{hint}</div>
          ) : null}
        </div>
        {Icon ? (
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg",
              TONE_ICON[tone],
            )}
          >
            <Icon className="size-4" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
