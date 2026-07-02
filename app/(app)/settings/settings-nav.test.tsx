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

import { SettingsNav } from "@/app/(app)/settings/settings-nav";
import { usePathname } from "next/navigation";

// ── helpers ───────────────────────────────────────────────────────────────────

function renderNav(canManageTeam: boolean) {
  return render(<SettingsNav canManageTeam={canManageTeam} />);
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("SettingsNav – item visibility", () => {
  it("always shows Perfil", () => {
    renderNav(false);
    expect(screen.getByText("Perfil")).toBeTruthy();
  });

  it("always shows Empresa", () => {
    renderNav(false);
    expect(screen.getByText("Empresa")).toBeTruthy();
  });

  it("hides Equipo when canManageTeam is false (viewer / member)", () => {
    renderNav(false);
    expect(screen.queryByText("Equipo")).toBeNull();
  });

  it("shows Equipo when canManageTeam is true (admin / owner)", () => {
    renderNav(true);
    expect(screen.getByText("Equipo")).toBeTruthy();
  });

  it("renders exactly 3 links for non-admin", () => {
    renderNav(false);
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });

  it("renders exactly 6 links for admin", () => {
    renderNav(true);
    expect(screen.getAllByRole("link")).toHaveLength(6);
  });

  it("shows Plantillas email when canManageTeam is true", () => {
    renderNav(true);
    expect(screen.getByText("Plantillas email")).toBeTruthy();
  });

  it("hides Plantillas email when canManageTeam is false", () => {
    renderNav(false);
    expect(screen.queryByText("Plantillas email")).toBeNull();
  });

  it("shows Diagnóstico when canManageTeam is true", () => {
    renderNav(true);
    expect(screen.getByText("Diagnóstico")).toBeTruthy();
  });

  it("hides Diagnóstico when canManageTeam is false", () => {
    renderNav(false);
    expect(screen.queryByText("Diagnóstico")).toBeNull();
  });

  it("shows Legal / Verifactu regardless of canManageTeam", () => {
    renderNav(false);
    expect(screen.getByText("Legal / Verifactu")).toBeTruthy();
    cleanup();
    renderNav(true);
    expect(screen.getByText("Legal / Verifactu")).toBeTruthy();
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
    const empresaLink = screen.getByRole("link", { name: /empresa/i });
    expect(empresaLink.getAttribute("aria-current")).toBeNull();
  });

  it("marks /settings/company as active when on that path", () => {
    (usePathname as ReturnType<typeof vi.fn>).mockReturnValue("/settings/company");
    renderNav(false);
    expect(screen.getByRole("link", { name: /empresa/i }).getAttribute("aria-current")).toBe(
      "page",
    );
    expect(screen.getByRole("link", { name: /perfil/i }).getAttribute("aria-current")).toBeNull();
  });
});
