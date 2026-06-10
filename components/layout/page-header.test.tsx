import { PageHeader } from "@/components/layout/page-header";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("PageHeader", () => {
  it("renders title and description", () => {
    render(<PageHeader title="Test Title" description="Test Description" />);
    expect(screen.getByText("Test Title")).toBeDefined();
    expect(screen.getByText("Test Description")).toBeDefined();
  });

  it("renders breadcrumbs when provided", () => {
    const breadcrumbs = [
      { label: "Home", href: "/" },
      { label: "Settings", href: "/settings" },
      { label: "Profile" },
    ];
    render(<PageHeader title="Profile Page" breadcrumbs={breadcrumbs} />);
    expect(screen.getByText("Home")).toBeDefined();
    expect(screen.getByText("Settings")).toBeDefined();
    expect(screen.getByText("Profile")).toBeDefined();
    expect(screen.getByText("Profile Page")).toBeDefined();
    expect(screen.getByRole("link", { name: "Home" }).getAttribute("href")).toBe("/");
  });

  it("renders back slot when no breadcrumbs are provided", () => {
    render(<PageHeader title="Detail" back={<span data-testid="back">Back</span>} />);
    expect(screen.getByTestId("back")).toBeDefined();
  });
});
