import { describe, expect, it } from "vitest";
import { NAVIGATION_GROUPS, visibleNavigationGroups } from "./navigation";

const routes = (groups: typeof NAVIGATION_GROUPS) =>
  groups.flatMap((group) => group.items.map((item) => item.href));

describe("navigation", () => {
  it("keeps recovery and newsletter routes in the shared navigation", () => {
    expect(routes(NAVIGATION_GROUPS)).toEqual(
      expect.arrayContaining(["/leads/recovery", "/marketing/newsletters"]),
    );
  });

  it("hides admin-only routes for collaborators", () => {
    const visible = routes(visibleNavigationGroups("member"));
    expect(visible).not.toContain("/vault");
    expect(visible).not.toContain("/invoices");
    expect(visible).toContain("/leads/recovery");
  });
});
