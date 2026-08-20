import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth";
import { Sidebar } from "./sidebar";

let pathname = "/inicio";
let showSettings: boolean | undefined;

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("@/components/branding", () => ({ Logo: () => <span>Logo</span> }));
vi.mock("@/components/layout/command-palette-trigger", () => ({
  CommandPaletteTrigger: () => <button type="button">Buscar</button>,
}));
vi.mock("@/components/layout/navigation-tree", () => ({ NavigationTree: () => <div /> }));
vi.mock("@/components/layout/notifications-bell", () => ({
  NotificationsBell: () => <button type="button" aria-label="Notificaciones" />,
}));
vi.mock("@/components/layout/user-menu", () => ({
  UserMenu: ({ showSettings: value }: { showSettings?: boolean }) => {
    showSettings = value;
    return <div data-testid="user-menu" />;
  },
}));
vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <button type="button" aria-label="Cambiar tema" />,
}));
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

describe("Sidebar actions", () => {
  it("remains visible as part of the layout at every viewport size", () => {
    const { container } = render(<Sidebar user={user} demoMode={false} />);

    const sidebar = container.querySelector("aside");
    expect(sidebar?.className).toContain("flex");
    expect(sidebar?.className).not.toContain("hidden");
  });

  it("places theme, notifications, and settings together above the profile menu", () => {
    render(<Sidebar user={user} demoMode={false} />);

    const settings = screen.getByRole("link", { name: "Ajustes" });
    const theme = screen.getByRole("button", { name: "Cambiar tema" });
    const notifications = screen.getByRole("button", { name: "Notificaciones" });
    expect(settings.getAttribute("href")).toBe("/settings");
    expect(showSettings).toBe(false);
    expect(settings.parentElement).toBe(theme.parentElement);
    expect(settings.parentElement).toBe(notifications.parentElement);
    expect(settings.compareDocumentPosition(screen.getByTestId("user-menu"))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(screen.queryByText(/^AEAT /)).toBeNull();
  });

  it("marks the settings icon as active in settings routes", () => {
    pathname = "/settings/profile";
    render(<Sidebar user={user} demoMode={false} />);

    expect(screen.getByRole("link", { name: "Ajustes" }).getAttribute("aria-current")).toBe("page");
    pathname = "/inicio";
  });
});
