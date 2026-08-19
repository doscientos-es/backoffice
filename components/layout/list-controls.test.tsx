import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({
  pathname: "/leads",
  params: new URLSearchParams(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace }),
  useSearchParams: () => navigation.params,
}));

import { ListControls } from "@/components/layout/list-controls";

const FILTER = {
  key: "assignee",
  label: "Responsable",
  display: "avatars" as const,
  options: [
    {
      value: "ana",
      label: "Ana Pérez",
      avatar: { name: "Ana Pérez", avatar_url: null, github_handle: null },
    },
  ],
};

const STATUS_FILTER = {
  key: "status",
  label: "Estado",
  options: [{ value: "new", label: "Nuevo" }],
};

describe("ListControls avatar filter", () => {
  beforeEach(() => {
    navigation.params = new URLSearchParams();
    navigation.replace.mockReset();
  });

  it("selects a member and resets pagination", () => {
    navigation.params = new URLSearchParams("page=2");
    render(<ListControls filters={[FILTER]} />);

    fireEvent.click(screen.getByRole("button", { name: "Filtrar por Ana Pérez" }));

    expect(navigation.replace).toHaveBeenCalledWith("/leads?assignee=ana", { scroll: false });
  });

  it("removes the active member filter", () => {
    navigation.params = new URLSearchParams("assignee=ana");
    render(<ListControls filters={[FILTER]} />);

    const button = screen.getByRole("button", { name: "Quitar filtro de Ana Pérez" });
    expect(button.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(button);

    expect(navigation.replace).toHaveBeenCalledWith("/leads", { scroll: false });
  });

  it("moves secondary filters into a popover in panel mode", () => {
    navigation.params = new URLSearchParams("status=new");
    render(<ListControls filters={[FILTER, STATUS_FILTER]} presentation="panel" />);

    fireEvent.click(screen.getByRole("button", { name: /filtros 1/i }));

    expect(screen.getByText("Filtrar el listado")).toBeDefined();
    expect(screen.getByRole("combobox", { name: "Estado" })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(navigation.replace).toHaveBeenCalledWith("/leads", { scroll: false });
  });
});
