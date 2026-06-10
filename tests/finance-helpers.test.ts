import {
  buildVatBreakdown,
  computeLineSubtotal,
  computeLineTotals,
  roundCurrency,
} from "@/lib/finance";
import { describe, expect, it } from "vitest";

describe("roundCurrency", () => {
  it("rounds to 2 decimals", () => {
    expect(roundCurrency(1.005)).toBeCloseTo(1.0, 2);
    expect(roundCurrency(33.333)).toBe(33.33);
    expect(roundCurrency(0)).toBe(0);
  });
});

describe("computeLineSubtotal", () => {
  it("multiplies quantity by unit price", () => {
    expect(computeLineSubtotal({ quantity: 3, unit_price: 10 })).toBe(30);
  });

  it("rounds the product to 2 decimals", () => {
    expect(computeLineSubtotal({ quantity: 3, unit_price: 9.999 })).toBe(30);
  });

  it("coerces non-numeric inputs to zero", () => {
    expect(computeLineSubtotal({ quantity: Number.NaN, unit_price: 10 })).toBe(0);
    // @ts-expect-error exercising runtime coercion of bad input
    expect(computeLineSubtotal({ quantity: "x", unit_price: 10 })).toBe(0);
  });
});

describe("computeLineTotals", () => {
  it("returns zeros for an empty list", () => {
    expect(computeLineTotals([])).toEqual({ subtotal: 0, taxAmount: 0, total: 0 });
  });

  it("aggregates subtotal, tax and total across mixed VAT rates", () => {
    const r = computeLineTotals([
      { quantity: 1, unit_price: 1000, vat_rate: 21 },
      { quantity: 2, unit_price: 100, vat_rate: 10 },
    ]);
    expect(r.subtotal).toBe(1200);
    expect(r.taxAmount).toBe(230); // 210 + 20
    expect(r.total).toBe(1430);
  });

  it("treats line items as one-time regardless of cadence", () => {
    const r = computeLineTotals([{ quantity: 1, unit_price: 50, vat_rate: 0 }]);
    expect(r).toEqual({ subtotal: 50, taxAmount: 0, total: 50 });
  });

  it("coerces NaN inputs to zero", () => {
    const r = computeLineTotals([
      { quantity: Number.NaN, unit_price: Number.NaN, vat_rate: Number.NaN },
    ]);
    expect(r).toEqual({ subtotal: 0, taxAmount: 0, total: 0 });
  });
});

describe("buildVatBreakdown", () => {
  it("returns an empty array for no items", () => {
    expect(buildVatBreakdown([])).toEqual([]);
  });

  it("groups bases and taxes per distinct rate, sorted ascending", () => {
    const rows = buildVatBreakdown([
      { vat_rate: 21, subtotal: 100 },
      { vat_rate: 10, subtotal: 200 },
      { vat_rate: 21, subtotal: 50 },
    ]);
    expect(rows).toEqual([
      { rate: 10, base: 200, tax: 20 },
      { rate: 21, base: 150, tax: 31.5 },
    ]);
  });

  it("tolerates string and null inputs coming from Supabase", () => {
    const rows = buildVatBreakdown([
      { vat_rate: "21", subtotal: "100" },
      { vat_rate: null, subtotal: 80 },
      { vat_rate: undefined, subtotal: undefined },
    ]);
    // null/undefined rate collapse into the 0% bucket
    const zero = rows.find((r) => r.rate === 0);
    const twentyOne = rows.find((r) => r.rate === 21);
    expect(zero).toEqual({ rate: 0, base: 80, tax: 0 });
    expect(twentyOne).toEqual({ rate: 21, base: 100, tax: 21 });
    // sorted: 0 before 21
    expect(rows[0]?.rate).toBe(0);
  });
});
