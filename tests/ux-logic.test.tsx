import { PageHeader } from "@/components/layout/page-header";
import {
  CREATE_SHORTCUTS,
  NAV_SHORTCUTS,
  findShortcut,
  mergeRecentItems,
} from "@/lib/navigation/shortcuts";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("findShortcut", () => {
  it("encuentra un atajo de navegación por su tecla (case-insensitive)", () => {
    expect(findShortcut(NAV_SHORTCUTS, "l")?.href).toBe("/leads");
    expect(findShortcut(NAV_SHORTCUTS, "L")?.href).toBe("/leads");
  });

  it("encuentra un atajo de creación por su tecla", () => {
    expect(findShortcut(CREATE_SHORTCUTS, "p")?.href).toBe("/projects/new");
  });

  it("devuelve undefined si la tecla no existe", () => {
    expect(findShortcut(NAV_SHORTCUTS, "z")).toBeUndefined();
  });
});

describe("mergeRecentItems", () => {
  it("inserta el elemento al principio", () => {
    const result = mergeRecentItems([], { href: "/leads/1", label: "Lead 1" });
    expect(result[0]?.href).toBe("/leads/1");
  });

  it("deduplica por href moviendo el repetido al frente", () => {
    const list = [
      { href: "/a", label: "A" },
      { href: "/b", label: "B" },
    ];
    const result = mergeRecentItems(list, { href: "/b", label: "B" });
    expect(result.map((r) => r.href)).toEqual(["/b", "/a"]);
  });

  it("limita la lista al máximo indicado", () => {
    const list = Array.from({ length: 5 }, (_, i) => ({
      href: `/r${i}`,
      label: `R${i}`,
    }));
    const result = mergeRecentItems(list, { href: "/new", label: "New" }, 5);
    expect(result).toHaveLength(5);
    expect(result[0]?.href).toBe("/new");
    expect(result.some((r) => r.href === "/r4")).toBe(false);
  });
});

describe("PageHeader Breadcrumbs", () => {
  it("renders basic title and description", () => {
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
    // Breadcrumb page for Profile
    expect(screen.getByText("Profile")).toBeDefined();
    // Title of the page
    expect(screen.getByText("Profile Page")).toBeDefined();

    const homeLink = screen.getByRole("link", { name: "Home" });
    expect(homeLink.getAttribute("href")).toBe("/");
  });

  it("renders back link if no breadcrumbs are provided", () => {
    render(
      <PageHeader
        title="Detail"
        back={<span data-testid="back">Back</span>}
      />
    );
    expect(screen.getByTestId("back")).toBeDefined();
  });
});

import NewProjectPage from "@/app/(app)/projects/new/page";

// Mock Supabase
const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  order: vi.fn().mockResolvedValue({
    data: [{ id: "client-123", name: "Client 123" }],
    error: null,
  }),
};

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn(() => Promise.resolve({})),
}));

describe("NewProjectPage Pre-fill", () => {
  it("pre-fills client_id from searchParams", async () => {
    const searchParams = Promise.resolve({ client_id: "client-123" });
    const jsx = await NewProjectPage({ searchParams });
    render(jsx);

    const select = screen.getByLabelText(/cliente/i) as HTMLSelectElement;
    expect(select.value).toBe("client-123");
  });

  it("defaults to empty client if no searchParams provided", async () => {
    const searchParams = Promise.resolve({});
    const jsx = await NewProjectPage({ searchParams });
    render(jsx);

    const select = screen.getByLabelText(/cliente/i) as HTMLSelectElement;
    expect(select.value).toBe("");
  });
});

