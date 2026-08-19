import { User } from "lucide-react";
import { describe, expect, it } from "vitest";
import { isNavigationItemActive } from "@/components/layout/navigation-tree";

const groups = [
  {
    label: "Growth",
    items: [
      { href: "/marketing", label: "Publicidad", icon: User },
      { href: "/marketing/newsletters", label: "Newsletters", icon: User },
    ],
  },
];

describe("isNavigationItemActive", () => {
  it("prefers the most specific matching navigation item", () => {
    expect(isNavigationItemActive("/marketing/newsletters", "/marketing", groups)).toBe(false);
    expect(isNavigationItemActive("/marketing/newsletters", "/marketing/newsletters", groups)).toBe(
      true,
    );
  });

  it("keeps a parent active when it has no more specific child", () => {
    expect(isNavigationItemActive("/marketing/campaigns", "/marketing", groups)).toBe(true);
  });
});
