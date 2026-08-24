import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LeadInteractionDetails } from "./lead-interaction-details";

describe("LeadInteractionDetails", () => {
  it("opens a received email with its complete multiline body and delivery metadata", () => {
    render(
      <LeadInteractionDetails
        label="Email recibido"
        interaction={{
          id: "interaction-1",
          type: "email_received",
          subject: "Necesito más información",
          body: "Primera línea\nSegunda línea completa",
          created_at: "2026-08-24T10:00:00.000Z",
          performer: null,
          payload: { from: "lead@example.test", to: "ventas@example.test" },
          resend_email_id: null,
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Ver detalles" }));

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Necesito más información")).toBeTruthy();
    expect(
      screen.getByText(
        (_, element) => element?.textContent === "Primera línea\nSegunda línea completa",
      ),
    ).toBeTruthy();
    expect(screen.getByText("lead@example.test")).toBeTruthy();
    expect(screen.getByText("ventas@example.test")).toBeTruthy();
  });
});
