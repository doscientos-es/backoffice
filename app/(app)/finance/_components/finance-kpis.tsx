import { StatCard } from "@/components/layout/stat-card";
import { getFinanceKpis } from "@/lib/finance/queries";
import { formatEUR } from "@/lib/utils";
import { Percent, Receipt, TrendingDown, TrendingUp } from "lucide-react";

export async function FinanceKpis() {
  const { revenueMonth, expenseMonth, netMonth, margin } = await getFinanceKpis();

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Ingresos este mes"
        value={formatEUR(revenueMonth)}
        tone="success"
        icon={TrendingUp}
      />
      <StatCard
        label="Gastos este mes"
        value={formatEUR(expenseMonth)}
        tone="danger"
        icon={TrendingDown}
      />
      <StatCard
        label="Beneficio neto"
        value={formatEUR(netMonth)}
        tone={netMonth >= 0 ? "success" : "danger"}
        icon={Receipt}
      />
      <StatCard
        label="Margen"
        value={margin == null ? "—" : `${margin.toFixed(1)}%`}
        tone={margin != null && margin >= 0 ? "info" : "danger"}
        icon={Percent}
      />
    </div>
  );
}
