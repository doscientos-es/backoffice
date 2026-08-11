import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Lead360Timeline } from "./lead-360-timeline";

const props = {
  leadId: "lead-1",
  leadStatus: "quoted",
  interactions: [],
  projects: [],
  invoices: [],
  tasks: [],
};

describe("Lead360Timeline", () => {
  it("directs a draft proposal to its existing context instead of creating another one", () => {
    render(
      <Lead360Timeline
        {...props}
        proposals={[
          {
            id: "proposal-draft",
            number: null,
            title: "Automatización comercial",
            status: "draft",
            total: null,
            valid_until: null,
            sent_at: null,
            viewed_at: null,
            responded_at: null,
            notes: null,
          },
        ]}
      />,
    );

    expect(screen.getByText("Completar y enviar la propuesta")).toBeDefined();
    expect(screen.getByRole("link", { name: "Abrir contexto" }).getAttribute("href")).toBe(
      "/proposals/proposal-draft",
    );
  });

  it("recognizes an accepted proposal as a delivery step", () => {
    render(
      <Lead360Timeline
        {...props}
        proposals={[
          {
            id: "proposal-accepted",
            number: "P-2026-001",
            title: "Automatización comercial",
            status: "accepted",
            total: 1000,
            valid_until: null,
            sent_at: "2026-08-01T10:00:00.000Z",
            viewed_at: null,
            responded_at: "2026-08-02T10:00:00.000Z",
            notes: null,
          },
        ]}
      />,
    );

    expect(screen.getByText("Preparar la entrega acordada")).toBeDefined();
    expect(screen.getByRole("link", { name: "Abrir contexto" }).getAttribute("href")).toBe(
      "/proposals/proposal-accepted",
    );
  });
});
