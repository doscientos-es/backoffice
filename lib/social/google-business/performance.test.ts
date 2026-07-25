import { describe, expect, it, vi } from "vitest";
import { fetchGoogleBusinessPerformance } from "./performance";

const request = vi.hoisted(() => vi.fn());

vi.mock("./client", () => ({
  googleBusinessLocationId: () => "location-1",
  googleBusinessPerformanceRequest: request,
}));

describe("Google Business performance metrics", () => {
  it("maps dated metric values and ignores malformed points", async () => {
    request.mockImplementation(async (path: string) =>
      path.includes("CALL_CLICKS")
        ? {
            timeSeries: {
              datedValues: [
                { date: { year: 2026, month: 7, day: 23 }, value: "12" },
                { date: { year: 2026, month: 7 }, value: "4" },
              ],
            },
          }
        : { timeSeries: { datedValues: [] } },
    );

    const metrics = await fetchGoogleBusinessPerformance(1);
    expect(metrics).toContainEqual({
      metric: "CALL_CLICKS",
      date: "2026-07-23",
      value: 12,
    });
    expect(metrics).toHaveLength(1);
  });
});
