import { describe, expect, it } from "vitest";

import { type AnalyticsLead, buildLeadJourneyAnalytics, type LeadStatusEvent } from "./analytics";

const leads: AnalyticsLead[] = [
  {
    id: "lead-1",
    source: "Landing",
    utm_source: null,
    status: "won",
    estimated_value: 1200,
    created_at: "2026-08-01T10:00:00Z",
  },
  {
    id: "lead-2",
    source: "meta",
    utm_source: null,
    status: "lost",
    estimated_value: 500,
    created_at: "2026-08-04T10:00:00Z",
  },
  {
    id: "lead-3",
    source: null,
    utm_source: null,
    status: "new",
    estimated_value: 300,
    created_at: "2026-08-06T10:00:00Z",
  },
];

const events: LeadStatusEvent[] = [
  { lead_id: "lead-1", created_at: "2026-08-02T10:00:00Z", payload: { to: "contacted" } },
  { lead_id: "lead-1", created_at: "2026-08-03T10:00:00Z", payload: { to: "quoted" } },
  { lead_id: "lead-1", created_at: "2026-08-05T10:00:00Z", payload: { to: "won" } },
  { lead_id: "lead-2", created_at: "2026-08-05T10:00:00Z", payload: { to: "qualifying" } },
];

describe("buildLeadJourneyAnalytics", () => {
  it("normalizes sources and legacy stages into a linked commercial journey", () => {
    const result = buildLeadJourneyAnalytics(leads, events, events, "2026-08-01", "2026-08-10");

    expect(result.total).toBe(3);
    expect(result.won).toBe(1);
    expect(result.lost).toBe(1);
    expect(result.pipelineValue).toBe(2000);
    expect(result.wonValue).toBe(1200);
    expect(result.conversionRate).toBeCloseTo(100 / 3);
    expect(result.sankeyLinks).toContainEqual({
      source: "source:Landing",
      target: "stage:new",
      value: 1,
    });
    expect(result.sankeyLinks).toContainEqual({
      source: "stage:in_conversation",
      target: "stage:lost",
      value: 1,
    });
    expect(result.sourcePerformance).toContainEqual({
      source: "Anuncios Meta",
      leads: 1,
      won: 0,
      rate: 0,
      pipelineValue: 500,
      wonValue: 0,
    });
  });

  it("keeps the first closed journey acyclic when a lead is reopened", () => {
    const result = buildLeadJourneyAnalytics(
      [
        {
          id: "lead-1",
          source: "Landing",
          utm_source: null,
          status: "in_conversation",
          estimated_value: null,
          created_at: "2026-08-01T10:00:00Z",
        },
      ],
      [
        { lead_id: "lead-1", created_at: "2026-08-02T10:00:00Z", payload: { to: "lost" } },
        {
          lead_id: "lead-1",
          created_at: "2026-08-03T10:00:00Z",
          payload: { to: "in_conversation" },
        },
      ],
      [],
      "2026-08-01",
      "2026-08-10",
    );

    expect(result.sankeyLinks).toContainEqual({
      source: "stage:new",
      target: "stage:lost",
      value: 1,
    });
    expect(result.sankeyLinks.some((link) => link.source === "stage:lost")).toBe(false);
  });

  it("groups paid social UTM sources under Meta Ads", () => {
    const result = buildLeadJourneyAnalytics(
      [
        {
          id: "lead-meta",
          source: "Landing",
          utm_source: "facebook",
          status: "new",
          estimated_value: null,
          created_at: "2026-08-01T10:00:00Z",
        },
      ],
      [],
      [],
      "2026-08-01",
      "2026-08-10",
    );

    expect(result.sourcePerformance[0]?.source).toBe("Anuncios Meta");
  });
});
