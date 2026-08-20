import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// ── mocks (hoisted before imports) ──────────────────────────────────────────

vi.mock("next/navigation", () => ({
  usePathname: vi.fn().mockReturnValue("/settings/profile"),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [k: string]: unknown;
  }) => (
    <a href={href} {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
      {children}
    </a>
  ),
}));

// ── SUT (imported after mocks are in place) ──────────────────────────────────

import { usePathname } from "next/navigation";
import { SettingsNav } from "@/app/(app)/settings/settings-nav";

// ── helpers ───────────────────────────────────────────────────────────────────

function renderNav(canManageTeam: boolean) {
  return render(<SettingsNav canManageTeam={canManageTeam} />);
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("SettingsNav – item visibility", () => {
  it("always shows Perfil", () => {
    renderNav(false);
    expect(screen.getByRole("link", { name: "Perfil" })).toBeTruthy();
  });

  it("hides Empresa when canManageTeam is false (viewer / member)", () => {
    renderNav(false);
    expect(screen.queryByRole("link", { name: "Empresa" })).toBeNull();
  });

  it("shows Empresa when canManageTeam is true (admin / owner)", () => {
    renderNav(true);
    expect(screen.getByRole("link", { name: "Empresa" })).toBeTruthy();
  });

  it("hides Equipo when canManageTeam is false (viewer / member)", () => {
    renderNav(false);
    expect(screen.queryByRole("link", { name: "Equipo" })).toBeNull();
  });

  it("shows Equipo when canManageTeam is true (admin / owner)", () => {
    renderNav(true);
    expect(screen.getByRole("link", { name: "Equipo" })).toBeTruthy();
  });

  it("renders exactly 3 links for non-admin (Perfil + Seguridad + Legal)", () => {
    renderNav(false);
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });

  it("renders all 10 links for admin", () => {
    renderNav(true);
    expect(screen.getAllByRole("link")).toHaveLength(10);
  });

  it("shows Plantillas email when canManageTeam is true", () => {
    renderNav(true);
    expect(screen.getByRole("link", { name: "Plantillas email" })).toBeTruthy();
  });

  it("hides Plantillas email when canManageTeam is false", () => {
    renderNav(false);
    expect(screen.queryByRole("link", { name: "Plantillas email" })).toBeNull();
  });

  it("shows Diagnóstico when canManageTeam is true", () => {
    renderNav(true);
    expect(screen.getByRole("link", { name: "Diagnóstico" })).toBeTruthy();
  });

  it("hides Diagnóstico when canManageTeam is false", () => {
    renderNav(false);
    expect(screen.queryByRole("link", { name: "Diagnóstico" })).toBeNull();
  });

  it("shows Legal / Verifactu regardless of canManageTeam", () => {
    renderNav(false);
    expect(screen.getByRole("link", { name: "Legal / Verifactu" })).toBeTruthy();
    cleanup();
    renderNav(true);
    expect(screen.getByRole("link", { name: "Legal / Verifactu" })).toBeTruthy();
  });
});

describe("SettingsNav – active state", () => {
  it("sets aria-current=page on the active route", () => {
    (usePathname as ReturnType<typeof vi.fn>).mockReturnValue("/settings/profile");
    renderNav(false);
    const perfilLink = screen.getByRole("link", { name: /perfil/i });
    expect(perfilLink.getAttribute("aria-current")).toBe("page");
  });

  it("does not set aria-current on inactive routes", () => {
    (usePathname as ReturnType<typeof vi.fn>).mockReturnValue("/settings/profile");
    renderNav(false);
    const legalLink = screen.getByRole("link", { name: /legal/i });
    expect(legalLink.getAttribute("aria-current")).toBeNull();
  });

  it("marks /settings/company as active when on that path (admin)", () => {
    (usePathname as ReturnType<typeof vi.fn>).mockReturnValue("/settings/company");
    renderNav(true);
    expect(screen.getByRole("link", { name: /empresa/i }).getAttribute("aria-current")).toBe(
      "page",
    );
    expect(screen.getByRole("link", { name: /perfil/i }).getAttribute("aria-current")).toBeNull();
  });
});

describe("SettingsNav – tab layout", () => {
  it("uses a horizontally scrollable tab navigation at every viewport size", () => {
    const { container } = renderNav(true);
    const nav = container.querySelector('nav[aria-label="Ajustes"]');

    expect(nav?.className).toContain("overflow-x-auto");
    expect(nav?.className).not.toContain("flex-col");
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("keeps each tab as a direct settings route", () => {
    renderNav(true);

    expect(screen.getByRole("link", { name: "Equipo" }).getAttribute("href")).toBe(
      "/settings/team",
    );
  });
});
