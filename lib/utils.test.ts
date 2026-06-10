import { cn, formatEUR, truncate } from "@/lib/utils";
import { describe, expect, it } from "vitest";

describe("cn", () => {
  it("merges Tailwind classes", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});

describe("formatEUR", () => {
  it("formats a number with EUR", () => {
    const out = formatEUR(1234.5);
    expect(out).toMatch(/1.?234,50/);
    expect(out).toMatch(/€/);
  });
  it("returns em-dash on null", () => {
    expect(formatEUR(null)).toBe("—");
  });
});

describe("truncate", () => {
  it("truncates long strings with ellipsis", () => {
    expect(truncate("abcdef", 4)).toBe("abc…");
  });
  it("keeps short strings intact", () => {
    expect(truncate("ab", 4)).toBe("ab");
  });
});
