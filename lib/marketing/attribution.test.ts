import { describe, expect, it } from "vitest";

import { buildAdCommercialPerformance, isMetaAttributedLead } from "./attribution";

describe("buildAdCommercialPerformance", () => {
  it("joins ad leads to customers and their non-draft invoices", () => {
    const result = buildAdCommercialPerformance(
      ["ad-1", "ad-2"],
      [
        { id: "lead-1", utm_content: "ad-1", status: "won", estimated_value: 1200 },
        { id: "lead-2", utm_content: "ad-1", status: "lost", estimated_value: 500 },
        { id: "lead-3", utm_content: "ad-2", status: "quoted", estimated_value: 800 },
      ],
      [
        { id: "client-1", lead_id: "lead-1" },
        { id: "client-ignored", lead_id: "lead-outside" },
      ],
      [{ client_id: "client-1", total: 1452 }],
    );

    expect(result.get("ad-1")).toEqual({
      crmLeads: 2,
      qualifiedLeads: 1,
      wonLeads: 1,
      lostLeads: 1,
      customers: 1,
      wonValue: 1200,
      invoicedRevenue: 1452,
    });
    expect(result.get("ad-2")).toEqual({
      crmLeads: 1,
      qualifiedLeads: 1,
      wonLeads: 0,
      lostLeads: 0,
      customers: 0,
      wonValue: 0,
      invoicedRevenue: 0,
    });
  });
});

describe("isMetaAttributedLead", () => {
  it("recognizes instant forms and paid-social UTMs", () => {
    expect(isMetaAttributedLead({ external_source: "Anuncios Meta", utm_source: null })).toBe(true);
    expect(isMetaAttributedLead({ external_source: "Landing", utm_source: "facebook" })).toBe(true);
    expect(isMetaAttributedLead({ external_source: "Landing", utm_source: "google" })).toBe(false);
  });
});
