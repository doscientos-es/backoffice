import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ScopeModule } from "@/lib/proposals/scope";
import { ScopeModulesEditor } from "./scope-modules-editor";

const module: ScopeModule = {
  id: "scope-1",
  title: "Portal de clientes",
  description: "Un espacio privado.",
  included: [],
  excluded: [],
  notes: "",
};

function ControlledEditor({ onChange = vi.fn() }: { onChange?: (modules: ScopeModule[]) => void }) {
  const [modules, setModules] = useState([module]);
  return (
    <ScopeModulesEditor
      modules={modules}
      onChange={(next) => {
        setModules(next);
        onChange(next);
      }}
    />
  );
}

describe("ScopeModulesEditor", () => {
  it("creates and focuses the next included point when Enter is pressed", () => {
    const onChange = vi.fn();
    render(<ControlledEditor onChange={onChange} />);

    const firstPoint = screen.getByLabelText("Incluido, punto 1");
    fireEvent.change(firstPoint, { target: { value: "Alta de usuarios" } });
    fireEvent.keyDown(firstPoint, { key: "Enter" });

    const secondPoint = screen.getByLabelText("Incluido, punto 2");
    expect(document.activeElement).toBe(secondPoint);
    fireEvent.change(secondPoint, { target: { value: "Gestión de permisos" } });

    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ included: ["Alta de usuarios", "Gestión de permisos"] }),
    ]);
  });

  it("keeps included and excluded points separate and removes an empty point with Backspace", () => {
    render(<ControlledEditor />);

    const included = screen.getByLabelText("Incluido, punto 1");
    fireEvent.change(included, { target: { value: "Configuración" } });
    fireEvent.keyDown(included, { key: "Enter" });
    const emptyIncluded = screen.getByLabelText("Incluido, punto 2");
    fireEvent.keyDown(emptyIncluded, { key: "Backspace" });

    expect(screen.queryByLabelText("Incluido, punto 2")).toBeNull();
    expect(screen.getByLabelText("No incluido, punto 1")).toBeDefined();
  });
});
