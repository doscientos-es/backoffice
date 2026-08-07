import { render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { PasskeyStatusCard } from "./passkey-status-card";

vi.mock("next/link", () => ({
  default: ({
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode }) => (
    <a {...props}>{children}</a>
  ),
}));

describe("PasskeyStatusCard", () => {
  it("guides users without a passkey to the vault setup flow", () => {
    render(<PasskeyStatusCard configured={false} />);

    expect(screen.getByText("Pendiente")).toBeDefined();
    expect(screen.getByRole("link", { name: /configurar biometría/i }).getAttribute("href")).toBe(
      "/vault?setup=passkey",
    );
  });

  it("shows the configured state without presenting another setup CTA", () => {
    render(<PasskeyStatusCard configured />);

    expect(screen.getByText("Configurada")).toBeDefined();
    expect(screen.queryByRole("link", { name: /configurar biometría/i })).toBeNull();
  });
});
