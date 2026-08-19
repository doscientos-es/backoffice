import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VerifactuIssueDetailsButton } from "./verifactu-issue-dialog";

describe("VerifactuIssueDetailsButton", () => {
  it("keeps the technical error out of the header until the user opens its dialog", () => {
    const error = "AEAT HTTP 401: respuesta técnica extensa de VERI*FACTU";
    render(<VerifactuIssueDetailsButton status="error" error={error} />);

    expect(
      screen.getByRole("button", { name: "Ver detalle de Error técnico de VERI*FACTU" }),
    ).toBeDefined();
    expect(screen.queryByText(error)).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "Ver detalle de Error técnico de VERI*FACTU" }),
    );

    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText(error).className).toContain("wrap-break-word");
    expect(screen.getByText(error).className).toContain("overflow-auto");
  });
});
