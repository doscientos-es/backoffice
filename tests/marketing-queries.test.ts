import type { RawAdRow } from "@/lib/marketing/types";
import { INSIGHTS_OTHERS_KEY } from "@/lib/marketing/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// State controlled per test
const db: {
  ads: RawAdRow[];
} = { ads: [] };

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(() =>
    Promise.resolve({
      from: (_table: string) => {
        const chain = {
          select: () => Promise.resolve({ data: db.ads, error: null }),
        };
        return chain;
      },
    }),
  ),
}));

// Mock Logger to keep output clean
vi.mock("@/lib/logger", () => ({
  scopedLogger: () => ({
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

describe("getInsightsBreakdownSeries", () => {
  const since = "2026-06-01";
  const until = "2026-06-03";

  beforeEach(() => {
    db.ads = [];
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("aggregates data by day and entity (ads)", async () => {
    db.ads = [
      {
        id: "ad_1",
        name: "Ad 1",
        marketing_insights: [
          { spend: 10, total_leads: 1, date_start: "2026-06-01", date_stop: "2026-06-01" },
          { spend: 20, total_leads: 0, date_start: "2026-06-02", date_stop: "2026-06-02" },
        ],
      },
      {
        id: "ad_2",
        name: "Ad 2",
        marketing_insights: [
          { spend: 5, total_leads: 2, date_start: "2026-06-01", date_stop: "2026-06-01" },
        ],
      },
    ];

    const { getInsightsBreakdownSeries } = await import("@/lib/marketing/queries");
    const result = await getInsightsBreakdownSeries({ since, until, dimension: "ads" });

    expect(result.points).toHaveLength(2);
    // Day 1
    const p1 = result.points.find((p) => p.date === "2026-06-01");
    expect(p1?.total).toBe(15);
    expect(p1?.leads).toBe(3);
    expect(p1?.ad_1).toBe(10);
    expect(p1?.ad_2).toBe(5);

    // Day 2
    const p2 = result.points.find((p) => p.date === "2026-06-02");
    expect(p2?.total).toBe(20);
    expect(p2?.ad_1).toBe(20);
    expect(p2?.ad_2).toBe(0); // Should be seeded
  });

  it("groups bottom spenders into 'Otros' (more than 6 entities)", async () => {
    // 8 ads. Top 6 should be separate, 7-8 should be "Otros"
    db.ads = Array.from({ length: 8 }, (_, i) => ({
      id: `ad_${i + 1}`,
      name: `Ad ${i + 1}`,
      marketing_insights: [
        // Each spend i+1, so ad_8 spends 8, ad_1 spends 1.
        { spend: i + 1, total_leads: 0, date_start: "2026-06-01", date_stop: "2026-06-01" },
      ],
    }));

    const { getInsightsBreakdownSeries } = await import("@/lib/marketing/queries");
    const result = await getInsightsBreakdownSeries({ since, until, dimension: "ads" });

    // series should have 6 top + 1 "Otros" = 7
    expect(result.series).toHaveLength(7);
    expect(result.series.find((s) => s.key === INSIGHTS_OTHERS_KEY)).toBeDefined();

    const p1 = result.points[0]!;
    // Top 6 are ad_8, ad_7, ad_6, ad_5, ad_4, ad_3 (spends 8, 7, 6, 5, 4, 3)
    // "Otros" are ad_2 (spend 2) and ad_1 (spend 1) => total 3
    expect(p1[INSIGHTS_OTHERS_KEY]).toBe(3);
    expect(p1.total).toBe(36); // sum(1..8) = 36
  });

  it("handles the campaigns dimension correctly", async () => {
    db.ads = [
      {
        id: "ad_1",
        name: "Ad 1",
        campaign_id: "camp_1",
        marketing_campaigns: [{ id: "camp_1", name: "Campaign 1" }],
        marketing_insights: [
          { spend: 100, total_leads: 1, date_start: "2026-06-01", date_stop: "2026-06-01" },
        ],
      },
      {
        id: "ad_2",
        name: "Ad 2",
        campaign_id: "camp_1",
        marketing_campaigns: [{ id: "camp_1", name: "Campaign 1" }],
        marketing_insights: [
          { spend: 50, total_leads: 1, date_start: "2026-06-01", date_stop: "2026-06-01" },
        ],
      },
    ];

    const { getInsightsBreakdownSeries } = await import("@/lib/marketing/queries");
    const result = await getInsightsBreakdownSeries({ since, until, dimension: "campaigns" });

    expect(result.dimension).toBe("campaigns");
    expect(result.series).toHaveLength(1);
    expect(result.series[0]?.key).toBe("camp_1");
    expect(result.points[0]?.camp_1).toBe(150);
    expect(result.points[0]?.total).toBe(150);
  });

  it("filters by date range and ignores aggregates", async () => {
    db.ads = [
      {
        id: "ad_1",
        name: "Ad 1",
        marketing_insights: [
          // Within range
          { spend: 10, total_leads: 1, date_start: "2026-06-02", date_stop: "2026-06-02" },
          // Outside range (before)
          { spend: 100, total_leads: 1, date_start: "2026-05-31", date_stop: "2026-05-31" },
          // Outside range (after)
          { spend: 200, total_leads: 1, date_start: "2026-06-04", date_stop: "2026-06-04" },
          // Aggregate row (start !== stop)
          { spend: 500, total_leads: 1, date_start: "2026-06-01", date_stop: "2026-06-03" },
        ],
      },
    ];

    const { getInsightsBreakdownSeries } = await import("@/lib/marketing/queries");
    const result = await getInsightsBreakdownSeries({ since, until, dimension: "ads" });

    expect(result.points).toHaveLength(1);
    expect(result.points[0]?.date).toBe("2026-06-02");
    expect(result.points[0]?.total).toBe(10);
  });
});
