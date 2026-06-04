import { StatCard } from "@/components/layout/stat-card";
import { getFinanceKpis } from "@/lib/finance/queries";
import { formatEUR } from "@/lib/utils";
import { Percent, Receipt, TrendingDown, TrendingUp } from "lucide-react";

type Props = { since: string; until: string; rangeLabel: string };

export async function FinanceKpis({ since, until, rangeLabel }: Props) {
  const { revenueMonth, expenseMonth, netMonth, margin } = await getFinanceKpis(since, until);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Ingresos"
        value={formatEUR(revenueMonth)}
        tone="success"
        icon={TrendingUp}
        hint={rangeLabel}
      />
      <StatCard
        label="Gastos"
        value={formatEUR(expenseMonth)}
        tone="danger"
        icon={TrendingDown}
        hint={rangeLabel}
      />
      <StatCard
        label="Beneficio neto"
        value={formatEUR(netMonth)}
        tone={netMonth >= 0 ? "success" : "danger"}
        icon={Receipt}
        hint={rangeLabel}
      />
      <StatCard
        label="Margen"
        value={margin == null ? "—" : `${margin.toFixed(1)}%`}
        tone={margin != null && margin >= 0 ? "info" : "danger"}
        icon={Percent}
        hint={rangeLabel}
      />
    </div>
  );
}
