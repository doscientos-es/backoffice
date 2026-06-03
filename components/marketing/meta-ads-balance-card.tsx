import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MetaAdsBalance, MetaAdsBalanceStatus } from "@/lib/marketing/types";
import { cn, formatEUR } from "@/lib/utils";
import { AlertTriangle, Flame, TrendingDown, Wallet } from "lucide-react";

const numberFmt = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });

const STATUS_BALANCE_CLASS: Record<MetaAdsBalanceStatus, string> = {
  ok: "text-foreground",
  warning: "text-amber-600 dark:text-amber-400",
  critical: "text-red-600 dark:text-red-400",
};

const STATUS_ICON_CLASS: Record<MetaAdsBalanceStatus, string> = {
  ok: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  critical: "bg-red-500/10 text-red-600 dark:text-red-400",
};

const STATUS_ALERT: Record<
  Exclude<MetaAdsBalanceStatus, "ok">,
  { className: string; message: (data: MetaAdsBalance) => string }
> = {
  warning: {
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    message: (d) =>
      d.daysRemaining !== null
        ? `Saldo bajo: quedan ~${numberFmt.format(d.daysRemaining)} días al ritmo actual. Recarga pronto.`
        : "Saldo bajo en la cuenta de Meta Ads. Conviene recargar pronto.",
  },
  critical: {
    className: "bg-red-500/10 text-red-700 dark:text-red-300",
    message: (d) =>
      d.balance <= 0
        ? "Sin saldo: la recarga registrada ya se ha consumido. Recarga para no parar los anuncios."
        : `Saldo crítico: quedan ~${numberFmt.format(d.daysRemaining ?? 0)} días. Recarga ya.`,
  },
};

function formatDays(days: number | null): string {
  if (days === null) return "—";
  if (days < 1) return "<1 día";
  return `${numberFmt.format(days)} días`;
}

/**
 * Presentational widget summarising the estimated Meta Ads account balance:
 * recharges minus reported spend, the daily burn rate, the runway in days and a
 * colour-coded alert when the balance is running low. Shared by the Marketing
 * page and the dashboard. Render nothing when there is no data to show.
 */
export function MetaAdsBalanceCard({ data }: { data: MetaAdsBalance | null }) {
  if (!data) return null;

  const { balance, totalRecharged, totalSpent, dailyBurn, daysRemaining, status, currency } = data;
  const alert = status === "ok" ? null : STATUS_ALERT[status];

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Saldo Meta Ads</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">Recargas registradas − gasto reportado</p>
        </div>
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            STATUS_ICON_CLASS[status],
          )}
        >
          <Wallet className="size-4" aria-hidden />
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div>
          <div
            className={cn("text-3xl font-semibold tabular-nums", STATUS_BALANCE_CLASS[status])}
            title={currency !== "EUR" ? `Moneda de la cuenta: ${currency}` : undefined}
          >
            {formatEUR(balance)}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatEUR(totalRecharged)} recargado · {formatEUR(totalSpent)} gastado
          </p>
        </div>

        {alert ? (
          <div
            className={cn(
              "flex items-start gap-2 rounded-lg px-3 py-2 text-xs font-medium",
              alert.className,
            )}
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{alert.message(data)}</span>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-muted/50 px-3 py-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Flame className="size-3.5" aria-hidden />
              Gasto diario
            </div>
            <div className="mt-1 font-medium tabular-nums">{formatEUR(dailyBurn)}/día</div>
          </div>
          <div className="rounded-lg bg-muted/50 px-3 py-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingDown className="size-3.5" aria-hidden />
              Autonomía
            </div>
            <div
              className={cn(
                "mt-1 font-medium tabular-nums",
                status !== "ok" && STATUS_BALANCE_CLASS[status],
              )}
            >
              {formatDays(daysRemaining)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
