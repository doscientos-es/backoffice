import { describe, expect, it, vi } from "vitest";

// ── mock next/navigation before importing the page ───────────────────────────

const mockRedirect = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

// ── SUT ──────────────────────────────────────────────────────────────────────

import SettingsPage from "@/app/(app)/settings/page";

// ── tests ─────────────────────────────────────────────────────────────────────

describe("settings root page", () => {
  it("redirects to /settings/profile", () => {
    SettingsPage();
    expect(mockRedirect).toHaveBeenCalledWith("/settings/profile");
  });

  it("redirects exactly once per render", () => {
    mockRedirect.mockClear();
    SettingsPage();
    expect(mockRedirect).toHaveBeenCalledTimes(1);
  });
});
