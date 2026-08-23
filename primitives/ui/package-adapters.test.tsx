import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { FormFeedback } from "./form-feedback";
import { FormRow } from "./form-row";
import { Kbd, KbdGroup } from "./kbd";

describe("@doscientos/ui adapters", () => {
  it("renders accessible form feedback from the package", () => {
    render(<FormFeedback state={{ status: "success" }} />);

    expect(screen.getByRole("status").textContent).toContain("Guardado");
  });

  it("keeps labels and errors associated in form rows", () => {
    render(
      <FormRow label="Nombre" htmlFor="name" error="Campo obligatorio">
        <input id="name" />
      </FormRow>,
    );

    expect(screen.getByLabelText("Nombre")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("Campo obligatorio");
  });

  it("groups keyboard shortcuts without nesting kbd elements", () => {
    const { container } = render(
      <KbdGroup>
        <Kbd>Ctrl</Kbd>
        <Kbd>K</Kbd>
      </KbdGroup>,
    );

    const group = container.querySelector('[data-slot="kbd-group"]');
    expect(group?.tagName).toBe("SPAN");
    expect(group?.querySelectorAll("kbd")).toHaveLength(2);
  });

  it("replaces an avatar fallback after its image loads", () => {
    render(
      <Avatar>
        <AvatarImage src="/ana.jpg" alt="Ana" />
        <AvatarFallback>AN</AvatarFallback>
      </Avatar>,
    );

    fireEvent.load(screen.getByRole("img", { name: "Ana" }));
    expect(screen.queryByText("AN")).toBeNull();
  });
});
