import { defaultMeetingEnd, defaultMeetingStart } from "@/lib/calendar/date-presets";
import { describe, expect, it } from "vitest";

describe("calendar date presets", () => {
  const now = new Date(2026, 0, 31, 15, 45);

  it("suggests tomorrow at 10:00 and 11:00", () => {
    expect(defaultMeetingStart(now)).toBe("2026-02-01T10:00");
    expect(defaultMeetingEnd(now)).toBe("2026-02-01T11:00");
  });
});
