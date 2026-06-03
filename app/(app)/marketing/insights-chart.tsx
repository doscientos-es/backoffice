"use client";

import type { InsightsTimePoint } from "@/lib/marketing/types";
import { formatEUR } from "@/lib/utils";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const SERIES_LABEL: Record<string, string> = {
  spend: "Gasto",
  leads: "Leads",
};

const dayFmt = new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short" });

/** Renders a `YYYY-MM-DD` string as a short, localized day label. */
function formatDay(value: string): string {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return value;
  return dayFmt.format(new Date(y, m - 1, d));
}

/**
 * Evolution chart for the marketing dashboard: daily spend as bars and daily
 * Meta-attributed leads as a line, sharing one X axis but with independent Y
 * axes (euros vs. count).
 */
export function InsightsChart({ data }: { data: InsightsTimePoint[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="date"
            stroke="var(--muted-foreground)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatDay}
            minTickGap={24}
          />
          <YAxis
            yAxisId="spend"
            stroke="var(--muted-foreground)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
            width={44}
          />
          <YAxis
            yAxisId="leads"
            orientation="right"
            stroke="var(--muted-foreground)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={32}
          />
          <Tooltip
            cursor={{ fill: "color-mix(in oklab, var(--muted) 60%, transparent)" }}
            contentStyle={{
              background: "var(--background)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(label) => formatDay(String(label))}
            formatter={(value: number, name) => [
              name === "spend" ? formatEUR(value) : value,
              SERIES_LABEL[String(name)] ?? String(name),
            ]}
          />
          <Legend
            verticalAlign="top"
            height={24}
            iconSize={8}
            wrapperStyle={{ fontSize: 11, color: "var(--muted-foreground)" }}
            formatter={(value) => SERIES_LABEL[String(value)] ?? String(value)}
          />
          <Bar
            yAxisId="spend"
            dataKey="spend"
            fill="var(--primary)"
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
          />
          <Line
            yAxisId="leads"
            type="monotone"
            dataKey="leads"
            stroke="var(--info, var(--foreground))"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
