import {
  buildMonthlySeries,
  computeExpenseTotals,
  profitMargin,
} from "@/lib/finance";
import { describe, expect, it } from "vitest";

describe("computeExpenseTotals", () => {
  it("computes tax and total with 21% IVA", () => {
    const r = computeExpenseTotals(100, 21);
    expect(r.subtotal).toBe(100);
    expect(r.taxAmount).toBe(21);
    expect(r.total).toBe(121);
  });

  it("handles 0% tax rate", () => {
    const r = computeExpenseTotals(50, 0);
    expect(r.taxAmount).toBe(0);
    expect(r.total).toBe(50);
  });

  it("rounds to 2 decimals", () => {
    const r = computeExpenseTotals(33.333, 21);
    expect(r.subtotal).toBe(33.33);
    expect(r.taxAmount).toBeCloseTo(7, 1);
    expect(r.total).toBeCloseTo(40.33, 1);
  });

  it("coerces non-finite inputs to zero", () => {
    const r = computeExpenseTotals(Number.NaN, Number.POSITIVE_INFINITY);
    expect(r.subtotal).toBe(0);
    expect(r.taxAmount).toBe(0);
    expect(r.total).toBe(0);
  });
});

describe("profitMargin", () => {
  it("returns null when revenue is 0", () => {
    expect(profitMargin(0, 10)).toBeNull();
  });

  it("computes positive margin", () => {
    expect(profitMargin(1000, 400)).toBe(60);
  });

  it("can be negative when expense > revenue", () => {
    expect(profitMargin(100, 250)).toBe(-150);
  });
});

describe("buildMonthlySeries", () => {
  const ref = new Date(2026, 4, 15); // 15 May 2026

  it("returns 6 months ending at the reference month", () => {
    const series = buildMonthlySeries([], [], ref);
    expect(series).toHaveLength(6);
    // Last point is May (mes índice 4 -> "may")
    expect(series.at(-1)?.month).toBe("may");
    // First point is December of previous year
    expect(series[0]?.month).toBe("dic");
  });

  it("aggregates revenue and expense by month", () => {
    const revenue = [
      { date: "2026-05-02", total: 100 },
      { date: "2026-05-20", total: 50 },
      { date: "2026-03-10", total: 200 },
    ];
    const expense = [
      { date: "2026-05-04", total: 30 },
      { date: "2026-04-04", total: 10 },
    ];
    const series = buildMonthlySeries(revenue, expense, ref);
    const may = series.find((s) => s.month === "may");
    const apr = series.find((s) => s.month === "abr");
    const mar = series.find((s) => s.month === "mar");
    expect(may).toMatchObject({ revenue: 150, expense: 30, net: 120 });
    expect(apr).toMatchObject({ revenue: 0, expense: 10, net: -10 });
    expect(mar).toMatchObject({ revenue: 200, expense: 0, net: 200 });
  });

  it("ignores rows outside the 6-month window", () => {
    const revenue = [{ date: "2025-01-01", total: 9999 }];
    const series = buildMonthlySeries(revenue, [], ref);
    const total = series.reduce((a, p) => a + p.revenue, 0);
    expect(total).toBe(0);
  });

  it("accepts Date objects as input", () => {
    const series = buildMonthlySeries(
      [{ date: new Date(2026, 4, 1), total: 42 }],
      [],
      ref,
    );
    expect(series.at(-1)?.revenue).toBe(42);
  });
});
