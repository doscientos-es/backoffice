import { NavigationTree, isNavigationItemActive } from "@/components/layout/navigation-tree";
import { render, screen } from "@testing-library/react";
import { User } from "lucide-react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children }: { children: ReactNode }) => children,
}));

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

  it("keeps every navigation section open", () => {
    render(createElement(NavigationTree, { groups, pathname: "/inicio" }));

    expect(screen.getByText("Publicidad")).toBeTruthy();
    expect(screen.getByText("Newsletters")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Growth" })).toBeNull();
  });
});
