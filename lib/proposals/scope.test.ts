import { describe, expect, it } from "vitest";
import {
  DEFAULT_CHANGE_MANAGEMENT_TERMS,
  parseScopeModules,
  paymentInitialPercentage,
  paymentScheduleInput,
  scopeModulesInput,
} from "./scope";

describe("proposal commercial scope", () => {
  const module = {
    id: "scope-1",
    title: "Portal de clientes",
    description: "Un espacio privado para cada cliente.",
    included: ["Acceso con usuarios"],
    excluded: ["Migración histórica"],
    notes: null,
  };

  it("validates the structured included and excluded scope of a module", () => {
    expect(scopeModulesInput.parse([module])).toEqual([module]);
    expect(scopeModulesInput.safeParse([{ ...module, duration_weeks: 6 }]).success).toBe(true);
    expect(scopeModulesInput.safeParse([{ ...module, duration_weeks: 7 }]).success).toBe(false);
    expect(
      scopeModulesInput.safeParse([
        { ...module, duration_mode: "custom", duration_custom: "3 meses" },
      ]).success,
    ).toBe(true);
    expect(
      scopeModulesInput.safeParse([
        { ...module, duration_mode: "custom", duration_custom: "tres meses" },
      ]).success,
    ).toBe(false);
    expect(scopeModulesInput.safeParse([{ ...module, title: "" }]).success).toBe(false);
  });

  it("returns no modules for legacy or malformed JSONB", () => {
    expect(parseScopeModules(null)).toEqual([]);
    expect(parseScopeModules([{ ...module, included: "not-an-array" }])).toEqual([]);
  });

  it("only accepts supported payment templates", () => {
    expect(paymentScheduleInput.parse("30_40_30")).toBe("30_40_30");
    expect(paymentScheduleInput.parse("per_module_upfront")).toBe("per_module_upfront");
    expect(paymentScheduleInput.safeParse("60_40").success).toBe(false);
    expect(DEFAULT_CHANGE_MANAGEMENT_TERMS).toContain("excedan el alcance");
  });

  it("calculates only the automatic first payment of standard schedules", () => {
    expect(paymentInitialPercentage("upfront")).toBe(100);
    expect(paymentInitialPercentage("half_half")).toBe(50);
    expect(paymentInitialPercentage("30_40_30")).toBe(30);
    expect(paymentInitialPercentage("per_module_upfront")).toBeNull();
    expect(paymentInitialPercentage("custom")).toBeNull();
  });
});
