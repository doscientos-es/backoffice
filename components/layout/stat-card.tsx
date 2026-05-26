import { Card, CardContent } from "@/components/ui/card";
import type { Trend } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import Link from "next/link";

export type StatTone = "default" | "success" | "danger" | "info" | "warning";

export type StatCardProps = {
  label: string;
  value: number | string;
  tone?: StatTone;
  icon?: LucideIcon;
  hint?: string;
  href?: string;
  trend?: Trend | null;
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

const TREND_STYLE = {
  up: "text-emerald-600 dark:text-emerald-400",
  down: "text-red-600 dark:text-red-400",
  flat: "text-muted-foreground",
} as const;

const TREND_ICON = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: Minus,
} as const;

export function StatCard({
  label,
  value,
  tone = "default",
  icon: Icon,
  hint,
  href,
  trend,
}: StatCardProps) {
  const displayValue =
    typeof value === "number" ? new Intl.NumberFormat("es-ES").format(value) : value;
  const TrendIcon = trend ? TREND_ICON[trend.direction] : null;

  const card = (
    <Card
      className={cn(
        "transition-colors hover:bg-muted/80",
        href && "cursor-pointer hover:ring-foreground/10",
      )}
    >
      <CardContent className="flex items-start justify-between gap-3 pt-5">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
          {trend && TrendIcon ? (
            <div
              className={cn(
                "mt-1 flex items-center gap-1 text-xs font-medium tabular-nums",
                TREND_STYLE[trend.direction],
              )}
            >
              <TrendIcon className="size-3" aria-hidden />
              <span>
                {trend.delta > 0 ? "+" : ""}
                {trend.delta.toFixed(1)}%
              </span>
              {hint ? <span className="text-muted-foreground">· {hint}</span> : null}
            </div>
          ) : hint ? (
            <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
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

  if (href) {
    return (
      <Link href={href} className="block">
        {card}
      </Link>
    );
  }

  return card;
}
