import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAINTENANCE_OFFER,
  maintenancePlanAsLineItem,
  parseMaintenanceOffer,
  selectedMaintenancePlan,
} from "./maintenance";

describe("proposal maintenance offer", () => {
  it("uses the public maintenance plans when a proposal has no custom snapshot", () => {
    expect(parseMaintenanceOffer(null)).toEqual(DEFAULT_MAINTENANCE_OFFER);
    expect(parseMaintenanceOffer({ plans: [] })).toEqual(DEFAULT_MAINTENANCE_OFFER);
  });

  it("turns the selected plan into a monthly proposal line", () => {
    const plan = selectedMaintenancePlan(DEFAULT_MAINTENANCE_OFFER, "growth");
    expect(plan?.name).toBe("Crecimiento");
    expect(maintenancePlanAsLineItem(plan!)).toMatchObject({
      description: "Mantenimiento web · Crecimiento",
      unit_price: 100,
      vat_rate: 21,
      billing_cycle: "monthly",
    });
  });

  it("does not fabricate a selection for an unknown or omitted plan", () => {
    expect(selectedMaintenancePlan(DEFAULT_MAINTENANCE_OFFER, null)).toBeNull();
    expect(selectedMaintenancePlan(DEFAULT_MAINTENANCE_OFFER, "unknown")).toBeNull();
  });
});
