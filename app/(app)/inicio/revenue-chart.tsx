"use client";

import { formatEUR } from "@/lib/utils";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type RevenuePoint = {
  month: string; // "ene", "feb"...
  revenue: number;
};

export function RevenueChart({ data }: { data: RevenuePoint[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="month"
            stroke="var(--muted-foreground)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="var(--muted-foreground)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
            width={40}
          />
          <Tooltip
            cursor={{ fill: "color-mix(in oklab, var(--muted) 60%, transparent)" }}
            contentStyle={{
              background: "var(--background)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: number) => [formatEUR(value), "Ingresos"]}
          />
          <Bar dataKey="revenue" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
