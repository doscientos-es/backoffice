import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth";
import { Sidebar } from "./sidebar";

let pathname = "/inicio";
let showSettings: boolean | undefined;

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>{children}</a>
  ),
}));
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("@/components/branding", () => ({ Logo: () => <span>Logo</span> }));
vi.mock("@/components/layout/command-palette-trigger", () => ({
  CommandPaletteTrigger: () => <button type="button">Buscar</button>,
}));
vi.mock("@/components/layout/navigation-tree", () => ({ NavigationTree: () => <div /> }));
vi.mock("@/components/layout/notifications-bell", () => ({ NotificationsBell: () => <div /> }));
vi.mock("@/components/layout/user-menu", () => ({
  UserMenu: ({ showSettings: value }: { showSettings?: boolean }) => {
    showSettings = value;
    return <div data-testid="user-menu" />;
  },
}));
vi.mock("@/components/theme-toggle", () => ({ ThemeToggle: () => <div /> }));
vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));
vi.mock("@/components/ui/error-boundary", () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/lib/navigation/navigation", () => ({ visibleNavigationGroups: () => [] }));

const user: CurrentUser = {
  id: "member-1",
  email: "ana@example.com",
  name: "Ana Pérez",
  role: "admin",
  avatarUrl: null,
  emailAlias: null,
  githubHandle: null,
  onboardedAt: null,
  jobTitle: null,
  phone: null,
  contactEmail: null,
};

describe("Sidebar settings link", () => {
  it("places the settings icon below the profile menu", () => {
    render(<Sidebar user={user} verifactuMode="TEST" demoMode={false} />);

    const settings = screen.getByRole("link", { name: "Ajustes" });
    expect(settings.getAttribute("href")).toBe("/settings");
    expect(showSettings).toBe(false);
    expect(screen.getByTestId("user-menu").compareDocumentPosition(settings)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("marks the settings icon as active in settings routes", () => {
    pathname = "/settings/profile";
    render(<Sidebar user={user} verifactuMode="TEST" demoMode={false} />);

    expect(screen.getByRole("link", { name: "Ajustes" }).getAttribute("aria-current")).toBe("page");
    pathname = "/inicio";
  });
});